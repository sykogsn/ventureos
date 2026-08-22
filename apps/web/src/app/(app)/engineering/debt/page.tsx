import type { Metadata } from "next";
import {
  EngineeringDebtScreen,
  loadEngineeringIntelligence,
} from "@/modules/engineering-hq";

export const metadata: Metadata = {
  title: "Technical Debt",
};

export default function EngineeringDebtPage() {
  const { catalogue, intelligence } = loadEngineeringIntelligence();
  return <EngineeringDebtScreen catalogue={catalogue} intelligence={intelligence} />;
}
