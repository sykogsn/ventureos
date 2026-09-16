import type { MetadataRoute } from "next";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import {
  FRIGORA_PWA_DESCRIPTION,
  FRIGORA_PWA_NAME,
  FRIGORA_PWA_SHORT_NAME,
} from "./copy";
import { FRIGORA_PWA_THEME_COLOR } from "./identity";
import { FRIGORA_PWA_ICON_PATHS, FRIGORA_PWA_START_PATH } from "./paths";

/**
 * Public Frigora install manifest plus machine-readable product metadata.
 * `frigora_product` is derived from the Definition Registry — not a second
 * version source. PWA `id` remains the install identity (`/frigora`).
 */
export type FrigoraWebAppManifest = MetadataRoute.Manifest & {
  frigora_product: {
    id: string;
    version: string;
  };
};

export function frigoraWebAppManifest(): FrigoraWebAppManifest {
  const definition = platformVentureRegistry.resolve("frigora");

  return {
    id: FRIGORA_PWA_START_PATH,
    name: FRIGORA_PWA_NAME,
    short_name: FRIGORA_PWA_SHORT_NAME,
    description: FRIGORA_PWA_DESCRIPTION,
    start_url: FRIGORA_PWA_START_PATH,
    scope: "/",
    display: "standalone",
    background_color: "#f7f6f3",
    theme_color: FRIGORA_PWA_THEME_COLOR,
    icons: [
      {
        src: FRIGORA_PWA_ICON_PATHS.icon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: FRIGORA_PWA_ICON_PATHS.icon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: FRIGORA_PWA_ICON_PATHS.icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: FRIGORA_PWA_ICON_PATHS.icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    frigora_product: {
      id: definition.id,
      version: definition.version,
    },
  };
}
