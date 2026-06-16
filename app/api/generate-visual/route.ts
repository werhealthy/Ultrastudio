// ── Fix SSL proxy aziendale (solo dev) ───────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

import { NextResponse } from "next/server";
import OpenAI from "openai";
import sharp from "sharp";
import { buildVisualPrompt, type VisualPromptInput } from "@/lib/openai-prompts";

export const runtime = "nodejs";
export const maxDuration = 300;

const VARIANT_COUNT = 3;

function buildCleanPrompt(formData: FormData, variantIndex: number): string {
  const input: VisualPromptInput = {
    format:     String(formData.get("format")     || ""),
    person:     String(formData.get("person")     || ""),
    age:        String(formData.get("age")         || ""),
    face:       String(formData.get("face")        || ""),
    hair:       String(formData.get("hair")        || ""),
    hairColor:  String(formData.get("hairColor")  || ""),
    expression: String(formData.get("expression") || ""),
    outfit:     String(formData.get("outfit")     || ""),
    topColor:   String(formData.get("topColor")   || ""),
    target:     String(formData.get("target")     || ""),
    mood:       String(formData.get("mood")        || ""),
    smartphone: String(formData.get("smartphone") || ""),
    variantIndex,
  };
  return buildVisualPrompt(input);
}

function extractBase64(result: any): string | null {
  if (typeof result === "string") return result;
  if (result?.b64_json) return result.b64_json;
  if (result?.data?.[0]?.b64_json) return result.data[0].b64_json;
  return null;
}

async function fetchGeneratedUrl(result: any): Promise<Buffer | null> {
  const url = result?.url || result?.data?.[0]?.url;
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch { return null; }
}

async function cleanGeneratedSubject(inputBuffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) throw new Error("Invalid metadata");
    const { width, height } = metadata;
    const raw = await image.ensureAlpha().raw().toBuffer();
    const pixels = new Uint8Array(raw);
    const THRESHOLD = 230;
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      if (pixels[idx] > THRESHOLD && pixels[idx+1] > THRESHOLD && pixels[idx+2] > THRESHOLD) {
        pixels[idx+3] = 0;
      }
    }
    const cleaned = await sharp(Buffer.from(pixels), { raw: { width, height, channels: 4 } }).png().toBuffer();
    return await sharp(cleaned).trim({ background: { r:0,g:0,b:0,alpha:0 } }).png().toBuffer();
  } catch (e) {
    console.error("[generate-visual] Clean failed:", e);
    return inputBuffer;
  }
}

async function createImage(client: OpenAI, args: any) {
  try {
    return await client.images.generate(args);
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.includes("Unknown parameter") || error?.code === "unknown_parameter") {
      throw new Error(`Parametro API sconosciuto: ${msg}`);
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY non configurata." }, { status: 500 });

    const formData = await request.formData();
    const model   = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
    const size    = (process.env.OPENAI_IMAGE_SIZE    as any) || "1024x1536";
    const quality = (process.env.OPENAI_IMAGE_QUALITY as any) || "medium";

    console.log(`[generate-visual] model:${model} size:${size} quality:${quality}`);

    const client = new OpenAI({ apiKey });

    // Genera varianti in sequenza, restituisce base64 direttamente
    const variantB64: string[] = [];

    for (let i = 0; i < VARIANT_COUNT; i++) {
      console.log(`[generate-visual] Variant ${i+1}/${VARIANT_COUNT}`);
      const prompt = buildCleanPrompt(formData, i);
      const result = await createImage(client, { model, prompt, size, quality });

      const b64 = extractBase64(result);
      const originalBuffer = b64 ? Buffer.from(b64, "base64") : await fetchGeneratedUrl(result);
      if (!originalBuffer) { console.error(`Variant ${i+1}: no image`); continue; }

      const cleanedBuffer = await cleanGeneratedSubject(originalBuffer);
      variantB64.push(`data:image/png;base64,${cleanedBuffer.toString("base64")}`);
      console.log(`[generate-visual] Variant ${i+1} done`);
    }

    if (!variantB64.length) return NextResponse.json({ error: "Nessuna variante generata." }, { status: 500 });

    return NextResponse.json({
      variants:       variantB64,  // data URLs — usati direttamente nel browser
      personVariants: variantB64,
      model,
      size,
    });
  } catch (error) {
    console.error("[generate-visual] Fatal:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore." }, { status: 500 });
  }
}
