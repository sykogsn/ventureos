import type { Metadata } from "next";
import {
  EngineeringDashboardScreen,
  loadEngineeringIntelligence,
} from "@/modules/engineering-hq";

export const metadata: Metadata = {
  title: "Engineering HQ",
};

export default function EngineeringDashboardPage() {
  const { catalogue, intelligence } = loadEngineeringIntelligence();
  return (
    <EngineeringDashboardScreen catalogue={catalogue} intelligence={intelligence} />
  );
}
