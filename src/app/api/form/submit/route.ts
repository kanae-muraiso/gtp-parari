import {
  NextRequest,
  NextResponse,
} from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

type FormField = {
  id?: unknown;
  type?: unknown;
  label?: unknown;
  required?: unknown;
  options?: unknown;
};

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

export async function POST(
  request: NextRequest,
) {
  const body =
    (await request
      .json()
      .catch(() => null)) as
      | {
          formId?: unknown;
          answers?: unknown;
        }
      | null;

  const formId =
    typeof body?.formId ===
    "string"
      ? body.formId.trim()
      : "";

  if (!UUID_RE.test(formId)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "FORMが指定されていません。",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !body?.answers ||
    typeof body.answers !==
      "object" ||
    Array.isArray(body.answers)
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "回答データが正しくありません。",
      },
      {
        status: 400,
      },
    );
  }

  const {
    data: form,
    error: formError,
  } = await supabaseAdmin
    .from("forms")
    .select(
      `
        id,
        name,
        description,
        definition,
        version
      `,
    )
    .eq("id", formId)
    .maybeSingle();

  if (
    formError ||
    !form
  ) {
    console.error(
      "form submit load failed:",
      formError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "FORMを確認できませんでした。",
      },
      {
        status:
          formError
            ? 500
            : 404,
      },
    );
  }

  const definition =
    form.definition &&
    typeof form.definition ===
      "object" &&
    !Array.isArray(
      form.definition,
    )
      ? (form.definition as {
          fields?: unknown;
        })
      : {};

  const fields =
    Array.isArray(
      definition.fields,
    )
      ? (definition.fields as FormField[])
      : [];

  const inputAnswers =
    body.answers as Record<
      string,
      unknown
    >;

  const normalizedAnswers:
    Record<
      string,
      string | boolean
    > = {};

  for (
    const field of fields
  ) {
    const id =
      typeof field.id ===
      "string"
        ? field.id.trim()
        : "";

    if (!id) {
      continue;
    }

    const type =
      typeof field.type ===
      "string"
        ? field.type
        : "text";

    const label =
      typeof field.label ===
      "string"
        ? field.label
        : "項目";

    const required =
      field.required === true;

    const rawValue =
      inputAnswers[id];

    if (
      type ===
      "checkbox"
    ) {
      const value =
        rawValue === true;

      if (
        required &&
        !value
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              `「${label}」を確認してください。`,
          },
          {
            status: 400,
          },
        );
      }

      normalizedAnswers[id] =
        value;

      continue;
    }

    const value =
      typeof rawValue ===
      "string"
        ? rawValue.trim()
        : "";

    if (
      required &&
      !value
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            `「${label}」を入力してください。`,
        },
        {
          status: 400,
        },
      );
    }

    if (
      type === "select" &&
      value
    ) {
      const options =
        Array.isArray(
          field.options,
        )
          ? field.options
              .filter(
                (
                  option,
                ): option is string =>
                  typeof option ===
                  "string",
              )
              .map((option) =>
                option.trim(),
              )
          : [];

      if (
        !options.includes(value)
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              `「${label}」の回答が正しくありません。`,
          },
          {
            status: 400,
          },
        );
      }
    }

    normalizedAnswers[id] =
      value;
  }

  let userId:
    string | null = null;

  const token =
    getBearerToken(request);

  if (token) {
    const {
      data: { user },
      error: userError,
    } =
      await supabaseAdmin.auth.getUser(
        token,
      );

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "ログイン情報を確認できませんでした。",
        },
        {
          status: 401,
        },
      );
    }

    userId = user.id;
  }

  const formSnapshot = {
    id: form.id,
    name: form.name,
    description:
      form.description,
    definition:
      form.definition,
    version: form.version,
  };

  const {
    data: submission,
    error: insertError,
  } = await supabaseAdmin
    .from(
      "form_submissions",
    )
    .insert({
      form_id: form.id,
      form_version:
        form.version,
      user_id: userId,
      answers:
        normalizedAnswers,
      form_snapshot:
        formSnapshot,
    })
    .select(
      `
        id,
        submitted_at
      `,
    )
    .single();

  if (insertError) {
    console.error(
      "form submission failed:",
      insertError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "FORMを送信できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    submission,
  });
}
