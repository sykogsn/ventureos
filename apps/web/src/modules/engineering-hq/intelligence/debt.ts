import type { EngineeringCatalogue } from "../types";
import type { DebtIntelligence } from "./types";

export function analyseDebt(catalogue: EngineeringCatalogue): DebtIntelligence {
  const open = catalogue.debt.filter((item) => /open/i.test(item.status));
  const resolved = catalogue.debt.filter((item) =>
    /resolved|closed|done/i.test(item.status),
  );
  const high = catalogue.debt.filter((item) => /high/i.test(item.priority)).length;
  const medium = catalogue.debt.filter((item) => /medium/i.test(item.priority)).length;
  const low = catalogue.debt.filter((item) => /low/i.test(item.priority)).length;
  const last = catalogue.debt.at(-1);

  return {
    total: catalogue.debt.length,
    high,
    medium,
    low,
    open: open.length,
    resolved: resolved.length,
    recentlyAdded: last ? `${last.id} — ${last.title}` : "Unknown",
    trend: "Unknown. Trend analysis requires dated snapshots; the register has no history series yet.",
  };
}
