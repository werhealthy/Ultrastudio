import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sharp = (await import("sharp")).default;
    
    const tplPath = path.join(process.cwd(), "public", "templates", "template-01-base.png");
    
    let tplBuf: Buffer | null = null;
    let tplSize = 0;
    let tplError = "";
    
    try {
      tplBuf = await readFile(tplPath);
      tplSize = tplBuf.length;
    } catch (e) {
      tplError = e instanceof Error ? e.message : String(e);
    }

    if (!tplBuf) {
      return NextResponse.json({ ok: false, tplPath, tplError, tplSize: 0 });
    }

    // Leggi metadata del template
    const meta = await sharp(tplBuf).metadata();
    
    // Restituisce il template direttamente come immagine
    // così puoi vedere cosa carica Sharp
    const url = new URL("https://x.com");
    const asBase64 = `data:image/png;base64,${tplBuf.toString("base64")}`;
    
    return NextResponse.json({
      ok: true,
      tplPath,
      tplSize,
      width: meta.width,
      height: meta.height,
      format: meta.format,
      // I primi 100 bytes in hex per verificare che sia un PNG valido
      header: tplBuf.slice(0, 16).toString("hex"),
      imageUrl: asBase64,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
