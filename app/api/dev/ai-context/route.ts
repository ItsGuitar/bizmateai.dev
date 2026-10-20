// Dev-only endpoint: writes the AI-context snapshot the client built to public/ai-context.json,
// so it's a real file on disk a future AI backend (or anyone) can read, not just a download.
// Strictly disabled in production for security.

import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

const OUTPUT_PATH = path.join(process.cwd(), "public", "ai-context.json");

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Dev endpoints are disabled in production mode." },
      { status: 403 }
    );
  }

  const text = await request.text();

  try {
    JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Body is not valid JSON." }, { status: 400 });
  }

  await writeFile(OUTPUT_PATH, text, "utf-8");

  return NextResponse.json({
    ok: true,
    path: "/ai-context.json",
    bytes: Buffer.byteLength(text, "utf-8"),
  });
}
