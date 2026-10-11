import CppAudioPilot from "@/components/parari/matching/CppAudioPilot";

export default async function CppAudioPilotPage({
  searchParams,
}: {
  searchParams: Promise<{ threadId?: string }>;
}) {
  const { threadId = "" } = await searchParams;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(threadId)) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-xl font-bold">CPP LIVE 音声テスト</h1>
        <p className="mt-3">有効なCPP LIVEの会話IDが必要です。</p>
      </main>
    );
  }
  return <CppAudioPilot threadId={threadId} />;
}
