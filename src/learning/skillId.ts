export function createSkillId(
  skillName: string
): string {
  const normalized = skillName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) {
    throw new Error(
      `Cannot create skill ID from: "${skillName}"`
    );
  }

  return `skill_${normalized}`;
}