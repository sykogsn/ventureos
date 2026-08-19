import { createMissionEngine } from "./model";

export const harborMissionMock = createMissionEngine({
  today: {
    title: "Approve the 14-day pricing experiment",
    ask: "Green-light the test this afternoon, or explicitly park it until next week. Silence is a decision — and the wrong one.",
    whyNow:
      "Harbor is the only company whose trajectory changes if you act today. The rest of the portfolio is already in motion.",
    ifDeferred:
      "The experiment slips past the sprint, and next week you will be asked the same question with less time and the same uncertainty.",
    timeNeeded: "25 minutes",
    actionLabel: "Open the pricing brief",
    actionHref: "/ventures",
    attention: "today",
    founderAsk: "Approve or park the pricing test.",
    active: true,
  },
  sprint: {
    name: "Sprint 1",
    objective: "Move winning first customers from intent to a visible milestone.",
    tasks: [
      {
        id: "t1",
        title: "Write the week-one constraint for Harbor Pay",
        owner: "Founder",
      },
      {
        id: "t2",
        title: "Define the first proof of winning first customers",
        owner: "CFO",
      },
      {
        id: "t3",
        title: "Schedule the operating cadence",
        owner: "CFO",
      },
    ],
  },
});
