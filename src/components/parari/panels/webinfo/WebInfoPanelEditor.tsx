// src/components/parari/panels/webinfo/WebInfoPanelEditor.tsx
// PART: WEBINFO editor
// - トップ / 固定 / 投稿の3種類のページデザインを定義する
// - 各WEBPAGEはpageTypeで、ここで定義したデザインを参照する

"use client";

import { heicTo } from "heic-to";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/lib/supabaseClient";

import { compressImageToJpeg } from "../image/imageUploadUtils";
import type { PanelEditorProps } from "../panelDefinitionTypes";

import {
  getMetaValue,
  parseMetaFields,
} from "../shared/metaFields";

export type WebInfoPanelData = {
  raw: string;
};

async function normalizeWebInfoImageFile(
  file: File,
): Promise<File> {
  const fileNameLooksHeic =
    /\.(heic|heif)$/i.test(file.name);

  const mimeLooksHeic =
    /heic|heif/i.test(file.type);

  if (!fileNameLooksHeic && !mimeLooksHeic) {
    return file;
  }

  try {
    const converted = await heicTo({
      blob: file,
      type: "image/jpeg",
      quality: 0.92,
    });

    const jpegBlob = Array.isArray(converted)
      ? converted[0]
      : converted;

    const jpegName =
      file.name.replace(
        /\.(heic|heif)$/i,
        ".jpg",
      ) || "web-image.jpg";

    return new File(
      [jpegBlob],
      jpegName,
      {
        type: "image/jpeg",
        lastModified: Date.now(),
      },
    );
  } catch (error) {
    console.warn(
      "[WEBINFO image] HEIC conversion skipped",
      {
        fileName: file.name,
        fileType: file.type,
        error,
      },
    );

    return file;
  }
}

type DesignType = "top" | "fixed" | "post";

type SectionItem =
  | "topline"
  | "image"
  | "menu";

type ToplineItem =
  | "logo"
  | "brand"
  | "catch"
  | "link1"
  | "link2"
  | "link3"
  | "cta";

type OrderItem<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

const DESIGN_TABS: Array<{
  value: DesignType;
  label: string;
  description: string;
}> = [
  {
    value: "top",
    label: "トップ",
    description: "トップページで使用する共通デザインです。",
  },
  {
    value: "fixed",
    label: "固定",
    description: "会社概要や案内ページなどで使用します。",
  },
  {
    value: "post",
    label: "投稿",
    description: "お知らせやブログ投稿で使用します。",
  },
];

const SECTION_ITEMS: OrderItem<SectionItem>[] = [
  {
    value: "topline",
    label: "トップライン",
    description: "ロゴ、ブランド名、キャッチ、リンク、CTA",
  },
  {
    value: "image",
    label: "画像",
    description: "ページデザイン共通のヘッダー画像",
  },
  {
    value: "menu",
    label: "メニュー",
    description: "主要ページへのナビゲーション",
  },
];

const TOPLINE_ITEMS: OrderItem<ToplineItem>[] = [
  {
    value: "logo",
    label: "ロゴ",
  },
  {
    value: "brand",
    label: "ブランド名",
  },
  {
    value: "catch",
    label: "キャッチ",
  },
  {
    value: "link1",
    label: "リンク1",
  },
  {
    value: "link2",
    label: "リンク2",
  },
  {
    value: "link3",
    label: "リンク3",
  },
  {
    value: "cta",
    label: "CTA",
  },
];

