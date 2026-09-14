// src/components/parari/cpp/CppPublicationsAndAppealEditor.tsx
// CPP WORKBOOK - publications + rich self appeal composition
// 2026-09-14

"use client";

import CppPublicationsEditor from "@/components/parari/cpp/CppPublicationsEditor";
import CppSelfAppealEditor from "@/components/parari/cpp/CppSelfAppealEditor";

type Props = {
  userId: string | null;
};

export default function CppPublicationsAndAppealEditor({ userId }: Props) {
  return (
    <>
      <CppPublicationsEditor userId={userId} />
      <CppSelfAppealEditor userId={userId} />
    </>
  );
}
