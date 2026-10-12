import {
  LearningTask,
  PracticalLearningPath,
  RealWorldOutcome,
  LearningDomainProfile,
} from "./types";

export interface LearningPathGenerationRequest {
  outcome: RealWorldOutcome;

  studentLevel:
    | "beginner"
    | "intermediate"
    | "advanced";

  goal: string;

  domain: string;

  preferences?: {
    platform?: string;
    framework?: string;
    language?: string;
    tools?: string[];
    approach?: string;
  };

  existingKnowledge?: string[];

  constraints?: string[];
}

export interface LearningPathGenerationResult {
  learningPath: PracticalLearningPath;
  domainProfile: LearningDomainProfile;
}

export interface LearningPathGenerator {
  generatePath(
    request: LearningPathGenerationRequest
  ): Promise<LearningPathGenerationResult>;
}

export function createLearningPathFromTasks(
  outcome: RealWorldOutcome,
  tasks: LearningTask[]
): PracticalLearningPath {
  const normalizedTasks = tasks.map(
    (task, index) => ({
      ...task,

      order: index + 1,

      status:
        index === 0
          ? ("current" as const)
          : ("available" as const),
    })
  );

  return {
    id: `path_${Date.now()}`,

    outcomeId: outcome.id,

    tasks: normalizedTasks,
  };
}