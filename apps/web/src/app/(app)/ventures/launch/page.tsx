import type { Metadata } from "next";
import { LaunchVentureWizard } from "@/modules/ventures/launch/launch-venture-wizard";

export const metadata: Metadata = {
  title: "Launch Company",
};

export default function LaunchVenturePage() {
  return <LaunchVentureWizard />;
}
