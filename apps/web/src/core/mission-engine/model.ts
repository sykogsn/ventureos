import type { MissionEngine, Sprint, TodaysMission } from "./types";

export function createMissionEngine(input: MissionEngine): MissionEngine {
  return {
    today: { ...input.today },
    sprint: {
      ...input.sprint,
      tasks: [...input.sprint.tasks],
    },
  };
}

export function isActiveMission(mission: TodaysMission) {
  return mission.active;
}

export function sprintTasks(sprint: Sprint) {
  return sprint.tasks;
}
