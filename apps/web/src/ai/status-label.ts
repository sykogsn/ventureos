import type { AiRuntimeStatus } from "./types";

export function aiRuntimeStatusLabel(status: AiRuntimeStatus): string {
  switch (status) {
    case "disconnected":
      return "Standby";
    case "connecting":
      return "Connecting";
    case "ready":
      return "Ready";
    case "error":
      return "Unavailable";
  }
}
