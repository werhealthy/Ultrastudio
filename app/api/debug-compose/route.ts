import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const sharp = (await import("sharp")).default;
    const url = new URL(request.url);
    const test = url.searchParams.get("test") || "1";

    // Carica font TIM Sans Heavy
    const fontBuf = await readFile(path.join(process.cwd(), "public/fonts/TIMSans-Heavy.ttf"));
    const fontB64 = `data:font/truetype;base64,${fontBuf.toString("base64")}`;

    // Carica template
    const tplBuf = await readFile(path.join(process.cwd(), "public/templates/template-01-base.png"));
    const tplMeta = await sharp(tplBuf).metadata();
    const W = tplMeta.width || 1200;
    const H = tplMeta.height || 628;

    let svgStr = "";

    if (test === "1") {
      // Test 1: SVG con width/height espliciti = canvas size, font embedded
      svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
        <style>
          @font-face{font-family:'T';src:url('${fontB64}')format('truetype');font-weight:900;font-style:normal;}
        </style>
        <text x="526" y="200" font-size="95" fill="#0033A1" font-family="T,Arial" font-weight="900">WiFi veloce</text>
        <text x="526" y="310" font-size="52" fill="#0033A1" font-family="T,Arial" font-weight="900">da</text>
        <text x="526" y="430" font-size="148" fill="#0033A1" font-family="T,Arial" font-weight="900">24</text>
        <rect x="526" y="445" width="342" height="90" rx="14" fill="#EB0028"/>
        <text x="697" y="500" font-size="29" fill="white" font-family="T,Arial" font-weight="700" text-anchor="middle">Attiva ora</text>
      </svg>`;
    } else if (test === "2") {
      // Test 2: SVG con viewBox ma SENZA width/height
      svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 628">
        <style>
          @font-face{font-family:'T';src:url('${fontB64}')format('truetype');font-weight:900;font-style:normal;}
        </style>
        <text x="526" y="200" font-size="95" fill="#0033A1" font-family="T,Arial" font-weight="900">WiFi veloce</text>
        <text x="526" y="310" font-size="52" fill="#0033A1" font-family="T,Arial" font-weight="900">da</text>
        <text x="526" y="430" font-size="148" fill="#0033A1" font-family="T,Arial" font-weight="900">24</text>
        <rect x="526" y="445" width="342" height="90" rx="14" fill="#EB0028"/>
        <text x="697" y="500" font-size="29" fill="white" font-family="T,Arial" font-weight="700" text-anchor="middle">Attiva ora</text>
      </svg>`;
    } else {
      // Test 3: SVG con viewBox E width/height uguali al canvas
      svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="628" viewBox="0 0 1200 628">
        <style>
          @font-face{font-family:'T';src:url('${fontB64}')format('truetype');font-weight:900;font-style:normal;}
        </style>
        <text x="526" y="200" font-size="95" fill="#0033A1" font-family="T,Arial" font-weight="900">WiFi veloce</text>
        <text x="526" y="310" font-size="52" fill="#0033A1" font-family="T,Arial" font-weight="900">da</text>
        <text x="526" y="430" font-size="148" fill="#0033A1" font-family="T,Arial" font-weight="900">24</text>
        <rect x="526" y="445" width="342" height="90" rx="14" fill="#EB0028"/>
        <text x="697" y="500" font-size="29" fill="white" font-family="T,Arial" font-weight="700" text-anchor="middle">Attiva ora</text>
      </svg>`;
    }

    const svgBuf = Buffer.from(svgStr);
    const out = await sharp(tplBuf)
      .composite([{ input: svgBuf }])
      .png()
      .toBuffer();

    const b64 = `data:image/png;base64,${out.toString("base64")}`;
    return NextResponse.json({ ok: true, test, W, H, imageUrl: b64 });

  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.slice(0, 800) : undefined,
    }, { status: 500 });
  }
}
