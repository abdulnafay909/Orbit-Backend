import {
  StudentLearningState,
  CourseDomain,
  StudentGoal,
  RealWorldOutcome,
  PracticalLearningPath,
  StudentPreferences,
  LearningDomainProfile,
} from "./types";

import { extractSkillsFromTasks } from "./learningPathSkills";
import { createInitialLongTermMemory } from "./longTermMemory";

export interface LearningStateBuildRequest {
  studentId: string;

  domain: CourseDomain;

  goal: StudentGoal;

  preferences?: StudentPreferences;

  existingKnowledge?: string[];

  constraints?: string[];

  outcome: RealWorldOutcome;

  learningPath: PracticalLearningPath;

  domainProfile: LearningDomainProfile;
}

export function buildInitialLearningState(
  request: LearningStateBuildRequest
): StudentLearningState {
  const skills = extractSkillsFromTasks(
    request.learningPath.tasks
  );

  const currentTask =
    request.learningPath.tasks.find(
      (task) => task.status === "current"
    );

  return {
    studentId: request.studentId,

    course: request.domain,

    domainProfile: request.domainProfile,

    goal: request.goal,

    preferences: request.preferences,

    existingKnowledge:
      request.existingKnowledge,

    constraints:
      request.constraints,

    outcome: request.outcome,

    outcomeVerification: {
      status: "NOT_STARTED",
      summary: "",
      confidence: 0,
      lastEvidenceType: "NONE",
      updatedAt: new Date().toISOString(),
    },

    outcomeEvidence: [],

    learningPath: request.learningPath,

    skills,

    currentTaskId:
      currentTask?.id,

    completedTaskIds: [],

    skippedTaskIds: [],

    learningHistory: [
      "Learning path created",
    ],

    conversationHistory: [],

    longTermMemory: createInitialLongTermMemory({
      existingKnowledge: request.existingKnowledge,
      preferences: request.preferences,
    }),
  };
}