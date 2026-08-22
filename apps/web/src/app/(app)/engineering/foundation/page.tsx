import type { Metadata } from "next";
import {
  EngineeringFoundationScreen,
  loadEngineeringIntelligence,
} from "@/modules/engineering-hq";

export const metadata: Metadata = {
  title: "Foundation Status",
};

export default function EngineeringFoundationPage() {
  const { catalogue, intelligence } = loadEngineeringIntelligence();
  return (
    <EngineeringFoundationScreen catalogue={catalogue} intelligence={intelligence} />
  );
}
