import { DocumentsScreen } from "@/modules/documents";

export default async function VentureDocumentsPage({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}) {
  const { ventureId } = await params;

  return <DocumentsScreen ventureId={ventureId} />;
}
