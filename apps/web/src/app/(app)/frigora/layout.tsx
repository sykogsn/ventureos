import type { ReactNode } from "react";
import {
  frigoraCustomerFacingMetadata,
  frigoraCustomerFacingViewport,
} from "@/modules/frigora/app/pwa/identity";

export const metadata = frigoraCustomerFacingMetadata();
export const viewport = frigoraCustomerFacingViewport;

export default function FrigoraStartLayout({ children }: { children: ReactNode }) {
  return children;
}
