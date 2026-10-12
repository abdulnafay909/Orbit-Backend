import {
  LearningTask,
  Skill,
} from "./types";

export function extractSkillsFromTasks(
  tasks: LearningTask[]
): Skill[] {
  const skillMap = new Map<string, Skill>();

  for (const task of tasks) {
    for (const skillId of task.requiredSkills) {
      if (skillMap.has(skillId)) {
        continue;
      }

      const name = skillId
        .replace(/^skill_/, "")
        .split("_")
        .map(
          (word) =>
            word.charAt(0).toUpperCase() +
            word.slice(1)
        )
        .join(" ");

      skillMap.set(skillId, {
        id: skillId,
        name,
        status: "unknown",
      });
    }
  }

  return Array.from(skillMap.values());
}