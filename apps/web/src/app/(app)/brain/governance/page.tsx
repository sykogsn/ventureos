import type { Metadata } from "next";
import { BrainGovernanceScreen } from "@/modules/brain";

export const metadata: Metadata = {
  title: "Governance",
};

export default function BrainGovernancePage() {
  return <BrainGovernanceScreen />;
}
