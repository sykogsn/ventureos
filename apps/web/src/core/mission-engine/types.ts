import type { AttentionWindow } from "../shared";

export type MissionTask = {
  id: string;
  title: string;
  owner: string;
};

export type Sprint = {
  name: string;
  objective: string;
  tasks: MissionTask[];
};

export type TodaysMission = {
  title: string;
  ask: string;
  whyNow: string;
  ifDeferred: string;
  timeNeeded: string;
  actionLabel: string;
  actionHref: string;
  attention: AttentionWindow;
  founderAsk: string;
  active: boolean;
};

export type MissionEngine = {
  today: TodaysMission;
  sprint: Sprint;
};
