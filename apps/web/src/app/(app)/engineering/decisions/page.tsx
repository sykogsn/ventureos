import type { Metadata } from "next";
import {
  EngineeringDecisionsScreen,
  loadEngineeringCatalogue,
} from "@/modules/engineering-hq";

export const metadata: Metadata = {
  title: "Decision Register",
};

export default function EngineeringDecisionsPage() {
  return <EngineeringDecisionsScreen catalogue={loadEngineeringCatalogue()} />;
}
