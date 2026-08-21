import type { Metadata } from "next";
import { DocumentsScreen } from "@/modules/documents";

export const metadata: Metadata = {
  title: "Documents",
};

export default async function VentureDocumentsPage({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}) {
  const { ventureId } = await params;

  return <DocumentsScreen ventureId={ventureId} />;
}
