import type { Metadata } from "next";
import { FoundationGalleryScreen } from "@/modules/frontend-foundation";

export const metadata: Metadata = {
  title: "Foundation Gallery",
};

export default function EngineeringGalleryPage() {
  return <FoundationGalleryScreen />;
}
