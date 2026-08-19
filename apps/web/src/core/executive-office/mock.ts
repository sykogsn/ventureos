import { createOffice, createSeat } from "./model";
import type { ExecutiveDesk, ExecutiveOffice } from "./types";

function desk(
  seat: ExecutiveDesk["seat"],
  brief: ExecutiveDesk["brief"],
  primaryAction: ExecutiveDesk["primaryAction"],
  correspondence: ExecutiveDesk["correspondence"],
): ExecutiveDesk {
  return { seat, brief, primaryAction, correspondence };
}

export const leadershipOfficeMock: ExecutiveOffice = createOffice({
  enabled: true,
  posture: "The floor is seated. Two offices are waiting on you.",
  worldLine:
    "This is the leadership layer of VentureOS. Each office holds a brief, a recommendation, and a record — not a chat thread.",
  desks: [
    desk(
      createSeat("founder", true, "awaiting-founder", "Two calls waiting"),
      {
        headline: "Protect Harbor. Do not reopen Northwind.",
        body: "Your desk is not a queue. Harbor’s pricing test and Atlas’s two clause types are the only founder work that changes this week. Everything else is already owned on this floor.",
        focus: "Make the Harbor call before 4:00pm.",
      },
      { label: "Open Situation Room", href: "/dashboard" },
      [
        {
          id: "fc1",
          at: "This morning",
          author: "CFO",
          body: "Cash impact of the Harbor test is inside the band we agreed. The recommendation stands.",
        },
        {
          id: "fc2",
          at: "Yesterday",
          author: "COO",
          body: "Ops can run the test the same day you sign it. No new headcount.",
        },
        {
          id: "fc3",
          at: "Thursday",
          author: "Sonny",
          body: "Do not put a raise on my calendar until price has a reading.",
        },
      ],
    ),
    desk(
      createSeat("cto", true, "in-session", "In session"),
      {
        headline: "Atlas is a judgement problem, not an engineering one.",
        body: "The intake agent is healthy. Two clause types are ambiguous by design. Shipping more model calls will not clear the queue. Lumen’s launch stack is ready and should stay frozen.",
        focus: "Hold the Lumen freeze. Surface the two Atlas clauses for the founder.",
      },
      { label: "Open the Atlas clauses", href: "/agents/cto" },
      [
        {
          id: "ctc1",
          at: "This morning",
          author: "Maya Chen",
          body: "The two Atlas clauses are tagged and waiting on founder review. I will not touch the model.",
        },
        {
          id: "ctc2",
          at: "Yesterday",
          author: "General Counsel",
          body: "Those clause types are ours, not engineering’s. Thank you for holding.",
        },
        {
          id: "ctc3",
          at: "Monday",
          author: "Sonny",
          body: "If Lumen needs a hotfix, it comes through this office, not Slack.",
        },
      ],
    ),
    desk(
      createSeat("coo", true, "in-session", "In session"),
      {
        headline: "The week is runnable. The founder calendar is not.",
        body: "Harbor’s experiment can start the day it is approved. Atlas review is a twenty-minute block, not a meeting. Northwind does not need a stand-up. Protect the founder’s afternoon from everything that looks like coordination.",
        focus: "Hold a 25-minute Harbor window and a 20-minute Atlas window. Nothing else.",
      },
      { label: "Lock today’s windows", href: "/agents/coo" },
      [
        {
          id: "coc1",
          at: "This morning",
          author: "Elias Ward",
          body: "Harbor ops is standing by. If you sign before 4, we are live before close of day.",
        },
        {
          id: "coc2",
          at: "Yesterday",
          author: "Sonny",
          body: "Do not put Northwind on my week unless something breaks.",
        },
      ],
    ),
    desk(
      createSeat("cfo", true, "awaiting-founder", "Awaiting founder"),
      {
        headline: "The Harbor test is cheap. Indecision is not.",
        body: "Cash conversion is healthy. The 14-day price test sits inside the loss band you already accepted. There is no new financial information arriving this week that would change the call.",
        focus: "Get a yes or a no on Harbor. Do not reopen the raise.",
      },
      { label: "Read the cash band", href: "/agents/cfo" },
      [
        {
          id: "cfc1",
          at: "This morning",
          author: "Priya Shah",
          body: "Downside is inside the four-percent band. I will not ask for more analysis.",
        },
        {
          id: "cfc2",
          at: "Thursday",
          author: "Sonny",
          body: "No raise until we have a price reading.",
        },
      ],
    ),
    desk(
      createSeat("cpo", true, "watching", "Watching launch"),
      {
        headline: "Lumen is ready. The product is not the remaining work.",
        body: "Public beta is Wednesday. Further product cycles are taste. Harbor does not need a new surface for the price test. Kindred’s thesis is not a sprint item.",
        focus: "Lock the Lumen line with CMO. Then stop opening tickets.",
      },
      { label: "Lock the launch line", href: "/agents/cpo" },
      [
        {
          id: "cpc1",
          at: "Yesterday",
          author: "Jonah Hale",
          body: "I have three candidate lines. CMO and I can lock one without you in the room.",
        },
        {
          id: "cpc2",
          at: "Yesterday",
          author: "CMO",
          body: "Bring the founder only if we cannot choose. We can choose.",
        },
      ],
    ),
    desk(
      createSeat("cmo", true, "in-session", "In session"),
      {
        headline: "Lumen needs one line. Harbor needs one offer. Not a campaign.",
        body: "Launch marketing for Lumen is a sentence, a page, and a list. Harbor’s test should not be dressed as a brand moment. Northwind can stay quiet.",
        focus: "Lock Lumen’s line with CPO. Keep Harbor language commercial, not cinematic.",
      },
      { label: "Choose the Lumen line", href: "/agents/cmo" },
      [
        {
          id: "cmc1",
          at: "This morning",
          author: "Amara Cole",
          body: "Short line is stronger. I will not bring the manifesto to the founder.",
        },
        {
          id: "cmc2",
          at: "Last week",
          author: "Sonny",
          body: "If Harbor needs adjectives, the offer is not clear.",
        },
      ],
    ),
    desk(
      createSeat("counsel", true, "awaiting-founder", "Awaiting founder"),
      {
        headline: "Atlas needs twenty minutes of founder judgement. Not outside counsel.",
        body: "Two clause types in the intake queue are ambiguous. They are not novel. Escalating them adds two days and no new law. Northwind’s MSA is already owned. Harbor’s test does not need a new commercial template.",
        focus: "Put the two clauses in front of the founder. Do not open a firm.",
      },
      { label: "Open the clause pack", href: "/agents/counsel" },
      [
        {
          id: "gcc1",
          at: "This morning",
          author: "Helen Voss",
          body: "The pack is two pages. I will sit with you for twenty minutes and then close the file.",
        },
        {
          id: "gcc2",
          at: "Yesterday",
          author: "CTO",
          body: "Engineering is on hold until this review exists.",
        },
      ],
    ),
    desk(
      createSeat("sales", true, "clear", "Clear — waiting on price"),
      {
        headline: "Harbor cannot sell a price the founder has not chosen.",
        body: "The book is quiet on purpose. Pushing pipeline before the test would lock last month’s offer into this week’s learning. Lumen beta is not a sales motion. Northwind is already in a rhythm you should not interrupt.",
        focus: "Stand down outbound on Harbor until the test is live. Then run the new offer only.",
      },
      { label: "Hold the Harbor book", href: "/agents/sales" },
      [
        {
          id: "sac1",
          at: "This morning",
          author: "Chris Okonkwo",
          body: "Outbound is dark. The moment you sign, we run the new offer to the named list only.",
        },
        {
          id: "sac2",
          at: "Monday",
          author: "CFO",
          body: "Do not discount inside the test. The band is the band.",
        },
      ],
    ),
  ],
});
