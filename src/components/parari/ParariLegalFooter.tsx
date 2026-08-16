// src/components/parari/ParariLegalFooter.tsx

export default function ParariLegalFooter() {
  return (
    <footer className="px-4 py-8 text-center text-xs leading-6 text-neutral-500">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <a
          href="/privacy"
          className="underline decoration-neutral-300 underline-offset-4 hover:text-neutral-800"
        >
          プライバシーポリシー
        </a>

        <a
          href="/tokusho"
          className="underline decoration-neutral-300 underline-offset-4 hover:text-neutral-800"
        >
          特定商取引法に基づく表記
        </a>
      </div>

      <p className="mt-3">© PARARI</p>
    </footer>
  );
}
