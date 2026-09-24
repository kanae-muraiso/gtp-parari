import {
  randomUUID,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  APPLICATION_DELIVERY_BUCKET,
} from "@/features/application/server/delivery";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";

const MAX_FILE_SIZE =
  20 * 1024 * 1024;

const ALLOWED_EXTENSIONS =
  new Set([
    ".pdf",
    ".zip",
    ".epub",
    ".txt",
    ".csv",
    ".docx",
    ".xlsx",
    ".pptx",
    ".jpg",
    ".jpeg",
    ".png",
  ]);

function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get(
      "authorization",
    ) ?? "";

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i,
    );

  return (
    match?.[1]?.trim() ||
    null
  );
}

function fileExtension(
  name: string,
): string {
  const index =
    name.lastIndexOf(".");

  return index >= 0
    ? name.slice(index).toLowerCase()
    : "";
}

export async function POST(
  request: NextRequest,
) {
  const token =
    getBearerToken(request);

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ログインが必要です。",
      },
      {
        status: 401,
      },
    );
  }

  const {
    data: { user },
    error: authError,
  } =
    await supabaseAdmin.auth.getUser(
      token,
    );

  if (
    authError ||
    !user
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ログイン状態を確認できませんでした。",
      },
      {
        status: 401,
      },
    );
  }

  const formData =
    await request.formData();

  const rawFile =
    formData.get("file");

  if (!(rawFile instanceof File)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ファイルを選択してください。",
      },
      {
        status: 400,
      },
    );
  }

  const fileName =
    rawFile.name.trim();

  const extension =
    fileExtension(fileName);

  if (
    !fileName ||
    !ALLOWED_EXTENSIONS.has(
      extension,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "PDF、ZIP、EPUB、Office文書、CSV、TXT、JPG、PNGを利用できます。",
      },
      {
        status: 400,
      },
    );
  }

  if (
    rawFile.size <= 0 ||
    rawFile.size > MAX_FILE_SIZE
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ファイルは20MB以下にしてください。",
      },
      {
        status: 400,
      },
    );
  }

  const storagePath =
    `${user.id}/${randomUUID()}${extension}`;

  const bytes =
    Buffer.from(
      await rawFile.arrayBuffer(),
    );

  const {
    error: uploadError,
  } =
    await supabaseAdmin.storage
      .from(
        APPLICATION_DELIVERY_BUCKET,
      )
      .upload(
        storagePath,
        bytes,
        {
          contentType:
            rawFile.type ||
            "application/octet-stream",
          upsert: false,
          cacheControl:
            "3600",
        },
      );

  if (uploadError) {
    console.error(
      "[APPLICATION DELIVERY upload] failed:",
      uploadError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "ファイルを保存できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    delivery: {
      storagePath,
      fileName,
      contentType:
        rawFile.type ||
        "application/octet-stream",
      size:
        rawFile.size,
    },
  });
}
