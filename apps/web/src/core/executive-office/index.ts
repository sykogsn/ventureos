export type {
  CorrespondenceNote,
  ExecutiveAction,
  ExecutiveBrief,
  ExecutiveDesk,
  ExecutiveOffice,
  ExecutiveRoleId,
  ExecutiveSeat,
  OperatingStatus,
} from "./types";
export {
  createDefaultLeadershipOffice,
  createOffice,
  createSeat,
  executiveRoleOrder,
  findDesk,
  roleCatalog,
  seatedDesks,
} from "./model";
export { leadershipOfficeMock } from "./mock";
