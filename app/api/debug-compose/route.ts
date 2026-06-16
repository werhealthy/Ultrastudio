import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sharp = (await import("sharp")).default;
    
    // Test font existence
    const fontPaths = [
      "public/fonts/TIMSans-Heavy.ttf",
      "public/fonts/TIMSans-Bold.ttf", 
      "public/fonts/TIMSans-Medium.ttf",
      "public/fonts/TIMSans-Regular.ttf",
    ];
    
    const fontStatus: Record<string, any> = {};
    for (const fp of fontPaths) {
      try {
        const buf = await readFile(path.join(process.cwd(), fp));
        fontStatus[fp] = { exists: true, size: buf.length };
      } catch {
        fontStatus[fp] = { exists: false };
      }
    }

    // Test template existence
    const tplPaths = [
      "public/templates/template-01-base.png",
      "public/templates/template-01-preview.png",
    ];
    const tplStatus: Record<string, any> = {};
    for (const tp of tplPaths) {
      try {
        const buf = await readFile(path.join(process.cwd(), tp));
        tplStatus[tp] = { exists: true, size: buf.length };
      } catch {
        tplStatus[tp] = { exists: false };
      }
    }

    // Test compositing with font embed
    let fontB64 = "";
    let compositeOk = false;
    let compositeError = "";
    
    try {
      const fontBuf = await readFile(path.join(process.cwd(), "public/fonts/TIMSans-Heavy.ttf"));
      fontB64 = `data:font/truetype;base64,${fontBuf.toString("base64")}`;
    } catch {
      fontB64 = "FONT_NOT_FOUND";
    }

    try {
      const svgBuf = Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="628" viewBox="0 0 1200 628">
          <style>
            @font-face{font-family:'T';src:url('${fontB64}')format('truetype');font-weight:900;}
          </style>
          <rect width="1200" height="628" fill="white"/>
          <text x="526" y="200" font-size="95" fill="#0033A1" font-family="T,Arial" font-weight="900">WiFi veloce</text>
          <text x="526" y="430" font-size="148" fill="#0033A1" font-family="T,Arial" font-weight="900">24</text>
          <rect x="526" y="445" width="342" height="90" rx="14" fill="#EB0028"/>
          <text x="697" y="500" font-size="29" fill="white" font-family="T,Arial" font-weight="700" text-anchor="middle">Attiva ora</text>
        </svg>`);

      const tplBuf = await readFile(path.join(process.cwd(), "public/templates/template-01-base.png"))
        .catch(() => null);

      const base = tplBuf || await sharp({
        create: { width: 1200, height: 628, channels: 4, background: "#FFFFFF" }
      }).png().toBuffer();

      const out = await sharp(base).composite([{ input: svgBuf }]).png().toBuffer();
      compositeOk = true;
      
      return NextResponse.json({
        ok: true,
        fontStatus,
        tplStatus,
        fontB64: fontB64.slice(0, 50) + "...",
        compositeOk,
        imageUrl: `data:image/png;base64,${out.toString("base64")}`,
      });
    } catch (e) {
      compositeError = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json({
      ok: false,
      fontStatus,
      tplStatus,
      fontB64: fontB64.slice(0, 50) + "...",
      compositeOk,
      compositeError,
    });

  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
