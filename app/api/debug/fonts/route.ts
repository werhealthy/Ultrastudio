import { NextResponse } from "next/server";
import { stat } from "fs/promises";
import path from "path";
import { TEMPLATE_01_LAYOUT } from "@/lib/template-layout";

export const runtime = "nodejs";

async function check(relativePath: string) {
  const absolutePath = path.join(process.cwd(), relativePath);
  try {
    const file = await stat(absolutePath);
    return { relativePath, absolutePath, exists: true, size: file.size };
  } catch {
    return { relativePath, absolutePath, exists: false, size: 0 };
  }
}

export async function GET() {
  const fonts = TEMPLATE_01_LAYOUT.files.fonts;
  const checks = await Promise.all([
    check(fonts.heavy),
    check(fonts.bold),
    check(fonts.medium),
    check(fonts.regular),
  ]);

  return NextResponse.json({
    ok: checks.every((item) => item.exists),
    message: checks.every((item) => item.exists)
      ? "Tutti i font risultano leggibili dal server Next."
      : "Uno o più font non vengono trovati dal server Next.",
    checks,
  });
}