export function WebInfoPanelEditor({
  data,
  onChangeRaw,
  publicBasePath,
  ownerUsername,
  siteSlug = "",
  onSiteSlugChange,
  webPages = [],
}: PanelEditorProps<WebInfoPanelData>) {
  const [draftRaw, setDraftRaw] = useState(data.raw);
  const [isEditing, setIsEditing] = useState(false);
  const [activeDesign, setActiveDesign] =
    useState<DesignType>("top");

  const [
    imageUploadStatus,
    setImageUploadStatus,
  ] = useState("");

  const [
    isUploadingImage,
    setIsUploadingImage,
  ] = useState(false);

  useEffect(() => {
    setDraftRaw(data.raw);
  }, [data.raw]);

  const fields = useMemo(
    () => parseMetaFields(draftRaw),
    [draftRaw],
  );

  const title = getMetaValue(
    fields,
    ["title"],
    "",
  );

  const homePageSlug = getMetaValue(
    fields,
    ["homePageSlug", "home_page_slug"],
    "home",
  );

  const footer = getMetaValue(
    fields,
    ["footer"],
    "1",
  );

  const updateMeta = (
    key: string,
    value: string,
  ) => {
    const nextRaw = setColonMetaValue(
      draftRaw,
      key,
      value,
    );

    setDraftRaw(nextRaw);
    onChangeRaw?.(nextRaw);
  };

  const design = readDesignValues(
    fields,
    activeDesign,
  );

  const updateDesignMeta = (
    suffix: string,
    value: string,
  ) => {
    updateMeta(
      `${activeDesign}${suffix}`,
      value,
    );
  };

  const activeTab =
    DESIGN_TABS.find(
      (tab) => tab.value === activeDesign,
    ) ?? DESIGN_TABS[0];

  const handlePickDesignImage = async (
    file: File,
    designType: DesignType,
  ) => {
    if (
      !file.type.startsWith("image/") &&
      !/\.(heic|heif)$/i.test(file.name)
    ) {
      setImageUploadStatus(
        "画像ファイルを選んでください",
      );

      return;
    }

    setIsUploadingImage(true);
    setImageUploadStatus("画像を準備中…");

    try {
      if (!supabase) {
        setImageUploadStatus(
          "Supabaseの接続設定を確認できませんでした",
        );

        return;
      }

      const {
        data: userData,
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        setImageUploadStatus(
          "ログインしてください",
        );

        return;
      }

      const normalizedFile =
        await normalizeWebInfoImageFile(file);

      setImageUploadStatus(
        "画像を圧縮中…",
      );

      const blob =
        await compressImageToJpeg(
          normalizedFile,
          {
            maxWidth: 1600,
            maxHeight: 1200,
            quality: 0.78,
          },
        );

      const uid = userData.user.id;

      const uploadPath =
        `${uid}/web/${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}.jpg`;

      setImageUploadStatus(
        "画像をアップロード中…",
      );

      const { error: uploadError } =
        await supabase.storage
          .from("parari-images")
          .upload(uploadPath, blob, {
            contentType: "image/jpeg",
            upsert: false,
          });

      if (uploadError) {
        setImageUploadStatus(
          `アップロード失敗: ${uploadError.message}`,
        );

        return;
      }

      const { data: publicUrlData } =
        supabase.storage
          .from("parari-images")
          .getPublicUrl(uploadPath);

      const nextRaw = setColonMetaValue(
        draftRaw,
        `${designType}ImageUrl`,
        publicUrlData.publicUrl,
      );

      setDraftRaw(nextRaw);
      onChangeRaw?.(nextRaw);

      setImageUploadStatus(
        "画像を設定しました",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error);

      console.error(
        "[WEBINFO image] upload failed",
        error,
      );

      setImageUploadStatus(
        `画像のアップロードに失敗しました: ${message}`,
      );
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-violet-700">
            WEBINFO
          </div>

          <div className="mt-1 text-[11px] leading-5 text-violet-700/80">
            WEB全体の情報と、トップ・固定・投稿ページの共通デザインを設定します。
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            setIsEditing((current) => !current)
          }
          className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-bold text-violet-700"
        >
          {isEditing ? "閉じる" : "編集"}
        </button>
      </div>

      {!isEditing ? (
        <div className="mt-4 rounded-xl border border-violet-100 bg-white p-4">
          <div className="text-base font-bold text-neutral-900">
            {title || "新しいWEB"}
          </div>

          <div className="mt-3 grid gap-2 text-xs text-neutral-500 sm:grid-cols-2">
            <div>
              ホーム：{homePageSlug || "home"}
            </div>

            <div className="break-all">
              サイトURL：
              {publicBasePath || "未設定"}
            </div>

            <div>
              ページデザイン：トップ／固定／投稿
            </div>

            <div>
              トップ：
              {formatOrderSummary(
                readDesignValues(fields, "top")
                  .sectionOrder,
                SECTION_ITEMS,
              )}
            </div>

            <div>
              固定：
              {formatOrderSummary(
                readDesignValues(fields, "fixed")
                  .sectionOrder,
                SECTION_ITEMS,
              )}
            </div>

            <div>
              投稿：
              {formatOrderSummary(
                readDesignValues(fields, "post")
                  .sectionOrder,
                SECTION_ITEMS,
              )}
            </div>

            <div>
              フッター：
              {footer === "none"
                ? "なし"
                : "表示"}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-5">
          <div className="grid gap-4 rounded-xl border border-violet-100 bg-white p-4">
            <div className="text-xs font-bold text-violet-700">
              WEB基本情報
            </div>

            <label className="grid gap-1">
              <span className="text-xs font-bold text-neutral-600">
                WEBタイトル
              </span>

              <input
                type="text"
                value={title}
                onChange={(event) =>
                  updateMeta(
                    "title",
                    event.target.value,
                  )
                }
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
              />
            </label>

            <div className="grid gap-2 rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
              <div>
                <div className="text-xs font-bold text-violet-800">
                  WEBサイトURL
                </div>

                <div className="mt-1 break-all font-mono text-[11px] leading-5 text-neutral-600">
                  {publicBasePath || "まだ公開URLを確認できません"}
                </div>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-bold text-neutral-600">
                  サイトslug
                </span>

                <div className="flex items-center gap-2">
                  <span className="shrink-0 font-mono text-xs text-neutral-400">
                    /{ownerUsername || "username"}/
                  </span>

                  <input
                    type="text"
                    value={siteSlug}
                    onChange={(event) =>
                      onSiteSlugChange?.(
                        event.target.value.toLowerCase(),
                      )
                    }
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-violet-400"
                    placeholder="web"
                  />
                </div>

                <span className="text-[11px] leading-5 text-neutral-500">
                  英小文字・数字・ハイフンのみ、3〜50文字。
                  URLの変更は作品全体を保存したときに確定します。
                </span>
              </label>
            </div>

            <label className="grid gap-1">
              <span className="text-xs font-bold text-neutral-600">
                ホームPAGEのslug
              </span>

              <input
                type="text"
                value={homePageSlug}
                onChange={(event) =>
                  updateMeta(
                    "homePageSlug",
                    event.target.value,
                  )
                }
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
              />
            </label>
          </div>

          <div className="overflow-hidden rounded-2xl border border-sky-200 bg-white">
            <div className="border-b border-sky-200 bg-sky-50 px-4 pt-4">
              <div className="text-xs font-bold text-sky-800">
                ページデザイン
              </div>

              <div className="mt-1 text-[11px] leading-5 text-sky-700">
                WEBPAGE INFOでは、この3種類または「なし」を選ぶだけです。
              </div>

              <div className="mt-4 flex gap-1 overflow-x-auto">
                {DESIGN_TABS.map((tab) => {
                  const selected =
                    activeDesign === tab.value;

                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() =>
                        setActiveDesign(tab.value)
                      }
                      className={[
                        "min-w-[92px] rounded-t-xl border border-b-0 px-4 py-2.5 text-sm font-bold transition",
                        selected
                          ? "border-sky-200 bg-white text-sky-800"
                          : "border-transparent bg-sky-100/60 text-sky-600 hover:bg-sky-100",
                      ].join(" ")}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-6 p-4">
              <div>
                <div className="text-base font-bold text-neutral-900">
                  {activeTab.label}ページ
                </div>

                <div className="mt-1 text-xs leading-5 text-neutral-500">
                  {activeTab.description}
                </div>
              </div>

              <DesignSectionCard
                number="1"
                title="構成要素の選択と順序"
                description="トップライン・画像・メニューを表示するか、どの順番で並べるかを決めます。"
              >
                <OrderEditor
                  items={SECTION_ITEMS}
                  selectedOrder={
                    design.sectionOrder
                  }
                  onChange={(nextOrder) =>
                    updateDesignMeta(
                      "SectionOrder",
                      nextOrder.join(","),
                    )
                  }
                />
              </DesignSectionCard>

              <DesignSectionCard
                number="2"
                title="トップラインの構成要素と順序"
                description="トップライン内で使用する要素と、その並び順を決めます。"
                disabled={
                  !design.sectionOrder.includes(
                    "topline",
                  )
                }
              >
                <OrderEditor
                  items={TOPLINE_ITEMS}
                  selectedOrder={
                    design.toplineOrder
                  }
                  onChange={(nextOrder) =>
                    updateDesignMeta(
                      "ToplineOrder",
                      nextOrder.join(","),
                    )
                  }
                />

                <div className="mt-5 grid gap-4 border-t border-neutral-100 pt-5">
                  {design.toplineOrder.includes(
                    "logo",
                  ) ? (
                    <InfoBox>
                      ロゴ画像は、プロフィールまたはWEB作品に登録されたロゴを使用します。
                    </InfoBox>
                  ) : null}

                  {design.toplineOrder.includes(
                    "brand",
                  ) ? (
                    <Field
                      label="ブランド名"
                      value={design.brandName}
                      placeholder={
                        title || "ブランド名"
                      }
                      onChange={(value) =>
                        updateDesignMeta(
                          "BrandName",
                          value,
                        )
                      }
                    />
                  ) : null}

                  {design.toplineOrder.includes(
                    "catch",
                  ) ? (
                    <Field
                      label="キャッチ"
                      value={design.catchText}
                      placeholder="サイトのキャッチコピー"
                      onChange={(value) =>
                        updateDesignMeta(
                          "CatchText",
                          value,
                        )
                      }
                    />
                  ) : null}

                  {design.toplineOrder.includes(
                    "link1",
                  ) ? (
                    <LinkFields
                      label="リンク1"
                      linkLabel={design.link1Label}
                      href={design.link1Href}
                      onChangeLabel={(value) =>
                        updateDesignMeta(
                          "Link1Label",
                          value,
                        )
                      }
                      onChangeHref={(value) =>
                        updateDesignMeta(
                          "Link1Href",
                          value,
                        )
                      }
                    />
                  ) : null}

                  {design.toplineOrder.includes(
                    "link2",
                  ) ? (
                    <LinkFields
                      label="リンク2"
                      linkLabel={design.link2Label}
                      href={design.link2Href}
                      onChangeLabel={(value) =>
                        updateDesignMeta(
                          "Link2Label",
                          value,
                        )
                      }
                      onChangeHref={(value) =>
                        updateDesignMeta(
                          "Link2Href",
                          value,
                        )
                      }
                    />
                  ) : null}

                  {design.toplineOrder.includes(
                    "link3",
                  ) ? (
                    <LinkFields
                      label="リンク3"
                      linkLabel={design.link3Label}
                      href={design.link3Href}
                      onChangeLabel={(value) =>
                        updateDesignMeta(
                          "Link3Label",
                          value,
                        )
                      }
                      onChangeHref={(value) =>
                        updateDesignMeta(
                          "Link3Href",
                          value,
                        )
                      }
                    />
                  ) : null}

                  {design.toplineOrder.includes(
                    "cta",
                  ) ? (
                    <LinkFields
                      label="CTA"
                      linkLabel={design.ctaLabel}
                      href={design.ctaHref}
                      onChangeLabel={(value) =>
                        updateDesignMeta(
                          "CtaLabel",
                          value,
                        )
                      }
                      onChangeHref={(value) =>
                        updateDesignMeta(
                          "CtaHref",
                          value,
                        )
                      }
                    />
                  ) : null}
                </div>
              </DesignSectionCard>

              <DesignSectionCard
                number="3"
                title="画像の選択"
                description="このページデザインで共通使用する画像を設定します。"
                disabled={
                  !design.sectionOrder.includes(
                    "image",
                  )
                }
              >
                <div className="grid gap-4">
                  {design.imageUrl ? (
                    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
                      <img
                        src={design.imageUrl}
                        alt=""
                        className={[
                          "h-52 w-full",
                          design.imageFit === "contain"
                            ? "object-contain"
                            : "object-cover",
                        ].join(" ")}
                      />
                    </div>
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-xs text-neutral-400">
                      画像はまだ設定されていません
                    </div>
                  )}

                  <input
                    id={`webinfo-${activeDesign}-image-input`}
                    type="file"
                    accept="image/*,.heic,.heif"
                    disabled={isUploadingImage}
                    className="hidden"
                    onChange={(event) => {
                      const file =
                        event.target.files?.[0];

                      event.target.value = "";

                      if (!file) {
                        return;
                      }

                      void handlePickDesignImage(
                        file,
                        activeDesign,
                      );
                    }}
                  />

                  <div className="flex flex-wrap gap-2">
                    <label
                      htmlFor={`webinfo-${activeDesign}-image-input`}
                      className={[
                        "inline-flex cursor-pointer items-center rounded-xl px-4 py-2 text-sm font-bold text-white transition",
                        isUploadingImage
                          ? "pointer-events-none bg-neutral-400"
                          : "bg-sky-700 hover:bg-sky-600",
                      ].join(" ")}
                    >
                      {isUploadingImage
                        ? "アップロード中…"
                        : "画像を選ぶ"}
                    </label>

                    {design.imageUrl ? (
                      <button
                        type="button"
                        onClick={() => {
                          updateDesignMeta(
                            "ImageUrl",
                            "",
                          );

                          setImageUploadStatus(
                            "画像を削除しました",
                          );
                        }}
                        className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
                      >
                        画像を削除
                      </button>
                    ) : null}
                  </div>

                  {imageUploadStatus ? (
                    <div className="text-xs leading-5 text-neutral-500">
                      {imageUploadStatus}
                    </div>
                  ) : null}

                  <Field
                    label="画像URL（詳細設定）"
                    value={design.imageUrl}
                    placeholder="https://..."
                    onChange={(value) =>
                      updateDesignMeta(
                        "ImageUrl",
                        value,
                      )
                    }
                  />
                </div>

                <label className="mt-4 grid gap-1">
                  <span className="text-xs font-bold text-neutral-600">
                    画像の表示方法
                  </span>

                  <select
                    value={design.imageFit}
                    onChange={(event) =>
                      updateDesignMeta(
                        "ImageFit",
                        event.target.value,
                      )
                    }
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="cover">
                      枠全体を覆う
                    </option>

                    <option value="contain">
                      画像全体を表示
                    </option>
                  </select>
                </label>
              </DesignSectionCard>

              <DesignSectionCard
                number="4"
                title="メニュー"
                description="主要メニューを表示するか、どのリンクを並べるかを設定します。"
                disabled={
                  !design.sectionOrder.includes(
                    "menu",
                  )
                }
              >
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={design.menuEnabled}
                    onChange={(event) =>
                      updateDesignMeta(
                        "MenuEnabled",
                        event.target.checked
                          ? "true"
                          : "false",
                      )
                    }
                  />

                  メニューを表示する
                </label>

                {design.menuEnabled ? (
                  <div className="mt-4 grid gap-4 rounded-xl border border-neutral-200 bg-white p-3 sm:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-xs font-bold text-neutral-600">
                        メニュースタイル
                      </span>

                      <select
                        value={design.menuStyle}
                        onChange={(event) =>
                          updateDesignMeta(
                            "MenuStyle",
                            event.target.value,
                          )
                        }
                        className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="pill">
                          丸型
                        </option>

                        <option value="bar">
                          全幅バー型
                        </option>
                      </select>
                    </label>

                    <label className="grid gap-1">
                      <span className="text-xs font-bold text-neutral-600">
                        バーの基本色
                      </span>

                      <select
                        value={design.menuColor}
                        onChange={(event) =>
                          updateDesignMeta(
                            "MenuColor",
                            event.target.value,
                          )
                        }
                        disabled={
                          design.menuStyle !== "bar"
                        }
                        className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-400"
                      >
                        <option value="primary">
                          青
                        </option>

                        <option value="secondary">
                          グレー
                        </option>

                        <option value="success">
                          緑
                        </option>

                        <option value="danger">
                          赤
                        </option>

                        <option value="warning">
                          黄
                        </option>

                        <option value="info">
                          水色
                        </option>

                        <option value="light">
                          薄いグレー
                        </option>

                        <option value="dark">
                          黒
                        </option>

                        <option value="white">
                          白
                        </option>
                      </select>
                    </label>
                  </div>
                ) : null}

                {design.menuEnabled ? (
                  <div className="mt-4">
                    <MenuItemsEditor
                      raw={design.menuLinks}
                      webPages={webPages}
                      onChange={(nextRaw) =>
                        updateDesignMeta(
                          "MenuLinks",
                          nextRaw,
                        )
                      }
                    />
                  </div>
                ) : null}
              </DesignSectionCard>
            </div>
          </div>

          <div className="grid gap-4 rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-xs font-bold text-neutral-700">
              フッター
            </div>

            <label className="grid gap-1">
              <span className="text-xs font-bold text-neutral-600">
                標準フッター
              </span>

              <select
                value={footer}
                onChange={(event) =>
                  updateMeta(
                    "footer",
                    event.target.value,
                  )
                }
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="1">
                  表示する
                </option>

                <option value="none">
                  表示しない
                </option>
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

type DesignValues = {
  sectionOrder: SectionItem[];
  toplineOrder: ToplineItem[];

  brandName: string;
  catchText: string;

  link1Label: string;
  link1Href: string;

  link2Label: string;
  link2Href: string;

  link3Label: string;
  link3Href: string;

  ctaLabel: string;
  ctaHref: string;

  imageUrl: string;
  imageFit: "cover" | "contain";

  menuEnabled: boolean;
  menuLinks: string;
  menuStyle: "pill" | "bar";
  menuColor:
    | "primary"
    | "secondary"
    | "success"
    | "danger"
    | "warning"
    | "info"
    | "light"
    | "dark"
    | "white";
};

function readDesignValues(
  fields: ReturnType<typeof parseMetaFields>,
  designType: DesignType,
): DesignValues {
  const prefix = designType;

  const defaultSections =
    designType === "top"
      ? ["topline", "image", "menu"]
      : ["topline", "menu"];

  return {
    sectionOrder: parseOrder<SectionItem>(
      getMetaValue(
        fields,
        [
          `${prefix}SectionOrder`,
          `${prefix}_section_order`,
        ],
        defaultSections.join(","),
      ),
      SECTION_ITEMS.map((item) => item.value),
    ),

    toplineOrder: parseOrder<ToplineItem>(
      getMetaValue(
        fields,
        [
          `${prefix}ToplineOrder`,
          `${prefix}_topline_order`,
        ],
        "logo,brand,catch,link1,link2,link3,cta",
      ),
      TOPLINE_ITEMS.map((item) => item.value),
    ),

    brandName: getMetaValue(
      fields,
      [
        `${prefix}BrandName`,
        `${prefix}_brand_name`,
      ],
      "",
    ),

    catchText: getMetaValue(
      fields,
      [
        `${prefix}CatchText`,
        `${prefix}_catch_text`,
      ],
      "",
    ),

    link1Label: getMetaValue(
      fields,
      [
        `${prefix}Link1Label`,
        `${prefix}_link1_label`,
      ],
      "",
    ),

    link1Href: getMetaValue(
      fields,
      [
        `${prefix}Link1Href`,
        `${prefix}_link1_href`,
      ],
      "",
    ),

    link2Label: getMetaValue(
      fields,
      [
        `${prefix}Link2Label`,
        `${prefix}_link2_label`,
      ],
      "",
    ),

    link2Href: getMetaValue(
      fields,
      [
        `${prefix}Link2Href`,
        `${prefix}_link2_href`,
      ],
      "",
    ),

    link3Label: getMetaValue(
      fields,
      [
        `${prefix}Link3Label`,
        `${prefix}_link3_label`,
      ],
      "",
    ),

    link3Href: getMetaValue(
      fields,
      [
        `${prefix}Link3Href`,
        `${prefix}_link3_href`,
      ],
      "",
    ),

    ctaLabel: getMetaValue(
      fields,
      [
        `${prefix}CtaLabel`,
        `${prefix}_cta_label`,
      ],
      "",
    ),

    ctaHref: getMetaValue(
      fields,
      [
        `${prefix}CtaHref`,
        `${prefix}_cta_href`,
      ],
      "",
    ),

    imageUrl: getMetaValue(
      fields,
      [
        `${prefix}ImageUrl`,
        `${prefix}_image_url`,
      ],
      "",
    ),

    imageFit:
      getMetaValue(
        fields,
        [
          `${prefix}ImageFit`,
          `${prefix}_image_fit`,
        ],
        "cover",
      ) === "contain"
        ? "contain"
        : "cover",

    menuEnabled: parseBooleanWithDefault(
      getMetaValue(
        fields,
        [
          `${prefix}MenuEnabled`,
          `${prefix}_menu_enabled`,
        ],
        "true",
      ),
      true,
    ),

    menuLinks: getMetaValue(
      fields,
      [
        `${prefix}MenuLinks`,
        `${prefix}_menu_links`,
      ],
      "",
    ),

    menuStyle:
      getMetaValue(
        fields,
        [
          `${prefix}MenuStyle`,
          `${prefix}_menu_style`,
        ],
        "bar",
      ) === "bar"
        ? "bar"
        : "pill",

    menuColor: normalizeBootstrapColor(
      getMetaValue(
        fields,
        [
          `${prefix}MenuColor`,
          `${prefix}_menu_color`,
        ],
        "dark",
      ),
    ),
  };
}

function OrderEditor<T extends string>({
  items,
  selectedOrder,
  onChange,
}: {
  items: OrderItem<T>[];
  selectedOrder: T[];
  onChange: (nextOrder: T[]) => void;
}) {
  const selectedSet = new Set(selectedOrder);

  const toggleItem = (
    value: T,
    checked: boolean,
  ) => {
    if (checked) {
      if (selectedSet.has(value)) {
        return;
      }

      onChange([
        ...selectedOrder,
        value,
      ]);

      return;
    }

    onChange(
      selectedOrder.filter(
        (item) => item !== value,
      ),
    );
  };

  const moveItem = (
    value: T,
    direction: -1 | 1,
  ) => {
    const index =
      selectedOrder.indexOf(value);

    const nextIndex = index + direction;

    if (
      index < 0 ||
      nextIndex < 0 ||
      nextIndex >= selectedOrder.length
    ) {
      return;
    }

    const nextOrder = [...selectedOrder];

    [
      nextOrder[index],
      nextOrder[nextIndex],
    ] = [
      nextOrder[nextIndex],
      nextOrder[index],
    ];

    onChange(nextOrder);
  };

  return (
    <div className="grid gap-2">
      {selectedOrder.map((value, index) => {
        const item =
          items.find(
            (candidate) =>
              candidate.value === value,
          );

        if (!item) {
          return null;
        }

        return (
          <div
            key={value}
            className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3"
          >
            <input
              type="checkbox"
              checked
              onChange={(event) =>
                toggleItem(
                  value,
                  event.target.checked,
                )
              }
            />

            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-neutral-800">
                {index + 1}. {item.label}
              </div>

              {item.description ? (
                <div className="mt-0.5 text-[11px] leading-5 text-neutral-400">
                  {item.description}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              disabled={index === 0}
              onClick={() =>
                moveItem(value, -1)
              }
              className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-sm disabled:opacity-30"
              aria-label={`${item.label}を上へ移動`}
            >
              ↑
            </button>

            <button
              type="button"
              disabled={
                index ===
                selectedOrder.length - 1
              }
              onClick={() =>
                moveItem(value, 1)
              }
              className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-sm disabled:opacity-30"
              aria-label={`${item.label}を下へ移動`}
            >
              ↓
            </button>
          </div>
        );
      })}

      {items
        .filter(
          (item) =>
            !selectedSet.has(item.value),
        )
        .map((item) => (
          <label
            key={item.value}
            className="flex items-center gap-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-3"
          >
            <input
              type="checkbox"
              checked={false}
              onChange={(event) =>
                toggleItem(
                  item.value,
                  event.target.checked,
                )
              }
            />

            <div>
              <div className="text-sm font-bold text-neutral-500">
                {item.label}
              </div>

              {item.description ? (
                <div className="mt-0.5 text-[11px] leading-5 text-neutral-400">
                  {item.description}
                </div>
              ) : null}
            </div>
          </label>
        ))}
    </div>
  );
}

function DesignSectionCard({
  number,
  title,
  description,
  disabled = false,
  children,
}: {
  number: string;
  title: string;
  description: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={[
        "rounded-2xl border p-4",
        disabled
          ? "border-neutral-200 bg-neutral-50 opacity-60"
          : "border-sky-100 bg-sky-50/50",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-700 text-xs font-bold text-white">
          {number}
        </div>

        <div>
          <div className="text-sm font-bold text-neutral-900">
            {title}
          </div>

          <div className="mt-1 text-[11px] leading-5 text-neutral-500">
            {description}
          </div>

          {disabled ? (
            <div className="mt-2 text-[11px] font-bold text-neutral-400">
              構成要素で選択されていないため、公開時には表示されません。
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={
          disabled
            ? "pointer-events-none mt-4"
            : "mt-4"
        }
      >
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold text-neutral-600">
        {label}
      </span>

      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400"
      />
    </label>
  );
}

function LinkFields({
  label,
  linkLabel,
  href,
  onChangeLabel,
  onChangeHref,
}: {
  label: string;
  linkLabel: string;
  href: string;
  onChangeLabel: (value: string) => void;
  onChangeHref: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-3 sm:grid-cols-2">
      <Field
        label={`${label}の表示名`}
        value={linkLabel}
        placeholder={
          label === "CTA"
            ? "お問い合わせ"
            : "会社概要"
        }
        onChange={onChangeLabel}
      />

      <Field
        label={`${label}のリンク先`}
        value={href}
        placeholder="page:about"
        onChange={onChangeHref}
      />
    </div>
  );
}

function InfoBox({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] leading-5 text-sky-700">
      {children}
    </div>
  );
}

function parseOrder<T extends string>(
  value: string,
  allowedValues: T[],
): T[] {
  const allowedSet =
    new Set<T>(allowedValues);

  return Array.from(
    new Set(
      String(value ?? "")
        .split(",")
        .map((item) =>
          item.trim().toLowerCase(),
        )
        .filter(
          (item): item is T =>
            allowedSet.has(item as T),
        ),
    ),
  );
}

function formatOrderSummary<T extends string>(
  order: T[],
  items: OrderItem<T>[],
): string {
  if (order.length === 0) {
    return "なし";
  }

  return order
    .map(
      (value) =>
        items.find(
          (item) => item.value === value,
        )?.label ?? value,
    )
    .join(" → ");
}

function parseBooleanWithDefault(
  value: string,
  defaultValue: boolean,
): boolean {
  const normalized =
    String(value ?? "")
      .trim()
      .toLowerCase();

  if (
    ["true", "1", "yes", "on"].includes(
      normalized,
    )
  ) {
    return true;
  }

  if (
    ["false", "0", "no", "off"].includes(
      normalized,
    )
  ) {
    return false;
  }

  return defaultValue;
}

function setColonMetaValue(
  raw: string,
  key: string,
  value: string,
): string {
  const normalized =
    String(raw ?? "").replace(
      /\r\n/g,
      "\n",
    );

  const lines = normalized.split("\n");

  const pattern = new RegExp(
    `^\\s*${escapeRegExp(key)}\\s*:`,
    "i",
  );

  const index = lines.findIndex(
    (line) => pattern.test(line),
  );

  if (index >= 0) {
    lines[index] = `${key}: ${value}`;
    return lines.join("\n");
  }

  const markerIndex = lines.findIndex(
    (line) =>
      /^\s*\[WEB(?::[^\]]+)?\]/i.test(
        line,
      ),
  );

  lines.splice(
    Math.max(markerIndex + 1, 0),
    0,
    `${key}: ${value}`,
  );

  return lines.join("\n");
}

function escapeRegExp(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

type MenuLinkType =
  | "page"
  | "external"
  | "email"
  | "phone";

type MenuItemValue = {
  label: string;
  type: MenuLinkType;
  target: string;
};

function MenuItemsEditor({
  raw,
  webPages,
  onChange,
}: {
  raw: string;
  webPages: Array<{
    title: string;
    slug: string;
    isHome: boolean;
  }>;
  onChange: (nextRaw: string) => void;
}) {
  const items = parseMenuItemValues(raw);

  const commit = (
    nextItems: MenuItemValue[],
  ) => {
    onChange(
      serializeMenuItemValues(nextItems),
    );
  };

  const updateItem = (
    index: number,
    patch: Partial<MenuItemValue>,
  ) => {
    commit(
      items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch,
            }
          : item,
      ),
    );
  };

  const addItem = () => {
    const firstPage = webPages[0];

    commit([
      ...items,
      {
        label:
          firstPage?.title ||
          "新しいメニュー",
        type: firstPage
          ? "page"
          : "external",
        target: firstPage?.slug || "",
      },
    ]);
  };

  const removeItem = (
    index: number,
  ) => {
    commit(
      items.filter(
        (_, itemIndex) =>
          itemIndex !== index,
      ),
    );
  };

  const moveItem = (
    index: number,
    direction: -1 | 1,
  ) => {
    const nextIndex =
      index + direction;

    if (
      nextIndex < 0 ||
      nextIndex >= items.length
    ) {
      return;
    }

    const nextItems = [...items];

    [
      nextItems[index],
      nextItems[nextIndex],
    ] = [
      nextItems[nextIndex],
      nextItems[index],
    ];

    commit(nextItems);
  };

  return (
    <div className="grid gap-3">
      <div>
        <div className="text-xs font-bold text-neutral-600">
          メニュー項目
        </div>

        <div className="mt-1 text-[11px] leading-5 text-neutral-400">
          表示名とリンク先を設定し、矢印で順番を変更します。
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center text-xs text-neutral-400">
          メニュー項目はまだありません
        </div>
      ) : null}

      {items.map((item, index) => (
        <div
          key={`${index}-${item.type}`}
          className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-bold text-neutral-500">
              メニュー {index + 1}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() =>
                  moveItem(index, -1)
                }
                className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-sm disabled:opacity-30"
                aria-label="上へ移動"
              >
                ↑
              </button>

              <button
                type="button"
                disabled={
                  index ===
                  items.length - 1
                }
                onClick={() =>
                  moveItem(index, 1)
                }
                className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-sm disabled:opacity-30"
                aria-label="下へ移動"
              >
                ↓
              </button>

              <button
                type="button"
                onClick={() =>
                  removeItem(index)
                }
                className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50"
              >
                削除
              </button>
            </div>
          </div>

          <label className="grid gap-1">
            <span className="text-xs font-bold text-neutral-600">
              表示名
            </span>

            <input
              type="text"
              value={item.label}
              onChange={(event) =>
                updateItem(index, {
                  label:
                    event.target.value,
                })
              }
              placeholder="会社概要"
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-bold text-neutral-600">
              リンクの種類
            </span>

            <select
              value={item.type}
              onChange={(event) => {
                const nextType =
                  event.target
                    .value as MenuLinkType;

                const firstPage =
                  webPages[0];

                updateItem(index, {
                  type: nextType,
                  target:
                    nextType === "page"
                      ? firstPage?.slug || ""
                      : "",
                });
              }}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <option value="page">
                WEBPAGE
              </option>

              <option value="external">
                外部URL
              </option>

              <option value="email">
                メール
              </option>

              <option value="phone">
                電話
              </option>
            </select>
          </label>

          {item.type === "page" ? (
            <label className="grid gap-1">
              <span className="text-xs font-bold text-neutral-600">
                WEBPAGE
              </span>

              <select
                value={item.target}
                onChange={(event) => {
                  const slug =
                    event.target.value;

                  const selectedPage =
                    webPages.find(
                      (page) =>
                        page.slug === slug,
                    );

                  updateItem(index, {
                    target: slug,
                    label:
                      item.label ||
                      selectedPage?.title ||
                      "",
                  });
                }}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">
                  選択してください
                </option>

                {webPages.map((page) => (
                  <option
                    key={page.slug}
                    value={page.slug}
                  >
                    {page.title}
                    {page.isHome
                      ? "（HOME）"
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {item.type === "external" ? (
            <MenuTargetField
              label="外部URL"
              value={item.target}
              placeholder="https://example.com"
              onChange={(value) =>
                updateItem(index, {
                  target: value,
                })
              }
            />
          ) : null}

          {item.type === "email" ? (
            <MenuTargetField
              label="メールアドレス"
              value={item.target}
              placeholder="info@example.com"
              onChange={(value) =>
                updateItem(index, {
                  target: value,
                })
              }
            />
          ) : null}

          {item.type === "phone" ? (
            <MenuTargetField
              label="電話番号"
              value={item.target}
              placeholder="075-000-0000"
              onChange={(value) =>
                updateItem(index, {
                  target: value,
                })
              }
            />
          ) : null}
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        className="rounded-xl border border-dashed border-sky-300 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-700 transition hover:bg-sky-100"
      >
        ＋ メニュー項目を追加
      </button>
    </div>
  );
}

function MenuTargetField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold text-neutral-600">
        {label}
      </span>

      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
      />
    </label>
  );
}

function parseMenuItemValues(
  raw: string,
): MenuItemValue[] {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex =
        entry.indexOf("|");

      if (separatorIndex < 0) {
        return null;
      }

      const label = entry
        .slice(0, separatorIndex)
        .trim();

      const href = entry
        .slice(separatorIndex + 1)
        .trim();

      if (!label || !href) {
        return null;
      }

      if (
        href.toLowerCase().startsWith(
          "page:",
        )
      ) {
        return {
          label,
          type: "page" as const,
          target: href.slice(5),
        };
      }

      if (
        href.toLowerCase().startsWith(
          "mailto:",
        )
      ) {
        return {
          label,
          type: "email" as const,
          target: href.slice(7),
        };
      }

      if (
        href.toLowerCase().startsWith(
          "tel:",
        )
      ) {
        return {
          label,
          type: "phone" as const,
          target: href.slice(4),
        };
      }

      return {
        label,
        type: "external" as const,
        target: href,
      };
    })
    .filter(
      (
        item,
      ): item is MenuItemValue =>
        item !== null,
    );
}

function serializeMenuItemValues(
  items: MenuItemValue[],
): string {
  return items
    .map((item) => {
      const label =
        item.label.trim();

      const target =
        item.target.trim();

      if (!label || !target) {
        return "";
      }

      if (item.type === "page") {
        return `${label}|page:${target}`;
      }

      if (item.type === "email") {
        return `${label}|mailto:${target}`;
      }

      if (item.type === "phone") {
        return `${label}|tel:${target}`;
      }

      return `${label}|${target}`;
    })
    .filter(Boolean)
    .join(", ");
}

function normalizeBootstrapColor(
  value: string,
):
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "light"
  | "dark"
  | "white" {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (
    normalized === "primary" ||
    normalized === "secondary" ||
    normalized === "success" ||
    normalized === "danger" ||
    normalized === "warning" ||
    normalized === "info" ||
    normalized === "light" ||
    normalized === "dark" ||
    normalized === "white"
  ) {
    return normalized;
  }

  return "primary";
}
