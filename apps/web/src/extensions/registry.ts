import type { CommandContribution, ExtensionManifest, NavContribution } from "./types";

const manifests: ExtensionManifest[] = [];

export function registerExtension(manifest: ExtensionManifest) {
  if (manifests.some((item) => item.id === manifest.id)) {
    return;
  }

  manifests.push(manifest);
}

export function listExtensions() {
  return manifests;
}

export function listNavContributions(): NavContribution[] {
  return manifests.flatMap((manifest) => manifest.nav ?? []);
}

export function listCommandContributions(): CommandContribution[] {
  return manifests.flatMap((manifest) => manifest.commands ?? []);
}
