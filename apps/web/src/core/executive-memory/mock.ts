import { createExecutiveMemory } from "./model";

export const founderMemoryMock = createExecutiveMemory([
  {
    id: "m1",
    ventureId: "harbor",
    ownerRoleId: "founder",
    recalledFrom: "Thursday",
    title: "You already decided not to raise for Harbor this quarter",
    note: "Capital is not the constraint. Reopening a raise conversation this week would be avoidance of the pricing call.",
    implication: "Do not schedule investor time. Schedule the experiment.",
    briefing: true,
    desk: true,
  },
  {
    id: "m2",
    ventureId: "northwind",
    ownerRoleId: "founder",
    recalledFrom: "Last sprint",
    title: "Northwind’s vendor MSA is not a founder bottleneck",
    note: "You delegated signature to A. Chen. Checking it today recreates work that is already owned.",
    implication: "Leave Northwind off the desk until Friday.",
    briefing: true,
    desk: false,
  },
  {
    id: "m3",
    ventureId: "atlas",
    ownerRoleId: "founder",
    recalledFrom: "Monday last week",
    title: "Atlas gets a review window, not a redesign",
    note: "You committed to unblocking the intake agent in slices, not rewriting the legal product until the queue is clear.",
    implication: "Twenty minutes. Then stop.",
    briefing: true,
    desk: true,
  },
]);
