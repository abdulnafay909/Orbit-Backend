export type ExperienceLevel =
  | "beginner"
  | "intermediate"
  | "advanced";

export type TaskStatus =
  | "locked"
  | "available"
  | "current"
  | "completed"
  | "skipped";

export type SkillStatus =
  | "unknown"
  | "learning"
  | "developing"
  | "demonstrated"
  | "mastered";

export interface CourseDomain {
  id: string;
  name: string;
  description?: string;
}

export interface StudentPreferences {
  platform?: string;
  framework?: string;
  language?: string;
  tools?: string[];
  approach?: string;
}

export interface StudentGoal {
  id: string;
  description: string;
  experienceLevel: ExperienceLevel;
  technology?: {
    platform?: string;
    framework?: string;
    language?: string;
    target?: string;
  };
}

export interface RealWorldOutcome {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  completionEvidence?: string;
}

export interface Skill {
  id: string;
  name: string;
  description?: string;
  status: SkillStatus;
}

export interface LearningTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  requiredSkills: string[];
  order: number;
  completionEvidence?: string;
  completionEvidenceType?: string;
}

export interface PracticalLearningPath {
  id: string;
  outcomeId: string;
  tasks: LearningTask[];
}

export interface ConversationMessage {
  role: "student" | "teacher";
  content: string;
  timestamp: string;
}



export type LongTermMemoryCategory =
  | "KNOWN_CAPABILITY"
  | "STRENGTH"
  | "STRUGGLE"
  | "PREFERENCE"
  | "ACCOMPLISHMENT"
  | "ACTIVE_FOCUS"
  | "IMPORTANT_CONTEXT";

export interface LongTermMemoryEntry {
  id: string;
  category: LongTermMemoryCategory;
  content: string;
  evidence: string;
  confidence: number;
  occurrences: number;
  firstObservedAt: string;
  lastObservedAt: string;
}

export interface LongTermLearningMemory {
  entries: LongTermMemoryEntry[];
  updatedAt: string;
}

export type OutcomeVerificationStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED";

export interface OutcomeEvidenceRecord {
  id: string;
  type: string;
  summary: string;
  confidence: number;
  source: "STUDENT_MESSAGE" | "TEACHER_INFERENCE";
  timestamp: string;
}

export interface OutcomeVerification {
  status: OutcomeVerificationStatus;
  summary: string;
  confidence: number;
  lastEvidenceType: string;
  updatedAt: string;
}

export type LearningOutcomeType =
  | "BUILD"
  | "LAUNCH"
  | "CREATE"
  | "PERFORM"
  | "ANALYZE"
  | "IMPROVE"
  | "DECIDE"
  | "PRACTICE"
  | "ACHIEVE"
  | "OTHER";

export type LearningMode =
  | "BUILDING"
  | "EXECUTION"
  | "PRACTICE"
  | "ANALYSIS"
  | "CREATION"
  | "DECISION"
  | "MIXED";

export interface LearningDomainProfile {
  domainLabel: string;
  outcomeType: LearningOutcomeType;
  learningMode: LearningMode;
  successSignals: string[];
  importantConsiderations: string[];
  confidence: number;
}

export interface StudentLearningState {
  studentId: string;
  course: CourseDomain;
  domainProfile: LearningDomainProfile;
  goal: StudentGoal;
  preferences?: StudentPreferences;
  existingKnowledge?: string[];
  constraints?: string[];
  outcome: RealWorldOutcome;
  outcomeVerification: OutcomeVerification;
  outcomeEvidence: OutcomeEvidenceRecord[];
  learningPath: PracticalLearningPath;
  skills: Skill[];
  currentTaskId?: string;
  completedTaskIds: string[];
  skippedTaskIds: string[];
  learningHistory: string[];
  conversationHistory: ConversationMessage[];
  longTermMemory: LongTermLearningMemory;
}
