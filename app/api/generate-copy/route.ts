import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildCopyPrompt } from "@/lib/openai-prompts";

export const runtime = "nodejs";

// Limiti caratteri coerenti con il frontend
const HERO_MAX = 60;
const CTA_MAX = 32;

const fallback = {
  heroOptions: ["Qui navigo alla grande", "Qui resto sempre online", "Qui il segnale è top"],
  ctaOptions: ["Scegli TIM WiFi CASA", "Scopri l'offerta", "Attiva ora"],
};

function parseJsonFromText(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function truncate(str: string, max: number) {
  return String(str || "").trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY non configurata nel file .env.local." }, { status: 500 });
    }

    const { mood } = await request.json();
    if (!mood || typeof mood !== "string") {
      return NextResponse.json({ error: "Mood campagna mancante." }, { status: 400 });
    }

    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
      input: buildCopyPrompt(mood),
    });

    const parsed = parseJsonFromText(response.output_text || "");
    const rawHero: string[] = Array.isArray(parsed?.heroOptions) ? parsed.heroOptions.slice(0, 3) : fallback.heroOptions;
    const rawCta: string[] = Array.isArray(parsed?.ctaOptions) ? parsed.ctaOptions.slice(0, 3) : fallback.ctaOptions;

    // Tronca al limite prima di inviare al client
    const heroOptions = rawHero.map((h) => truncate(h, HERO_MAX));
    const ctaOptions = rawCta.map((c) => truncate(c, CTA_MAX));

    return NextResponse.json({ heroOptions, ctaOptions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sconosciuto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
