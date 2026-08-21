import type { Metadata } from "next";
import { BrainHealthScreen } from "@/modules/brain";

export const metadata: Metadata = {
  title: "Brain health",
};

export default function BrainHealthPage() {
  return <BrainHealthScreen />;
}
