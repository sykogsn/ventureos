import type {
  ExecutiveDesk,
  ExecutiveOffice,
  ExecutiveRoleId,
  ExecutiveSeat,
} from "./types";

export const roleCatalog: Record<
  ExecutiveRoleId,
  Pick<ExecutiveSeat, "role" | "name" | "remit">
> = {
  founder: {
    role: "Founder",
    name: "Sonny",
    remit: "Judgement, capital of attention, and the calls no seat can make.",
  },
  cto: {
    role: "CTO",
    name: "Maya Chen",
    remit: "Architecture, reliability, and what the Executive Office is allowed to automate.",
  },
  coo: {
    role: "COO",
    name: "Elias Ward",
    remit: "Cadence, owners, and whether the week actually happens.",
  },
  cfo: {
    role: "CFO",
    name: "Priya Shah",
    remit: "Runway, price, and the difference between caution and stalling.",
  },
  cpo: {
    role: "CPO",
    name: "Jonah Hale",
    remit: "What ships, what waits, and the line the market can repeat.",
  },
  cmo: {
    role: "CMO",
    name: "Amara Cole",
    remit: "The story the market hears, and the stories you should stop telling.",
  },
  counsel: {
    role: "General Counsel",
    name: "Helen Voss",
    remit: "Risk that is real, and process that only looks like care.",
  },
  sales: {
    role: "Head of Sales",
    name: "Chris Okonkwo",
    remit: "Pipeline that is real, and motion that is not theatre.",
  },
};

export const executiveRoleOrder: ExecutiveRoleId[] = [
  "founder",
  "cto",
  "coo",
  "cfo",
  "cpo",
  "cmo",
  "counsel",
  "sales",
];

export function createSeat(
  id: ExecutiveRoleId,
  seated: boolean,
  status: ExecutiveSeat["status"] = "clear",
  statusLabel = "Clear",
): ExecutiveSeat {
  return {
    id,
    ...roleCatalog[id],
    seated,
    status,
    statusLabel,
  };
}

export function findDesk(office: ExecutiveOffice, id: ExecutiveRoleId) {
  return office.desks.find((desk) => desk.seat.id === id);
}

export function seatedDesks(office: ExecutiveOffice) {
  return office.desks.filter((desk) => desk.seat.seated);
}

export function createOffice(input: ExecutiveOffice): ExecutiveOffice {
  return {
    ...input,
    desks: input.desks.map((desk): ExecutiveDesk => ({ ...desk })),
  };
}

export function createDefaultLeadershipOffice(): ExecutiveOffice {
  return createOffice({
    enabled: true,
    posture: "Seated.",
    worldLine: "The Executive Office is ready when the founder is.",
    desks: executiveRoleOrder.map((id) => ({
      seat: createSeat(id, true, "clear", "Seated"),
      brief: {
        headline: `${roleCatalog[id].role} desk`,
        body: roleCatalog[id].remit,
        focus: "Wait for the first company constraint.",
      },
      primaryAction: { label: "Open the floor", href: "/agents" },
      correspondence: [],
    })),
  });
}
