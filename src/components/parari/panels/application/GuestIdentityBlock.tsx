"use client";

type GuestIdentityBlockProps = {
  name: string;
  email: string;
  disabled?: boolean;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
};

export default function GuestIdentityBlock({
  name,
  email,
  disabled = false,
  onNameChange,
  onEmailChange,
}: GuestIdentityBlockProps) {
  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="text-sm font-bold text-neutral-950">
        お申し込みになる方
      </div>
      <p className="mt-1 text-xs leading-5 text-neutral-500">
        PARARIへの登録は必要ありません。送信後、メールアドレスの確認をお願いします。
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-bold text-neutral-800">
            お名前
            <span className="ml-1 text-red-500">*</span>
          </span>
          <input
            type="text"
            autoComplete="name"
            disabled={disabled}
            value={name}
            onChange={(event) =>
              onNameChange(event.target.value)
            }
            className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600 disabled:bg-neutral-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-bold text-neutral-800">
            メールアドレス
            <span className="ml-1 text-red-500">*</span>
          </span>
          <input
            type="email"
            autoComplete="email"
            disabled={disabled}
            value={email}
            onChange={(event) =>
              onEmailChange(event.target.value)
            }
            className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600 disabled:bg-neutral-100"
          />
        </label>
      </div>

      <p className="mt-3 text-xs leading-5 text-neutral-500">
        送信すると、お名前と確認済みメールアドレスが主催者に共有されます。
      </p>
    </div>
  );
}
