"use client";

import Link from "next/link";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import ManagementTabs from "@/components/parari/navigation/ManagementTabs";
import MyImageLibrary from "@/components/parari/MyImageLibrary";

export default function MyImagesPage() {
  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="mx-auto w-full max-w-[1000px] px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="マイ画像" area="studio" navigation={<ManagementTabs active="works" embedded />} />
        <div className="mt-6">
          <MyImageLibrary />
        </div>
      </div>
    </main>
  );
}
