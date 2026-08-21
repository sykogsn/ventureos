import type { Metadata } from "next";
import { BrainDashboardScreen } from "@/modules/brain";

export const metadata: Metadata = {
  title: "Brain",
};

export default function BrainDashboardPage() {
  return <BrainDashboardScreen />;
}
