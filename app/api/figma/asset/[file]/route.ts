import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

// Su Vercel i file generati stanno in /tmp, in locale in public/generated
function generatedDir() {
  return process.env.VERCEL ? "/tmp/generated" : path.join(process.cwd(), "public", "generated");
}

const STATIC_FILES: Record<string, string> = {
  "person-approved.png":              "demo/person-approved.png",
  "person-approved-transparent.png":  "generated/person-approved-transparent.png",
  "demo-final-campaign.png":          "demo/demo-final-campaign.png",
  "demo-variant-01.png":              "demo/demo-variant-01.png",
  "demo-variant-02.png":              "demo/demo-variant-02.png",
  "demo-variant-03.png":              "demo/demo-variant-03.png",
  "logo-ultrastudio.png":             "logo-ultrastudio.png",
  "template-01-preview.png":          "templates/template-01-preview.png",
  "template-01-base.png":             "templates/template-01-base.png",
};

function corsHeaders(contentType = "image/png") {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  };
}

// Accetta tutti i file generati dinamicamente con naming sicuro
function isGeneratedFile(file: string) {
  return /^[\w-]+-\d+-\d+\.png$/.test(file) || /^[\w-]+-\d+\.png$/.test(file);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ file: string }> },
) {
  const { file } = await context.params;

  // 1. File statici da public/
  if (STATIC_FILES[file]) {
    try {
      const bytes = await readFile(path.join(process.cwd(), "public", STATIC_FILES[file]));
      return new NextResponse(new Uint8Array(bytes), { status: 200, headers: corsHeaders() });
    } catch {
      return NextResponse.json({ error: "Static asset not found" }, { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
    }
  }

  // 2. File generati dinamicamente (da /tmp su Vercel, da public/generated in locale)
  if (isGeneratedFile(file)) {
    try {
      const bytes = await readFile(path.join(generatedDir(), file));
      return new NextResponse(new Uint8Array(bytes), { status: 200, headers: corsHeaders() });
    } catch {
      return NextResponse.json({ error: "Generated file not found", file }, { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
    }
  }

  return NextResponse.json({ error: "Asset not allowed" }, { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
}
