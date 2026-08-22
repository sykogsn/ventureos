import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  EngineeringConstitutionScreen,
  loadEngineeringCatalogue,
} from "@/modules/engineering-hq";

type PageParams = { slug: string };

export function generateStaticParams() {
  return loadEngineeringCatalogue().constitution.map((item) => ({
    slug: item.id,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const document = loadEngineeringCatalogue().constitution.find(
    (item) => item.id === slug,
  );
  return { title: document?.title ?? "Constitution Centre" };
}

export default async function EngineeringConstitutionDocumentPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { slug } = await params;
  const catalogue = loadEngineeringCatalogue();
  const exists = catalogue.constitution.some((item) => item.id === slug);
  if (!exists) {
    notFound();
  }

  return (
    <EngineeringConstitutionScreen documents={catalogue.constitution} activeId={slug} />
  );
}
