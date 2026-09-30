"use client";
import { useParams } from "next/navigation";
import { AlumniIndividualPage } from "@/components/parari/cpp/alumni/AlumniCommunity";
export default function Page() {
  const { userId } = useParams<{ userId: string }>();
  return <AlumniIndividualPage userId={userId} />;
}
