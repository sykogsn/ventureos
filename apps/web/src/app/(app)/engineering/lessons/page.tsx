import type { Metadata } from "next";
import {
  EngineeringLessonsScreen,
  loadEngineeringCatalogue,
} from "@/modules/engineering-hq";

export const metadata: Metadata = {
  title: "Lessons Learned",
};

export default async function EngineeringLessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ sprint?: string; category?: string }>;
}) {
  const query = await searchParams;
  return (
    <EngineeringLessonsScreen
      catalogue={loadEngineeringCatalogue()}
      sprintQuery={query.sprint ?? ""}
      categoryQuery={query.category ?? ""}
    />
  );
}
