import { createRiskIntelligence } from "./model";

export const harborRiskMock = createRiskIntelligence({
  headline: "The risk is an unmade price, not insolvency.",
  signals: [
    {
      id: "r1",
      title: "Price undecided",
      severity: "high",
      band: "watch",
      summary: "Commercial learning is blocked on a founder call.",
      mitigation: "Approve or park the 14-day test today.",
    },
  ],
});
