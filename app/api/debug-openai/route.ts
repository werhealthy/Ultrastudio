import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const url = new URL(request.url);
  const ping = url.searchParams.get("ping") === "1";

  if (!apiKey) {
    return NextResponse.json({ ok: false, hasKey: false, message: "OPENAI_API_KEY non trovata." }, { status: 500 });
  }

  if (!ping) {
    return NextResponse.json({ ok: true, hasKey: true, message: "Chiave presente. Aggiungi ?ping=1 per fare un test reale." });
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
      input: "Rispondi solo con OK.",
    });

    return NextResponse.json({ ok: true, hasKey: true, response: response.output_text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sconosciuto.";
    return NextResponse.json({ ok: false, hasKey: true, message }, { status: 500 });
  }
}
