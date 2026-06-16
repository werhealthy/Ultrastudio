import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sharp = (await import("sharp")).default;

    const tplPath = path.join(process.cwd(), "public", "templates", "template-01-base.png");
    const tplBuf  = await readFile(tplPath);
    const meta    = await sharp(tplBuf).metadata();
    const W = meta.width || 1200;
    const H = meta.height || 628;

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

    const fontBuf = await readFile(path.join(process.cwd(), "public/fonts/TIMSans-Heavy.ttf"));
    const fontB64 = `data:font/truetype;base64,${fontBuf.toString("base64")}`;

    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<style>@font-face{font-family:'T';src:url('${fontB64}')format('truetype');font-weight:900;}</style>
<text x="526" y="200" font-size="95" fill="#0033A1" font-family="T,Arial" font-weight="900">WiFi casa</text>
<rect x="526" y="445" width="342" height="90" rx="14" fill="#EB0028"/>
<text x="697" y="500" font-size="29" fill="white" font-family="T,Arial" text-anchor="middle">Attiva ora</text>
</svg>`;

    const svgBuf = Buffer.from(svgStr);

    // Test A: SVG diretto
    const testA = await sharp(tplBuf).ensureAlpha()
      .composite([{ input: svgBuf }]).png().toBuffer();

    // Test B: SVG → PNG poi composite
    const svgPng = await sharp(svgBuf).ensureAlpha().png().toBuffer();
    const testB = await sharp(tplBuf).ensureAlpha()
      .composite([{ input: svgPng }]).png().toBuffer();

    // Test C: template solo (senza overlay) — verifica che il template sia giusto
    const testC = tplBuf;

    const a64 = testA.toString("base64");
    const b64 = testB.toString("base64");
    const c64 = Buffer.from(testC).toString("base64");

    const html = `<!DOCTYPE html><html><body style="background:#222;padding:20px;font-family:sans-serif;color:white">
<h2>Test A — SVG diretto su template</h2>
<img src="data:image/png;base64,${a64}" style="width:100%;max-width:800px;border:2px solid red"/>
<h2>Test B — SVG→PNG poi composite</h2>
<img src="data:image/png;base64,${b64}" style="width:100%;max-width:800px;border:2px solid yellow"/>
<h2>Test C — Template originale (senza overlay)</h2>
<img src="data:image/png;base64,${c64}" style="width:100%;max-width:800px;border:2px solid green"/>
</body></html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" }
    });

  } catch (err) {
    return new NextResponse(
      `<html><body><pre>${err instanceof Error ? err.message + "\n" + err.stack : String(err)}</pre></body></html>`,
      { headers: { "Content-Type": "text/html" }, status: 500 }
    );
  }
}
