import { Skill, SkillStatus } from "./types";

export function createSkill(
  id: string,
  name: string,
  description?: string
): Skill {
  return {
    id,
    name,
    description,
    status: "unknown",
  };
}

export function updateSkillStatus(
  skills: Skill[],
  skillId: string,
  status: SkillStatus
): Skill[] {
  return skills.map((skill) => {
    if (skill.id !== skillId) {
      return skill;
    }

    return {
      ...skill,
      status,
    };
  });
}

export function getSkill(
  skills: Skill[],
  skillId: string
): Skill | undefined {
  return skills.find((skill) => skill.id === skillId);
}

export function getDemonstratedSkills(
  skills: Skill[]
): Skill[] {
  return skills.filter(
    (skill) =>
      skill.status === "demonstrated" ||
      skill.status === "mastered"
  );
}

export function getSkillsBeingLearned(
  skills: Skill[]
): Skill[] {
  return skills.filter(
    (skill) =>
      skill.status === "learning" ||
      skill.status === "developing"
  );
}

export function hasDemonstratedSkill(
  skills: Skill[],
  skillId: string
): boolean {
  const skill = getSkill(skills, skillId);

  return (
    skill?.status === "demonstrated" ||
    skill?.status === "mastered"
  );
}
export function isValidSkillTransition(
  currentStatus: SkillStatus,
  nextStatus: SkillStatus
): boolean {
  const allowedTransitions: Record<
    SkillStatus,
    SkillStatus[]
  > = {
    unknown: [
      "unknown",
      "learning",
      "developing",
      "demonstrated",
    ],

    learning: [
      "learning",
      "developing",
      "demonstrated",
    ],

    developing: [
      "developing",
      "demonstrated",
    ],

    demonstrated: [
      "demonstrated",
      "mastered",
    ],

    mastered: [
      "mastered",
    ],
  };

  return allowedTransitions[currentStatus].includes(
    nextStatus
  );
}