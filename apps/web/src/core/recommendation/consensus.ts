import { roleCatalog, type ExecutiveOffice, type ExecutiveRoleId } from "../executive-office";
import type { Venture } from "../venture/types";
import { consensusLabel } from "./confidence";
import type { ConsensusVote, ExecutiveConsensus } from "./types";

const floorRoles: ExecutiveRoleId[] = [
  "founder",
  "cto",
  "coo",
  "cfo",
  "cpo",
  "cmo",
  "counsel",
  "sales",
];

function voteFor(
  roleId: ExecutiveRoleId,
  allied: Set<ExecutiveRoleId>,
  office: ExecutiveOffice,
  venture: Venture,
): ConsensusVote {
  const desk = office.desks.find((item) => item.seat.id === roleId);
  const ownsOpenDecision = venture.decisions.items.some(
    (item) => item.ownerRoleId === roleId && item.status === "upcoming",
  );
  const status = desk?.seat.status;

  let stance: ConsensusVote["stance"] = "silent";
  let note = "No signal from this desk.";

  if (allied.has(roleId)) {
    stance = "agree";
    note = ownsOpenDecision
      ? "Owns an open decision on this company."
      : status === "awaiting-founder"
        ? "Waiting on the founder call this recommendation requires."
        : "Facts on this desk point the same way.";
  } else if (status === "watching" && !allied.has(roleId)) {
    stance = "silent";
    note = "Watching. Not a dissenting vote.";
  } else if (venture.mission.today.attention === "hold" && roleId === "founder") {
    stance = "agree";
    note = "Founder attention is already allocated away from this company.";
  }

  return {
    roleId,
    role: roleCatalog[roleId].role,
    stance,
    note,
  };
}

export function buildConsensus(
  office: ExecutiveOffice,
  venture: Venture,
  alliedRoles: ExecutiveRoleId[],
): ExecutiveConsensus {
  const allied = new Set(alliedRoles);
  const votes = floorRoles.map((roleId) =>
    voteFor(roleId, allied, office, venture),
  );
  const counted = votes.filter((vote) => vote.stance !== "silent");
  const agrees = counted.filter((vote) => vote.stance === "agree").length;
  const alignment =
    counted.length === 0 ? 50 : Math.round((agrees / counted.length) * 100);

  return {
    alignment,
    label: consensusLabel(alignment),
    votes,
  };
}
