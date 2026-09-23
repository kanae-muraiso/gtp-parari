"use client";

import {
  ApplicationLabel,
} from "./applicationPanelSupport";

type GuestVerificationPendingProps = {
  title: string;
  email: string;
  onEdit: () => void;
};

export default function GuestVerificationPending({
  title,
  email,
  onEdit,
}: GuestVerificationPendingProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <ApplicationLabel />

      <h2 className="mt-2 text-xl font-bold text-neutral-950">
        {title}
      </h2>

      <div className="mt-5 rounded-2xl bg-neutral-50 p-5">
        <div className="text-lg font-bold text-neutral-950">
          メールアドレスをご確認ください
        </div>

        <p className="mt-3 break-all text-sm font-semibold text-neutral-800">
          {email}
        </p>

        <p className="mt-3 text-sm leading-7 text-neutral-600">
          確認メールを送りました。メール内のリンクを開くとAPPLICATIONが登録されます。PARARIへの登録は必要ありません。
        </p>

        <p className="mt-2 text-xs leading-6 text-neutral-500">
          定員のある募集では、メール確認が完了するまで枠は確保されません。確認時点で空きがある場合に受付されます。
        </p>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="mt-4 w-full rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100"
      >
        メールアドレスを修正する
      </button>
    </section>
  );
}
