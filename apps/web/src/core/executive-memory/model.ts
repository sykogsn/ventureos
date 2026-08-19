import type { ExecutiveRoleId } from "../executive-office";
import type { ExecutiveMemory, MemoryRecord } from "./types";

export function createExecutiveMemory(records: MemoryRecord[]): ExecutiveMemory {
  return { records };
}

export function briefingMemory(memory: ExecutiveMemory) {
  return memory.records.filter((record) => record.briefing);
}

export function deskMemory(memory: ExecutiveMemory, roleId: ExecutiveRoleId) {
  return memory.records.filter(
    (record) => record.ownerRoleId === roleId && record.desk,
  );
}
