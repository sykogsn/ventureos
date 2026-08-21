import type { Metadata } from "next";
import { BrainComposeScreen } from "@/modules/brain";

export const metadata: Metadata = {
  title: "New knowledge",
};

export default function BrainComposePage() {
  return <BrainComposeScreen />;
}
