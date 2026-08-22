import type { Metadata } from "next";
import {
  EngineeringReleasesScreen,
  loadEngineeringCatalogue,
} from "@/modules/engineering-hq";

export const metadata: Metadata = {
  title: "Release Centre",
};

export default function EngineeringReleasesPage() {
  return <EngineeringReleasesScreen catalogue={loadEngineeringCatalogue()} />;
}
