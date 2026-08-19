import type { VentureId } from "../shared";
import type { ExecutiveRoleId } from "../executive-office";

export type MemoryRecord = {
  id: string;
  ventureId?: VentureId;
  ownerRoleId: ExecutiveRoleId;
  recalledFrom: string;
  title: string;
  note: string;
  implication: string;
  briefing: boolean;
  desk: boolean;
};

export type ExecutiveMemory = {
  records: MemoryRecord[];
};
