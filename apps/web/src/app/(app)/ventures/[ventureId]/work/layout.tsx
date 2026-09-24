import type { ReactNode } from "react";
import {
  frigoraCustomerFacingMetadata,
  frigoraCustomerFacingViewport,
} from "@/modules/frigora/app/pwa/identity";

export const metadata = frigoraCustomerFacingMetadata();
export const viewport = frigoraCustomerFacingViewport;

export default function FrigoraWorkLayout({ children }: { children: ReactNode }) {
  return children;
}
