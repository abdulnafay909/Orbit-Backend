import { GoogleGenAI, Type } from "@google/genai";

import {
  ModelProvider,
  ModelRequest,
  ModelResponse,
} from "../modelProvider";

export class GeminiProvider implements ModelProvider {
  private client: GoogleGenAI;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY is not configured"
      );
    }

    this.client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }

  async generateResponse(
    request: ModelRequest
  ): Promise<ModelResponse> {
    const maxAttempts = 3;

    const contextText = request.context
      ? `

STUDENT LEARNING CONTEXT:
${JSON.stringify(request.context, null, 2)}
`
      : "";

    const fullPrompt = `${request.userMessage}

${contextText}`;

    for (
      let attempt = 1;
      attempt <= maxAttempts;
      attempt++
    ) {
      try {
        const response =
          await this.client.models.generateContent({
            model: "gemini-3.5-flash-lite",
            contents: fullPrompt,

            config: {
  systemInstruction:
    request.systemPrompt,

  responseMimeType:
    "application/json",

  ...(request.responseSchema
    ? {
        responseSchema:
          request.responseSchema,
      }
    : {
        responseSchema: {
          type: Type.OBJECT,

          properties: {
            action: {
              type: Type.STRING,
              enum: [
                "TEACH",
                "ASK_QUESTION",
                "GIVE_EXERCISE",
                "GIVE_HINT",
                "ASSESS",
                "COMPLETE_TASK",
                "MOVE_TO_NEXT_TASK",
                "REVIEW",
                "CLARIFY",
              ],
            },

            response: {
              type: Type.STRING,
            },

            skillUpdates: {
              type: Type.ARRAY,

              items: {
                type: Type.OBJECT,

                properties: {
                  skillId: {
                    type: Type.STRING,
                  },

                  status: {
                    type: Type.STRING,
                    enum: [
                      "unknown",
                      "learning",
                      "developing",
                      "demonstrated",
                      "mastered",
                    ],
                  },

                  reason: {
                    type: Type.STRING,
                  },

                  evidence: {
                    type: Type.STRING,
                  },
                },

                required: [
                  "skillId",
                  "status",
                  "reason",
                  "evidence",
                ],
              },
            },

            taskCompleted: {
              type: Type.BOOLEAN,
            },

            moveToNextTask: {
              type: Type.BOOLEAN,
            },

            nextTaskId: {
              type: Type.STRING,
              nullable: true,
            },

            confidence: {
              type: Type.NUMBER,
              minimum: 0,
              maximum: 1,
            },
            guidanceLevel: {
  type: Type.STRING,

  enum: [
    "NONE",
    "HINT",
    "EXPLANATION",
    "EXAMPLE",
    "STRONGER_GUIDANCE",
    "DIRECT_ASSISTANCE",
  ],
},

evidence: {
  type: Type.OBJECT,

  properties: {
    type: {
      type: Type.STRING,

      enum: [
        "NONE",
        "SELF_REPORT",
        "DEMONSTRATED_ACTION",
        "OUTPUT",
        "RESULT",
        "ERROR",
        "REAL_WORLD_RESULT",
        "OTHER",
      ],
    },

    summary: {
      type: Type.STRING,
    },

    sufficientForTaskCompletion: {
      type: Type.BOOLEAN,
    },

    sufficientForOutcomeCompletion: {
      type: Type.BOOLEAN,
    },
  },

  required: [
    "type",
    "summary",
    "sufficientForTaskCompletion",
    "sufficientForOutcomeCompletion",
  ],
},

adaptation: {
  type: Type.STRING,

  enum: [
    "NONE",
    "CONTINUE",
    "SIMPLIFY",
    "INCREASE_CHALLENGE",
    "REVISIT_KNOWLEDGE",
    "CLARIFY_GOAL",
    "HANDLE_BLOCKER",
    "SKIP_KNOWN_CONTENT",
    "COMPLETE_OUTCOME",
  ],
},

pathChange: {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: ["NONE", "INSERT_SUPPORT", "SIMPLIFY_CURRENT", "INCREASE_CURRENT_CHALLENGE", "SKIP_CURRENT"],
    },
    title: { type: Type.STRING, nullable: true },
    description: { type: Type.STRING, nullable: true },
    requiredSkills: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
  },
  required: ["type", "title", "description", "requiredSkills"],
},
          },

          required: [
            "action",
            "response",
            "skillUpdates",
            "taskCompleted",
            "moveToNextTask",
           "nextTaskId",
"confidence",
"guidanceLevel",
"evidence",
"adaptation",
          ],
        },
      }),
},
          });

        return {
          text: response.text ?? "",
          provider: "gemini",
          model: "gemini-3.5-flash-lite",
        };
      } catch (error: any) {
        const status = error?.status;

        if (
          (status === 429 || status === 503) &&
          attempt < maxAttempts
        ) {
          const delay =
            Math.pow(2, attempt) * 1000 +
            Math.floor(Math.random() * 1000);

          console.log(
            `Gemini temporarily unavailable. Retrying in ${delay}ms...`
          );

          await new Promise((resolve) =>
            setTimeout(resolve, delay)
          );

          continue;
        }

        throw error;
      }
    }

    throw new Error(
      "Gemini request failed"
    );
  }
}