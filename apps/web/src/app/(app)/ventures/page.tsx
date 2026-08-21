import type { Metadata } from "next";
import { VenturesScreen } from "@/modules/ventures";
import { getShellSnapshot } from "@/core/shell/snapshot";

export const metadata: Metadata = {
  title: "Ventures",
};

export default async function VenturesPage() {
  const snapshot = await getShellSnapshot();
  return <VenturesScreen ventures={snapshot.ventures} />;
}
