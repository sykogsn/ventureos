import type { VentureGenome } from "./types";

export function createVentureGenome(input: VentureGenome): VentureGenome {
  return { ...input };
}

export function postureLabel(genome: VentureGenome) {
  return genome.posture === "ai-native" ? "AI-native" : "Human-led";
}
