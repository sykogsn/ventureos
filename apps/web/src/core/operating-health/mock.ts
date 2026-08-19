import { createOperatingHealth, createPortfolioHealth } from "./model";

export const harborHealthMock = createOperatingHealth({
  score: 76,
  label: "Watch",
  band: "watch",
  posture: "Stalled commercial call",
  summary:
    "Operations are healthy. The founder still owes a price decision.",
  judgement: "Healthy operations, stalled commercial call.",
  ask: "Pricing experiment — founder only.",
  briefWatch: true,
});

export const portfolioHealthMock = createPortfolioHealth({
  score: 82,
  band: "healthy",
  posture: "Stable — with two watches",
  verdict:
    "The portfolio is not in trouble. It is uneven. Treat Atlas as a risk to contain and Harbor as a decision to make. Do not spend the morning on Northwind’s health score; it is already compounding.",
});
