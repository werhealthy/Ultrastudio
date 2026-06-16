import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sharp = (await import("sharp")).default;
    
    // Test 1: Sharp funziona?
    const testImg = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 51, b: 161 } }
    }).png().toBuffer();
    
    // Test 2: SVG con testo funziona?
    const svgBuf = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="628" viewBox="0 0 1200 628">
        <rect width="1200" height="628" fill="white"/>
        <text x="526" y="200" font-size="95" fill="#0033A1" font-family="Arial" font-weight="900">WiFi veloce</text>
        <text x="526" y="300" font-size="52" fill="#0033A1" font-family="Arial" font-weight="900">da</text>
        <text x="526" y="430" font-size="148" fill="#0033A1" font-family="Arial" font-weight="900">24</text>
        <text x="725" y="370" font-size="61" fill="#0033A1" font-family="Arial" font-weight="900">,90 €</text>
        <rect x="526" y="445" width="342" height="90" rx="14" fill="#EB0028"/>
        <text x="697" y="500" font-size="29" fill="white" font-family="Arial" font-weight="700" text-anchor="middle">Attiva ora</text>
      </svg>`);
    
    const composed = await sharp({ create: { width: 1200, height: 628, channels: 4, background: "#FFFFFF" }})
      .composite([{ input: svgBuf }])
      .png()
      .toBuffer();

    const b64 = `data:image/png;base64,${composed.toString("base64")}`;
    
    return NextResponse.json({
      ok: true,
      sharpVersion: sharp.versions,
      testImageSize: testImg.length,
      composedSize: composed.length,
      preview: b64.slice(0, 100) + "...",
      imageUrl: b64,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
    }, { status: 500 });
  }
}
