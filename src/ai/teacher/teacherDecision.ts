import { SkillStatus } from "../../learning/types";

export type TeacherAction =
  | "TEACH"
  | "ASK_QUESTION"
  | "GIVE_EXERCISE"
  | "GIVE_HINT"
  | "ASSESS"
  | "COMPLETE_TASK"
  | "MOVE_TO_NEXT_TASK"
  | "REVIEW"
  | "CLARIFY";

export type GuidanceLevel =
  | "NONE"
  | "HINT"
  | "EXPLANATION"
  | "EXAMPLE"
  | "STRONGER_GUIDANCE"
  | "DIRECT_ASSISTANCE";

export type EvidenceType =
  | "NONE"
  | "SELF_REPORT"
  | "DEMONSTRATED_ACTION"
  | "OUTPUT"
  | "RESULT"
  | "ERROR"
  | "REAL_WORLD_RESULT"
  | "OTHER";

export type AdaptationType =
  | "NONE"
  | "CONTINUE"
  | "SIMPLIFY"
  | "INCREASE_CHALLENGE"
  | "REVISIT_KNOWLEDGE"
  | "CLARIFY_GOAL"
  | "HANDLE_BLOCKER"
  | "SKIP_KNOWN_CONTENT"
  | "COMPLETE_OUTCOME";

export interface SkillUpdate {
  skillId: string;
  status: SkillStatus;
  reason: string;
  evidence: string;
}

export interface TeacherEvidence {
  type: EvidenceType;
  summary: string;
  sufficientForTaskCompletion: boolean;
  sufficientForOutcomeCompletion: boolean;
}

export type PathChangeType =
  | "NONE"
  | "INSERT_SUPPORT"
  | "SIMPLIFY_CURRENT"
  | "INCREASE_CURRENT_CHALLENGE"
  | "SKIP_CURRENT";

export interface PathChange {
  type: PathChangeType;
  title?: string;
  description?: string;
  requiredSkills?: string[];
}

export interface TeacherDecision {
  action: TeacherAction;
  response: string;
  skillUpdates: SkillUpdate[];
  taskCompleted: boolean;
  moveToNextTask: boolean;
  nextTaskId?: string;
  confidence: number;
  guidanceLevel: GuidanceLevel;
  evidence: TeacherEvidence;
  adaptation: AdaptationType;
  pathChange: PathChange;
}
