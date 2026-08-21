import type { Metadata } from "next";
import { BrainKnowledgeObjectScreen } from "@/modules/brain";
import { getKnowledgeObject } from "@/platform/brain";

type ObjectParams = { objectId: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<ObjectParams>;
}): Promise<Metadata> {
  const { objectId } = await params;
  const object = getKnowledgeObject(objectId);
  return { title: object?.title ?? "Knowledge object" };
}

export default async function BrainKnowledgeObjectPage({
  params,
}: {
  params: Promise<ObjectParams>;
}) {
  const { objectId } = await params;
  return <BrainKnowledgeObjectScreen object={getKnowledgeObject(objectId)} />;
}
