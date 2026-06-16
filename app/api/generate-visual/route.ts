// ── Fix SSL proxy aziendale (solo dev, ignorato su Vercel) ───────────────────
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

import { NextResponse } from "next/server";
import OpenAI from "openai";
import path from "path";
import { writeFile, mkdir } from "fs/promises";
import sharp from "sharp";
import { buildVisualPrompt, type VisualPromptInput } from "@/lib/openai-prompts";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minuti — 3 varianti in sequenza

const VARIANT_COUNT = 3;

function generatedDir() {
  return path.join(process.cwd(), "public", "generated");
}

function buildCleanPrompt(formData: FormData, variantIndex: number): string {
  const input: VisualPromptInput = {
    format: String(formData.get("format") || ""),
    person: String(formData.get("person") || ""),
    age: String(formData.get("age") || ""),
    face: String(formData.get("face") || ""),
    hair: String(formData.get("hair") || ""),
    hairColor: String(formData.get("hairColor") || ""),
    expression: String(formData.get("expression") || ""),
    outfit: String(formData.get("outfit") || ""),
    topColor: String(formData.get("topColor") || ""),
    target: String(formData.get("target") || ""),
    mood: String(formData.get("mood") || ""),
    smartphone: String(formData.get("smartphone") || ""),
    variantIndex,
  };
  return buildVisualPrompt(input);
}

function extractBase64(result: any): string | null {
  if (typeof result === "string") return result;
  if (result?.b64_json) return result.b64_json;
  if (result?.data?.[0]?.b64_json) return result.data[0].b64_json;
  if (typeof result?.data === "string") return result.data;
  return null;
}

async function fetchGeneratedUrl(result: any): Promise<Buffer | null> {
  const url = result?.url || result?.data?.[0]?.url;
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

async function saveDebugImage(filename: string, buffer: Buffer): Promise<void> {
  if (process.env.ULTRASTUDIO_DEBUG_IMAGES !== "1") return;
  try {
    await writeFile(path.join(generatedDir(), filename), buffer);
  } catch (error) {
    console.error(`[UltraStudio API][generate-visual] Debug save failed: ${filename}`, error);
  }
}

/**
 * Rimuove lo sfondo bianco dal soggetto generato.
 * NON usa flatten() per non distruggere il canale alpha.
 * Strategia: converti in RGBA, rendi bianchi/quasi-bianchi trasparenti, poi trim.
 */
async function cleanGeneratedSubject(inputBuffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) throw new Error("Invalid image metadata");

    const { width, height } = metadata;

    // Converti in raw RGBA
    const raw = await image.ensureAlpha().raw().toBuffer();
    const pixels = new Uint8Array(raw);
    const total = width * height;

    // Soglia: pixel considerati "sfondo bianco"
    // R, G, B tutti > 230 → trasparente
    const THRESHOLD = 230;

    for (let i = 0; i < total; i++) {
      const idx = i * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      if (r > THRESHOLD && g > THRESHOLD && b > THRESHOLD) {
        pixels[idx + 3] = 0; // alpha = 0 (trasparente)
      }
    }

    // Ricostruisci PNG con alpha
    const cleaned = await sharp(Buffer.from(pixels), {
      raw: { width, height, channels: 4 },
    })
      .png()
      .toBuffer();

    // Trim dei bordi trasparenti
    const trimmed = await sharp(cleaned)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    return trimmed;
  } catch (error) {
    console.error("[UltraStudio API][generate-visual] Cleaning failed, returning original:", error);
    return inputBuffer;
  }
}

async function createImage(client: OpenAI, args: any) {
  try {
    return await client.images.generate(args);
  } catch (error: any) {
    const message = String(error?.message || "");
    if (message.includes("Unknown parameter") || error?.code === "unknown_parameter") {
      console.error("[UltraStudio API][generate-visual] Unknown parameter error:", error);
      throw new Error(`Parametro API sconosciuto: ${message}`);
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY non configurata nel file .env.local." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
    const size = (process.env.OPENAI_IMAGE_SIZE as any) || "1024x1536";
    const quality = (process.env.OPENAI_IMAGE_QUALITY as any) || "high";

    console.log(`[UltraStudio API][generate-visual] image model: ${model}`);
    console.log(`[UltraStudio API][generate-visual] image size: ${size}`);
    console.log(`[UltraStudio API][generate-visual] Generating ${VARIANT_COUNT} variants in sequence.`);

    const client = new OpenAI({ apiKey });
    const timestamp = Date.now();
    await mkdir(generatedDir(), { recursive: true });

    const personUrls: string[] = [];

    // ── 3 varianti in SEQUENZA (non parallelo) ───────────────────────────────
    for (let i = 0; i < VARIANT_COUNT; i++) {
      console.log(`[UltraStudio API][generate-visual] Generating variant ${i + 1}/${VARIANT_COUNT}`);

      const prompt = buildCleanPrompt(formData, i);
      const result = await createImage(client, { model, prompt, size, quality });

      const b64 = extractBase64(result);
      const originalBuffer = b64
        ? Buffer.from(b64, "base64")
        : await fetchGeneratedUrl(result);

      if (!originalBuffer) {
        console.error(`[UltraStudio API][generate-visual] Variant ${i + 1}: no image received`);
        continue;
      }

      await saveDebugImage(`debug-original-${timestamp}-${i + 1}.png`, originalBuffer);
      const cleanedBuffer = await cleanGeneratedSubject(originalBuffer);
      await saveDebugImage(`debug-cleaned-${timestamp}-${i + 1}.png`, cleanedBuffer);

      const filename = `generated-subject-${timestamp}-${i + 1}.png`;
      await writeFile(path.join(generatedDir(), filename), cleanedBuffer);

      console.log(`[UltraStudio API][generate-visual] Variant ${i + 1} completed: ${filename}`);
      personUrls.push(`/api/figma/asset/${filename}`);
    }

    if (!personUrls.length) {
      return NextResponse.json(
        { error: "Nessuna variante generata con successo." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      variants: personUrls,
      personVariants: personUrls,
      model,
      size,
      debug:
        process.env.ULTRASTUDIO_DEBUG_IMAGES === "1"
          ? {
              originals: Array.from({ length: VARIANT_COUNT }, (_, i) =>
                `/api/figma/asset/debug-original-${timestamp}-${i + 1}.png`
              ),
              cleaned: Array.from({ length: VARIANT_COUNT }, (_, i) =>
                `/api/figma/asset/debug-cleaned-${timestamp}-${i + 1}.png`
              ),
            }
          : undefined,
    });
  } catch (error) {
    console.error("[UltraStudio API][generate-visual] Fatal:", error);
    const message = error instanceof Error ? error.message : "Errore sconosciuto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
