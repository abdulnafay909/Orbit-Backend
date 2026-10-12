import {
  StudentLearningState,
  StudentPreferences,
} from "./types";

import {
  generateLearningPath,
} from "./learningPathService";

import {
  buildInitialLearningState,
} from "./learningStateBuilder";

import {
  ModelRouter,
} from "../ai/router/modelRouter";

import {
  saveLearningSession,
} from "./learningSessionStore";

export interface StartLearningSessionRequest {
  studentId: string;

  domain: string;

  goal: string;

  studentLevel:
    | "beginner"
    | "intermediate"
    | "advanced";

  outcome: {
    id: string;
    title: string;
    description: string;
  };

  preferences?: StudentPreferences;

  existingKnowledge?: string[];

  constraints?: string[];
}

export async function startLearningSession(
  request: StartLearningSessionRequest,
  modelRouter: ModelRouter
): Promise<StudentLearningState> {
  const generatedLearning =
    await generateLearningPath(
      {
        domain: request.domain,

        goal: request.goal,

        studentLevel:
          request.studentLevel,

        outcome: {
  id: request.outcome.id,
  title: request.outcome.title,
  description: request.outcome.description,
  completed: false,
},

        preferences:
          request.preferences,

        existingKnowledge:
          request.existingKnowledge,

        constraints:
          request.constraints,
      },
      modelRouter
    );

  const technology =
    request.preferences
      ? {
          platform:
            request.preferences.platform,

          framework:
            request.preferences.framework,

          language:
            request.preferences.language,
        }
      : undefined;

  const learningState =
    buildInitialLearningState({
      studentId:
        request.studentId,

      domain: {
        id: request.domain
          .toLowerCase()
          .replace(/\s+/g, "-"),

        name: request.domain,
      },

      goal: {
        id: `goal_${Date.now()}`,

        description:
          request.goal,

        experienceLevel:
          request.studentLevel,

        technology,
      },

      preferences:
        request.preferences,

      existingKnowledge:
        request.existingKnowledge,

      constraints:
        request.constraints,

      outcome: {
        id: request.outcome.id,

        title:
          request.outcome.title,

        description:
          request.outcome.description,

        completed: false,
      },

      learningPath: generatedLearning.learningPath,

      domainProfile: generatedLearning.domainProfile,

    });

  return saveLearningSession(
    learningState
  );
}