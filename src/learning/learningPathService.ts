import {
  LearningPathGenerationRequest,
} from "./learningPathGenerator";

import {
  generateAILearningPath,
} from "./aiLearningPathGenerator";

import {
  validateLearningPath,
} from "./learningPathValidator";

import {
  PracticalLearningPath,
  LearningDomainProfile,
} from "./types";

import {
  ModelRouter,
} from "../ai/router/modelRouter";

export async function generateLearningPath(
  request: LearningPathGenerationRequest,
  modelRouter: ModelRouter
): Promise<{ learningPath: PracticalLearningPath; domainProfile: LearningDomainProfile }> {
  const generatedPath =
    await generateAILearningPath(
      request,
      modelRouter
    );

  const validatedPath =
    validateLearningPath(
      generatedPath.learningPath
    );

  return {
    learningPath: validatedPath,
    domainProfile: generatedPath.domainProfile,
  };
}