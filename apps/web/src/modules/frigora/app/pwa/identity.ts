import type { Metadata, Viewport } from "next";
import {
  FRIGORA_DOCUMENT_TITLE_TEMPLATE,
  FRIGORA_PWA_DESCRIPTION,
  FRIGORA_PWA_NAME,
} from "./copy";
import { FRIGORA_PWA_ICON_PATHS, FRIGORA_PWA_MANIFEST_PATH } from "./paths";

export const FRIGORA_PWA_THEME_COLOR = "#3d5248";

export const frigoraCustomerFacingViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: FRIGORA_PWA_THEME_COLOR,
};

export function frigoraCustomerFacingMetadata(): Metadata {
  return {
    applicationName: FRIGORA_PWA_NAME,
    title: {
      // absolute: ignore root `%s · VentureOS` so defaults are "Frigora", not
      // "Frigora · VentureOS". template still brands child page titles.
      absolute: FRIGORA_PWA_NAME,
      template: FRIGORA_DOCUMENT_TITLE_TEMPLATE,
    },
    description: FRIGORA_PWA_DESCRIPTION,
    manifest: FRIGORA_PWA_MANIFEST_PATH,
    appleWebApp: {
      capable: true,
      title: FRIGORA_PWA_NAME,
      statusBarStyle: "default",
    },
    icons: {
      apple: [
        { url: FRIGORA_PWA_ICON_PATHS.apple, sizes: "180x180", type: "image/png" },
      ],
    },
  };
}
