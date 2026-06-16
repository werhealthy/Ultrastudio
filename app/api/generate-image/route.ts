import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildVisualPrompt, type CampaignConfig } from "@/lib/prompt-builder";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const config = JSON.parse(String(formData.get("config"))) as CampaignConfig;
    const demoMode = String(formData.get("demoMode")) === "true";
    const prompt = buildVisualPrompt(config);

    if (demoMode) {
      return NextResponse.json({
        imageUrl: "/demo-visual.svg",
        prompt,
        demo: true
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY mancante nel file .env.local" }, { status: 400 });
    }

    const result = await client.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      prompt,
      size: "1024x1024"
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ error: "Nessuna immagine generata." }, { status: 500 });
    }

    return NextResponse.json({
      imageUrl: `data:image/png;base64,${b64}`,
      prompt,
      demo: false
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Errore durante la generazione immagine." }, { status: 500 });
  }
}
