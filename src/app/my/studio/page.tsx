// STUDIO HOME: a simple starting point for the author's workspace.
import Link from "next/link";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import ManagementTabs from "@/components/parari/navigation/ManagementTabs";

export default function StudioHomePage() {
  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="mx-auto w-full max-w-[768px] px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader
          title="STUDIO HOME"
          area="studio"
          navigation={<ManagementTabs active="home" embedded />}
        />

        <section className="mt-6">
          <Link
            href="/my/works?from=studio-home"
            className="group block rounded-3xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 sm:p-6"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
                  MY WORKS
                </div>
                <h2 className="mt-2 text-xl font-bold text-neutral-950">
                  私の作品
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  作成した作品を確認し、続きを編集できます。
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold text-blue-800 transition group-hover:translate-x-1">
                作品を開く →
              </span>
            </div>
          </Link>
        </section>
      </div>
    </main>
  );
}
