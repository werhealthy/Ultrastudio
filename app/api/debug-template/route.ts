import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sharp = (await import("sharp")).default;

    // 1. Carica template
    const tplPath = path.join(process.cwd(), "public", "templates", "template-01-base.png");
    const tplBuf  = await readFile(tplPath);
    const meta    = await sharp(tplBuf).metadata();
    const W = meta.width || 1200;
    const H = meta.height || 628;

    // 2. Setup fontconfig
    const fontDir = path.join(process.cwd(), "public", "fonts");
    await mkdir("/tmp/fonts-cache", { recursive: true });
    await writeFile("/tmp/fonts.conf", `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontDir}</dir>
  <cachedir>/tmp/fonts-cache</cachedir>
  <config></config>
</fontconfig>`, "utf8");
    process.env.FONTCONFIG_FILE = "/tmp/fonts.conf";

    // 3. Carica font
    const fontBuf = await readFile(path.join(process.cwd(), "public/fonts/TIMSans-Heavy.ttf"));
    const fontB64 = `data:font/truetype;base64,${fontBuf.toString("base64")}`;

    // 4. Crea SVG overlay — SENZA sfondo, solo testo
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<style>
@font-face{font-family:'T';src:url('${fontB64}')format('truetype');font-weight:900;font-style:normal;}
</style>
<text x="526" y="200" font-size="95" fill="#0033A1" font-family="T,Arial" font-weight="900">WiFi casa</text>
<text x="526" y="310" font-size="52" fill="#0033A1" font-family="T,Arial" font-weight="900">da</text>
<text x="526" y="430" font-size="148" fill="#0033A1" font-family="T,Arial" font-weight="900">24</text>
<rect x="526" y="445" width="342" height="90" rx="14" fill="#EB0028"/>
<text x="697" y="500" font-size="29" fill="white" font-family="T,Arial" font-weight="700" text-anchor="middle">Attiva ora</text>
</svg>`;

    const svgBuf = Buffer.from(svgStr);

    // 5. TEST A: compositing diretto SVG su template
    const testA = await sharp(tplBuf)
      .ensureAlpha()
      .composite([{ input: svgBuf }])
      .png()
      .toBuffer();

    // 6. TEST B: SVG → PNG alpha → composite su template
    const svgAsPng = await sharp(svgBuf)
      .ensureAlpha()
      .png()
      .toBuffer();

    const testB = await sharp(tplBuf)
      .ensureAlpha()
      .composite([{ input: svgAsPng }])
      .png()
      .toBuffer();

    // 7. TEST C: usa flatten sul SVG prima
    const svgFlat = await sharp(svgBuf)
      .flatten({ background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .ensureAlpha()
      .png()
      .toBuffer();

    const testC = await sharp(tplBuf)
      .ensureAlpha()
      .composite([{ input: svgFlat }])
      .png()
      .toBuffer();

    return NextResponse.json({
      ok: true,
      W, H,
      testA: `data:image/png;base64,${testA.toString("base64")}`,
      testB: `data:image/png;base64,${testB.toString("base64")}`,
      testC: `data:image/png;base64,${testC.toString("base64")}`,
    });

  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
    }, { status: 500 });
  }
}
