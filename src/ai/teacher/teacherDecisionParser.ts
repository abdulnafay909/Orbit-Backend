import { TeacherAction, TeacherDecision, GuidanceLevel, EvidenceType, AdaptationType, PathChangeType } from "./teacherDecision";

const VALID_SKILL_STATUSES = ["unknown", "learning", "developing", "demonstrated", "mastered"] as const;
const VALID_ACTIONS: TeacherAction[] = ["TEACH", "ASK_QUESTION", "GIVE_EXERCISE", "GIVE_HINT", "ASSESS", "COMPLETE_TASK", "MOVE_TO_NEXT_TASK", "REVIEW", "CLARIFY"];
const VALID_GUIDANCE_LEVELS: GuidanceLevel[] = ["NONE", "HINT", "EXPLANATION", "EXAMPLE", "STRONGER_GUIDANCE", "DIRECT_ASSISTANCE"];
const VALID_EVIDENCE_TYPES: EvidenceType[] = ["NONE", "SELF_REPORT", "DEMONSTRATED_ACTION", "OUTPUT", "RESULT", "ERROR", "REAL_WORLD_RESULT", "OTHER"];
const VALID_PATH_CHANGES: PathChangeType[] = ["NONE", "INSERT_SUPPORT", "SIMPLIFY_CURRENT", "INCREASE_CURRENT_CHALLENGE", "SKIP_CURRENT"];
const VALID_ADAPTATIONS: AdaptationType[] = ["NONE", "CONTINUE", "SIMPLIFY", "INCREASE_CHALLENGE", "REVISIT_KNOWLEDGE", "CLARIFY_GOAL", "HANDLE_BLOCKER", "SKIP_KNOWN_CONTENT", "COMPLETE_OUTCOME"];

const isStringIn = <T extends string>(value: unknown, values: readonly T[]): value is T => typeof value === "string" && values.includes(value as T);
const clampConfidence = (value: unknown): number => typeof value === "number" && !Number.isNaN(value) ? Math.max(0, Math.min(1, value)) : 0;

export function parseTeacherDecision(value: unknown): TeacherDecision {
  if (!value || typeof value !== "object") throw new Error("Invalid teacher decision: expected an object");
  const data = value as Record<string, unknown>;
  if (!isStringIn(data.action, VALID_ACTIONS)) throw new Error(`Invalid teacher action: ${String(data.action)}`);
  if (typeof data.response !== "string" || !data.response.trim()) throw new Error("Invalid teacher decision: response is required");

  const rawSkillUpdates = Array.isArray(data.skillUpdates) ? data.skillUpdates : [];
  const skillUpdates = rawSkillUpdates.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`Invalid skill update at index ${index}`);
    const skill = raw as Record<string, unknown>;
    if (typeof skill.skillId !== "string") throw new Error(`Invalid skillId at index ${index}`);
    if (!isStringIn(skill.status, VALID_SKILL_STATUSES)) throw new Error(`Invalid skill status at index ${index}`);
    if (typeof skill.reason !== "string") throw new Error(`Invalid skill update reason at index ${index}`);
    if (typeof skill.evidence !== "string") throw new Error(`Invalid skill update evidence at index ${index}`);
    return { skillId: skill.skillId, status: skill.status, reason: skill.reason, evidence: skill.evidence };
  });

  const rawPathChange = data.pathChange && typeof data.pathChange === "object"
    ? data.pathChange as Record<string, unknown>
    : {};
  const rawRequiredSkills = Array.isArray(rawPathChange.requiredSkills)
    ? rawPathChange.requiredSkills.filter((value): value is string => typeof value === "string")
    : undefined;

  const rawEvidence = data.evidence && typeof data.evidence === "object" ? data.evidence as Record<string, unknown> : {};
  return {
    action: data.action,
    response: data.response,
    skillUpdates,
    taskCompleted: data.taskCompleted === true,
    moveToNextTask: data.moveToNextTask === true,
    nextTaskId: typeof data.nextTaskId === "string" ? data.nextTaskId : undefined,
    confidence: clampConfidence(data.confidence),
    guidanceLevel: isStringIn(data.guidanceLevel, VALID_GUIDANCE_LEVELS) ? data.guidanceLevel : "NONE",
    evidence: {
      type: isStringIn(rawEvidence.type, VALID_EVIDENCE_TYPES) ? rawEvidence.type : "NONE",
      summary: typeof rawEvidence.summary === "string" ? rawEvidence.summary : "",
      sufficientForTaskCompletion: rawEvidence.sufficientForTaskCompletion === true,
      sufficientForOutcomeCompletion: rawEvidence.sufficientForOutcomeCompletion === true,
    },
    adaptation: isStringIn(data.adaptation, VALID_ADAPTATIONS) ? data.adaptation : "NONE",
    pathChange: {
      type: isStringIn(rawPathChange.type, VALID_PATH_CHANGES) ? rawPathChange.type : "NONE",
      title: typeof rawPathChange.title === "string" ? rawPathChange.title : undefined,
      description: typeof rawPathChange.description === "string" ? rawPathChange.description : undefined,
      requiredSkills: rawRequiredSkills,
    },
  };
}
