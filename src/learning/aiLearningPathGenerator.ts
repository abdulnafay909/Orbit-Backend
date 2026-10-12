import {
  LearningTask,
  PracticalLearningPath,
  LearningDomainProfile,
  LearningOutcomeType,
  LearningMode,
} from "./types";
import { createSkillId } from "./skillId";
import { Type } from "@google/genai";

import {
  LearningPathGenerationRequest,
  LearningPathGenerationResult,
} from "./learningPathGenerator";

import {
  ModelRouter,
} from "../ai/router/modelRouter";
import { createAIOrchestrator } from "../ai/orchestration/aiOrchestrator";

interface GeneratedLearningPath {
  domainProfile: {
    domainLabel: string;
    outcomeType: LearningOutcomeType;
    learningMode: LearningMode;
    successSignals: string[];
    importantConsiderations: string[];
    confidence: number;
  };
  tasks: {
    title: string;
    description: string;
    requiredSkills: string[];
  }[];
}

export async function generateAILearningPath(
  request: LearningPathGenerationRequest,
  modelRouter: ModelRouter
): Promise<LearningPathGenerationResult> {
const systemPrompt = `
You are the Learning Path Designer for a universal
adaptive real-world education platform.

Your job is to create a practical learning path that helps
a specific student achieve their specific real-world outcome.

The platform supports many domains including software,
business, marketing, finance, languages, design, career
development, education, and other fields.

CORE PRINCIPLE:

The student's goal and desired outcome are the source of truth.

Do NOT assume what the student wants to learn beyond the
information provided in the request.

IMPORTANT PRINCIPLES:

1. Do not create generic textbook lessons.

2. Every task must contribute meaningfully toward the
   student's real-world outcome.

3. Teach knowledge when it becomes necessary for the
   current task.

4. The student should apply what they learn whenever
   practical application makes sense for the domain.

5. Do not assume the student must memorize everything.

6. Break large outcomes into practical, achievable tasks.

7. Progress from simpler required capabilities toward
   more advanced capabilities when the outcome requires it.

8. Adapt the path to the student's experience level.

9. Do not create unnecessary theory-only tasks.

10. Do not force every domain into a software project.

11. Do not force every learning experience to become a
    physical project.

12. Use the student's existing knowledge when it is provided.
    Do not create tasks for capabilities the student already
    demonstrates unless they are genuinely required.

13. If the student has selected a specific technology,
    framework, platform, language, tool, method, or approach,
    respect that choice.

14. Do NOT replace or casually introduce an alternative
    technology or framework when the student has already
    chosen one.

15. If the student has NOT selected a technology, framework,
    tool, or approach, do not invent one unless choosing one
    is genuinely necessary to achieve the outcome.

16. When a choice is genuinely necessary and the student has
    not made that choice, create a task that helps the student
    make an appropriate decision rather than silently assuming
    one.

17. The learning path should contain only the tasks reasonably
    needed to achieve the desired outcome.

18. The path is not a fixed curriculum. It is a practical
    plan that can later be adapted by the AI Teacher based on
    what the student demonstrates.

19. Do not create tasks merely because they are common in a
    traditional course. Create them because they are needed
    for this student's outcome.

20. Different students pursuing the same domain may receive
    different learning paths because their goals, experience,
    choices, and desired outcomes may differ.

TECHNOLOGY / PREFERENCE RULE:

Optional technology or preferences are constraints/context,
not assumptions about what the student must learn.

For example:

- If the student chooses React Native CLI, use React Native CLI.
- If the student chooses Flutter, use Flutter.
- If the student chooses Python, use Python.
- If the student does not choose a technology, remain
  technology-neutral unless a choice is required.

The same principle applies outside software.

Return ONLY valid JSON.

Also classify the learning situation using ONLY information provided by the student context.
Do not invent a hidden domain, goal, audience, technology, constraint, or success requirement.
The domain profile describes how this particular outcome should be approached, not a rigid curriculum.
Keep successSignals and importantConsiderations concise and directly relevant.

Required format:

{
  "domainProfile": {
    "domainLabel": "Business",
    "outcomeType": "LAUNCH",
    "learningMode": "EXECUTION",
    "successSignals": ["A functioning launched result"],
    "importantConsiderations": ["Use the student's stated constraints and choices"],
    "confidence": 0.9
  },
  "tasks": [
    {
      "title": "Task title",
      "description": "What the student will accomplish",
      "requiredSkills": [
        "skill_name"
      ]
    }
  ]
}
`;

const userMessage = `
DOMAIN:
${request.domain}

STUDENT GOAL:
${request.goal}

STUDENT LEVEL:
${request.studentLevel}

REAL-WORLD OUTCOME:
${request.outcome.title}

OUTCOME DESCRIPTION:
${request.outcome.description}

STUDENT PREFERENCES:
${
  request.preferences
    ? JSON.stringify(request.preferences, null, 2)
    : "No specific preferences provided."
}

EXISTING KNOWLEDGE:
${
  request.existingKnowledge &&
  request.existingKnowledge.length > 0
    ? JSON.stringify(request.existingKnowledge, null, 2)
    : "No existing knowledge provided."
}

CONSTRAINTS:
${
  request.constraints &&
  request.constraints.length > 0
    ? JSON.stringify(request.constraints, null, 2)
    : "No specific constraints provided."
}

Create the practical learning path for THIS student.

IMPORTANT:

The information above is the student's actual context.

If the student has explicitly selected a technology,
framework, platform, language, tool, method, or approach,
you MUST use that choice.

Do NOT create a task asking the student to select or
evaluate an alternative when the student has already
made that choice.

Do NOT replace the student's selected technology,
framework, platform, language, tool, or approach.

Only create a decision/selection task when the relevant
choice has genuinely NOT been made.

Do not assume additional goals, technologies, tools,
projects, or preferences that were not provided.
`;
const responseSchema = {
  type: Type.OBJECT,

  properties: {
    domainProfile: {
      type: Type.OBJECT,
      properties: {
        domainLabel: { type: Type.STRING },
        outcomeType: {
          type: Type.STRING,
          enum: ["BUILD", "LAUNCH", "CREATE", "PERFORM", "ANALYZE", "IMPROVE", "DECIDE", "PRACTICE", "ACHIEVE", "OTHER"],
        },
        learningMode: {
          type: Type.STRING,
          enum: ["BUILDING", "EXECUTION", "PRACTICE", "ANALYSIS", "CREATION", "DECISION", "MIXED"],
        },
        successSignals: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        importantConsiderations: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        confidence: { type: Type.NUMBER },
      },
      required: ["domainLabel", "outcomeType", "learningMode", "successSignals", "importantConsiderations", "confidence"],
    },
    tasks: {
      type: Type.ARRAY,

      items: {
        type: Type.OBJECT,

        properties: {
          title: {
            type: Type.STRING,
          },

          description: {
            type: Type.STRING,
          },

          requiredSkills: {
            type: Type.ARRAY,

            items: {
              type: Type.STRING,
            },
          },
        },

        required: [
          "title",
          "description",
          "requiredSkills",
        ],
      },
    },
  },

  required: ["tasks"],
};

 const orchestrator = createAIOrchestrator(modelRouter);
 const response = await orchestrator.generate({
    operation: "learning-path-generation",
    expectJson: true,
    systemPrompt,
    userMessage,
    responseSchema,
  }
);

  let parsed: GeneratedLearningPath;

  try {
    parsed = JSON.parse(response.text);
  } catch {
    throw new Error(
      "AI learning path response could not be processed. Please try again in a moment."
    );
  }

  if (!parsed || !parsed.domainProfile || typeof parsed.domainProfile !== "object") {
    throw new Error("AI learning path must contain a domainProfile");
  }

  const profile = parsed.domainProfile;
  const validOutcomeTypes: LearningOutcomeType[] = ["BUILD", "LAUNCH", "CREATE", "PERFORM", "ANALYZE", "IMPROVE", "DECIDE", "PRACTICE", "ACHIEVE", "OTHER"];
  const validLearningModes: LearningMode[] = ["BUILDING", "EXECUTION", "PRACTICE", "ANALYSIS", "CREATION", "DECISION", "MIXED"];

  if (
    typeof profile.domainLabel !== "string" ||
    !validOutcomeTypes.includes(profile.outcomeType) ||
    !validLearningModes.includes(profile.learningMode) ||
    !Array.isArray(profile.successSignals) ||
    !Array.isArray(profile.importantConsiderations) ||
    typeof profile.confidence !== "number"
  ) {
    throw new Error("Invalid AI domain profile");
  }

  if (
    !parsed ||
    !Array.isArray(parsed.tasks)
  ) {
    throw new Error(
      "AI learning path must contain a tasks array"
    );
  }

  if (parsed.tasks.length === 0) {
    throw new Error(
      "AI learning path cannot be empty"
    );
  }

  const tasks: LearningTask[] =
    parsed.tasks.map((task, index) => {
      if (
        !task ||
        typeof task.title !== "string" ||
        typeof task.description !== "string" ||
        !Array.isArray(task.requiredSkills)
      ) {
        throw new Error(
          `Invalid learning task at index ${index}`
        );
      }

      return {
        id: `task_${index + 1}`,

        title: task.title,

        description: task.description,

        status:
          index === 0
            ? "current"
            : "available",

       requiredSkills:
  task.requiredSkills.map(
    (skill) => createSkillId(String(skill))
  ),

        order: index + 1,
      };
    });

  const domainProfile: LearningDomainProfile = {
    domainLabel: profile.domainLabel.trim(),
    outcomeType: profile.outcomeType,
    learningMode: profile.learningMode,
    successSignals: profile.successSignals.filter((value) => typeof value === "string" && value.trim()).slice(0, 6),
    importantConsiderations: profile.importantConsiderations.filter((value) => typeof value === "string" && value.trim()).slice(0, 6),
    confidence: Math.max(0, Math.min(1, profile.confidence)),
  };

  return {
    learningPath: {
      id: `path_${Date.now()}`,
      outcomeId: request.outcome.id,
      tasks,
    },
    domainProfile,
  };
}