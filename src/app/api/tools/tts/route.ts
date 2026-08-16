// src/app/api/tools/tts/route.ts
// 2026/07/18 3:42

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { authenticateInternalAdmin } from "@/lib/auth/internalAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

const VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
] as const;

type Voice = (typeof VOICES)[number];

type RequestBody = {
  text?: string;
  voice?: string;
  speed?: number;
  instructions?: string;
  filename?: string;
};

const MAX_INPUT_CHARS = 4096;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function sanitizeFileName(input: string) {
  const cleaned =
    input
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "english_tts";

  return cleaned.endsWith(".mp3") ? cleaned : `${cleaned}.mp3`;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateInternalAdmin(req);

    if (auth.ok === false) {
      return jsonError(auth.message, auth.status);
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return jsonError("OPENAI_API_KEY is not set.", 500);
    }

    const openai = new OpenAI({
      apiKey,
    });

    const body = (await req.json()) as RequestBody;

    const text = body.text?.trim() ?? "";
    const voice = (body.voice ?? "marin") as Voice;
    const speed = Number(body.speed ?? 0.9);
    const instructions =
      body.instructions?.trim() ||
      "Read clearly and naturally for English learners.";
    const filename = sanitizeFileName(body.filename || "english_tts.mp3");

    if (!text) {
      return jsonError("テキストが空です。");
    }

    if (text.length > MAX_INPUT_CHARS) {
      return jsonError(
        `テキストが長すぎます。最大${MAX_INPUT_CHARS}文字までです。現在: ${text.length}文字`
      );
    }

    if (!VOICES.includes(voice)) {
      return jsonError("未対応のvoiceです。");
    }

    if (!Number.isFinite(speed) || speed < 0.25 || speed > 4.0) {
      return jsonError("speedは0.25から4.0の範囲で指定してください。");
    }

    const audio = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      instructions,
      response_format: "mp3",
      speed,
    });

    const buffer = Buffer.from(await audio.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(error);
    return jsonError("音声生成中にエラーが発生しました。", 500);
  }
}
