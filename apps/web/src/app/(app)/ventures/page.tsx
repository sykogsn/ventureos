import { VenturesScreen } from "@/modules/ventures";
import { getShellSnapshot } from "@/core/shell/snapshot";

export default async function VenturesPage() {
  const snapshot = await getShellSnapshot();
  return <VenturesScreen ventures={snapshot.ventures} />;
}
