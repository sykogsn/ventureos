export type InsightId = string & { readonly __brand: "InsightId" };
export type SignalId = string & { readonly __brand: "SignalId" };

export type IntelligenceStatus = "idle" | "observing" | "unavailable";

export type Signal = {
  id: SignalId;
  kind: string;
  ventureId?: string;
};

export type Insight = {
  id: InsightId;
  title: string;
  summary: string;
  signalIds: SignalId[];
};

export type IntelligenceMemory = {
  key: string;
  value: string;
};
