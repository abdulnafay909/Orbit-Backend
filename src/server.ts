import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  TeacherMode,
  TEACHER_MODES,
} from "./ai/teacher/teacherModes";
import { createProviderRegistry } from "./ai/router/providerRegistry";
import { createModelRouter } from "./ai/router/modelRouter";
import { generateTeacherResponse } from "./ai/teacher/teacherService";
import { createAIOrchestrator } from "./ai/orchestration/aiOrchestrator";
import { generateLearningPath } from "./learning/learningPathService";
import {
  startLearningSession,
} from "./learning/learningSessionService";
import {
  getLearningSession,
  updateLearningSession,
} from "./learning/learningSessionStore";
import { checkDatabaseConnection } from "./db/database";
import { ensureDatabaseSchema } from "./db/migrate";
import { getOutcomeVerificationSummary } from "./learning/progressEngine";
import { authRouter } from "./auth/authRoutes";
import { requireAuth } from "./auth/authMiddleware";
import { AuthenticatedRequest } from "./auth/authTypes";
import { assertStudentOwnership } from "./auth/authService";
import { chatRouter } from "./chat/chatRoutes";
import { getOrCreateGeneralConversation, addMessage as addChatMessage, getConversation, getRecentMessages } from "./chat/chatService";
import { createFeatureRouter } from "./features";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

/**
 * Normalize provider output for General Chat. Some models return JSON even
 * when asked for plain text; the UI should receive only the human-readable answer.
 */
function normalizeGeneralAnswer(rawText: string): string {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  if (!cleaned) {
    return "I’m sorry, I couldn’t generate a response. Please try again.";
  }

  try {
    const parsed: unknown = JSON.parse(cleaned);

    if (typeof parsed === "string") {
      return parsed.trim() || cleaned;
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      for (const key of ["response", "answer", "content", "message", "text"]) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }
    }
  } catch {
    // Normal conversational text is not JSON; keep it as-is.
  }

  return cleaned;
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", authRouter);
app.use("/api/chats", chatRouter);

const providers = createProviderRegistry();

const modelRouter = createModelRouter(providers);
const aiOrchestrator = createAIOrchestrator(modelRouter);
app.use("/api/features", createFeatureRouter(aiOrchestrator));

app.get("/api/ai/providers", (_req, res) => {
  const configuredProviders = Object.keys(providers);

  return res.json({
    success: true,
    primaryProvider:
      process.env.AI_PRIMARY_PROVIDER || "gemini",
    fallbackProviders: process.env.AI_FALLBACK_PROVIDERS
      ? process.env.AI_FALLBACK_PROVIDERS
          .split(",")
          .map((provider) => provider.trim())
          .filter(Boolean)
      : [],
    providers: configuredProviders,
  });
});
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "ORBIT backend is running",
  });
});

app.post("/api/ai/test", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        success: false,
        message: "A valid message is required",
      });
    }

    const response = await aiOrchestrator.generate({
      operation: "ai-test",
      systemPrompt: "You are ORBIT, a helpful AI assistant. Explain concepts clearly and simply.",
      userMessage: message,
    });

    res.json({
      success: true,
      response,
    });
  } catch (error) {
    console.error("AI test error:", error);

    res.status(500).json({
      success: false,
      message: "AI request failed",
    });
  }
});

app.post(
  "/api/teacher/respond",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        studentId,
        message,
        mode,
        conversationHistory,
        conversationId,
      } = req.body ?? {};

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      if (
        !mode ||
        typeof mode !== "string" ||
        !Object.prototype.hasOwnProperty.call(TEACHER_MODES, mode)
      ) {
        return res.status(400).json({
          success: false,
          message: "A valid teacher mode is required",
        });
      }

      if (
        typeof message !== "string" ||
        !message.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "A valid message is required",
        });
      }

      if (message.length > 20000) {
        return res.status(413).json({
          success: false,
          message: "Message is too long. Please keep it under 20,000 characters.",
        });
      }

      const teacherMode = mode as TeacherMode;

      /*
       * GENERAL CHAT IS SESSION-INDEPENDENT.
       *
       * It must not read, create, or update a learning session. This path
       * intentionally bypasses generateTeacherResponse(), whose contract is
       * designed for learning-state decisions and requires StudentLearningState.
       *
       * Clients may send recent general conversation messages so ORBIT can
       * continue the current chat without importing any course context.
       */
      if (teacherMode === "GENERAL_TEACHER") {
        /*
         * GENERAL CHAT MEMORY
         *
         * The database conversation is the authoritative memory for the active
         * chat. The client may also send history for compatibility, but we do
         * not depend on it: this prevents a fresh frontend render from
         * accidentally resetting ORBIT's context.
         */
        const conversation =
          typeof conversationId === "string" && conversationId.trim()
            ? await getConversation(req.user.id, conversationId.trim())
            : await getOrCreateGeneralConversation(req.user.id);

        if (!conversation) {
          return res.status(404).json({
            success: false,
            message: "Chat conversation not found",
          });
        }

        let storedHistory = await getRecentMessages(
          req.user.id,
          conversation.id,
          12
        );

        /*
         * If this is an older conversation created before persistent chat
         * history was available, accept the client's recent history as a
         * compatibility fallback. Stored history always wins when present.
         */
        if (!storedHistory.length && Array.isArray(conversationHistory)) {
          storedHistory = conversationHistory
            .slice(-12)
            .filter((item: unknown) => {
              if (!item || typeof item !== "object") return false;
              const record = item as Record<string, unknown>;
              const role = record.role;
              const content = record.content ?? record.text;
              return (
                (role === "user" || role === "assistant" || role === "ai") &&
                typeof content === "string" &&
                content.trim().length > 0
              );
            })
            .map((item: unknown, index: number) => {
              const record = item as Record<string, unknown>;
              return {
                id: `client-history-${index}`,
                role:
                  record.role === "assistant" || record.role === "ai"
                    ? ("assistant" as const)
                    : ("user" as const),
                content: String(record.content ?? record.text).slice(0, 4000),
                createdAt: new Date().toISOString(),
              };
            });
        }

        const history = storedHistory.map((item) => ({
          role: item.role,
          content: item.content.slice(0, 4000),
        }));

        const generalResponse = await aiOrchestrator.generate({
          operation: "orbit-general-chat",
          systemPrompt: `
You are ORBIT, a helpful, capable, natural conversational AI assistant.

GENERAL CHAT RULES:
- This is open-ended general conversation. Answer the user's actual message directly.
- The conversation history supplied with this request is part of the current conversation, not background noise.
- ALWAYS use the recent conversation history to interpret follow-up questions.
- Resolve pronouns and omitted subjects such as "he", "she", "it", "they", "their", "them", "there", "that", "the current one", "now", and similar references from the most recent coherent subject in the conversation.
- Preserve the active subject/entity across turns until the user clearly changes it.
- If the user explicitly corrects the subject (for example, "I mean Pakistan, not America"), that correction becomes the active subject immediately and must remain active for subsequent follow-ups.
- Do NOT replace an established subject with a more statistically common entity merely because a keyword has multiple common meanings. For example, after a conversation about Pakistan, "their prime minister" means Pakistan's prime minister unless the user changes the subject.
- For short follow-ups such as "ok", "what about their history?", "their prime minister?", or "tell me the current one", use the preceding turns to determine what the user means.
- If the conversation genuinely contains two or more plausible active subjects and the reference cannot be resolved safely, ask a concise clarification instead of silently switching to another country/person/entity.
- Do not reset context just because the user asks a new question. A new explicit topic starts a new active subject; an implicit follow-up continues the existing one.
- Treat the latest user correction and the latest coherent subject as higher priority than generic world knowledge associations.
- When the user asks for current/latest/today/now information, answer as accurately as your available knowledge allows. Do not invent current facts. If you cannot reliably establish a current fact, say so briefly rather than substituting a different country or entity.
- This is open-ended conversation. Do not force the user to state a project, goal, course, or desired outcome.
- Do not create a learning path, task, course, assessment, or learning session.
- Do not act as if a learning task exists, and never claim a task was completed.
- Ask a follow-up only when it genuinely helps answer the user's request.
- Be clear, practical, honest about uncertainty, and adapt the explanation to the user's needs.
- If the user independently asks to begin a structured learning journey, you may help them explore that request naturally; do not initiate it unnecessarily.
- Return a normal human-readable response, not JSON, unless the user explicitly asks for JSON.

CONVERSATION CONTEXT:
The messages below are recent turns from the same chat. Use them actively when interpreting the current message. The newest user message is the message you must answer.
          `.trim(),
          userMessage: message.trim(),
          context: {
            mode: "GENERAL_CHAT",
            conversationHistory: history,
          },
        });

        const generalAnswer = normalizeGeneralAnswer(generalResponse.text);

        await addChatMessage({
          userId: req.user.id,
          conversationId: conversation.id,
          role: "user",
          content: message.trim(),
        });

        await addChatMessage({
          userId: req.user.id,
          conversationId: conversation.id,
          role: "assistant",
          content: generalAnswer,
        });

        return res.json({
          success: true,
          mode: "GENERAL_TEACHER",
          conversationId: conversation.id,
          decision: {
            action: "TEACH",
            response: generalAnswer,
            skillUpdates: [],
            taskCompleted: false,
            moveToNextTask: false,
            nextTaskId: null,
            confidence: 1,
            guidanceLevel: "NONE",
            evidence: {
              type: "NONE",
              summary: "",
              sufficientForTaskCompletion: false,
              sufficientForOutcomeCompletion: false,
            },
            adaptation: "NONE",
            pathChange: { type: "NONE" },
          },
          // Explicitly null: general chat has no learning state by design.
          updatedState: null,
        });
      }

      // All non-general modes are learning modes and must belong to the
      // authenticated account. The client may send studentId for compatibility,
      // but it can never select another user's student record.
      const requestedStudentId =
        typeof studentId === "string" && studentId.trim()
          ? studentId.trim()
          : req.user.studentId;

      if (!(await assertStudentOwnership(req.user.id, requestedStudentId))) {
        return res.status(403).json({
          success: false,
          message: "You cannot access another user's learning session",
        });
      }

      const state = await getLearningSession(requestedStudentId);

      if (!state) {
        return res.status(404).json({
          success: false,
          message: "Learning session not found for this course. Open the course and start or resume its learning path.",
        });
      }

      const teacherResponse = await generateTeacherResponse(
        {
          state,
          userMessage: message.trim(),
          mode: teacherMode,
        },
        modelRouter
      );

      const updatedState = await updateLearningSession(
        teacherResponse.updatedState
      );

      return res.json({
        success: true,
        decision: teacherResponse.decision,
        updatedState,
      });
    } catch (error) {
      console.error("Teacher response error:", error);

      return res.status(500).json({
        success: false,
        message: "ORBIT could not process the message. Please try again.",
      });
    }
  }
);


/**
 * Streaming transport for learning replies. Learning decisions are still
 * produced and persisted by the same learning engine as /respond; the final
 * text is then emitted as SSE chunks so mobile clients can render it
 * incrementally without changing the learning-state contract.
 */
app.post(
  "/api/teacher/respond/stream",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
      const { studentId, message, mode, conversationHistory } = req.body ?? {};
      if (typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ success: false, message: "A valid message is required" });
      }
      if (message.length > 20000) {
        return res.status(413).json({ success: false, message: "Message is too long." });
      }
      if (!mode || typeof mode !== "string" || !Object.prototype.hasOwnProperty.call(TEACHER_MODES, mode) || mode === "GENERAL_TEACHER") {
        return res.status(400).json({ success: false, message: "A valid learning mode is required." });
      }
      const requestedStudentId = typeof studentId === "string" && studentId.trim() ? studentId.trim() : req.user.studentId;
      if (!(await assertStudentOwnership(req.user.id, requestedStudentId))) {
        return res.status(403).json({ success: false, message: "You cannot access another user's learning session" });
      }
      const state = await getLearningSession(requestedStudentId);
      if (!state) return res.status(404).json({ success: false, message: "Learning session not found. Start or resume this learning goal first." });

      const result = await generateTeacherResponse(
        { state, userMessage: message.trim(), mode: mode as TeacherMode },
        modelRouter,
      );
      const updatedState = await updateLearningSession(result.updatedState);
      const response = String(result.decision?.response ?? "").trim();
      if (!response) return res.status(502).json({ success: false, message: "ORBIT returned an empty response. Please try again." });

      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();
      res.write(`event: result\ndata: ${JSON.stringify({ success: true, decision: result.decision, updatedState })}\n\n`);
      // Keep chunks small for responsive rendering; the learning engine still
      // owns response generation and state transitions.
      const chunks = response.match(/[\s\S]{1,28}/g) ?? [response];
      for (const chunk of chunks) {
        if (res.destroyed) return;
        res.write(`event: token\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
        (res as any).flush?.();
      }
      res.write(`event: done\ndata: ${JSON.stringify({ success: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Streaming learning response error:", error);
      if (!res.headersSent) return res.status(500).json({ success: false, message: "ORBIT could not process the learning message. Please try again." });
      if (!res.destroyed) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: "ORBIT could not process the learning message. Please try again." })}\n\n`);
        res.end();
      }
    }
  },
);

app.get(
  "/api/learning-path/:studentId",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const studentId = Array.isArray(req.params.studentId)
        ? req.params.studentId[0]
        : req.params.studentId;
      if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
      if (!studentId) return res.status(400).json({ success: false, message: "A valid studentId is required" });
      if (!(await assertStudentOwnership(req.user.id, studentId))) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
      const state = await getLearningSession(studentId);
      if (!state) return res.status(404).json({ success: false, message: "Learning session not found" });
      return res.json({ success: true, studentId, learningPath: state.learningPath, domainProfile: state.domainProfile, outcome: state.outcome, goal: state.goal, currentTaskId: state.currentTaskId });
    } catch (error) {
      console.error("Learning path lookup error:", error);
      return res.status(500).json({ success: false, message: "Learning path lookup failed" });
    }
  }
);

app.get(
  "/api/domain-intelligence/:studentId",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const studentId = Array.isArray(req.params.studentId)
        ? req.params.studentId[0]
        : req.params.studentId;
      if (!req.user) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }
      if (!studentId) {
        return res.status(400).json({ success: false, message: "A valid studentId is required" });
      }
      if (!(await assertStudentOwnership(req.user.id, studentId))) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
      const state = await getLearningSession(studentId);
      if (!state) {
        return res.status(404).json({ success: false, message: "Learning session not found" });
      }
      return res.json({
        success: true,
        studentId,
        domainProfile: state.domainProfile,
        goal: state.goal,
        outcome: state.outcome,
      });
    } catch (error) {
      console.error("Domain intelligence lookup error:", error);
      return res.status(500).json({ success: false, message: "Domain intelligence lookup failed" });
    }
  }
);

app.get(
  "/api/outcome-verification/:studentId",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const studentId = Array.isArray(req.params.studentId)
        ? req.params.studentId[0]
        : req.params.studentId;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: "A valid studentId is required",
        });
      }

      if (!(await assertStudentOwnership(req.user.id, studentId))) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      const state = await getLearningSession(studentId);

      if (!state) {
        return res.status(404).json({
          success: false,
          message: "Learning session not found",
        });
      }

      return res.json({
        success: true,
        studentId,
        outcome: state.outcome,
        verification: state.outcomeVerification ?? {
          status: "NOT_STARTED",
          summary: "",
          confidence: 0,
          lastEvidenceType: "NONE",
          updatedAt: new Date().toISOString(),
        },
        evidence: state.outcomeEvidence ?? [],
        summary: getOutcomeVerificationSummary({
          ...state,
          outcomeVerification: state.outcomeVerification ?? {
            status: "NOT_STARTED",
            summary: "",
            confidence: 0,
            lastEvidenceType: "NONE",
            updatedAt: new Date().toISOString(),
          },
          outcomeEvidence: state.outcomeEvidence ?? [],
        }),
      });
    } catch (error) {
      console.error("Outcome verification error:", error);

      return res.status(500).json({
        success: false,
        message: "Outcome verification lookup failed",
      });
    }
  }
);

app.post(
  "/api/learning-path/generate",
  async (req, res) => {
    try {
      const {
        domain,
        goal,
        studentLevel,
        outcome,
        preferences,
        existingKnowledge,
        constraints,
      } = req.body;

      if (
        !domain ||
        typeof domain !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A valid domain is required",
        });
      }

      if (
        !goal ||
        typeof goal !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A valid goal is required",
        });
      }

      if (
        !studentLevel ||
        ![
          "beginner",
          "intermediate",
          "advanced",
        ].includes(studentLevel)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A valid student level is required",
        });
      }

      if (
        !outcome ||
        typeof outcome !== "object"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A valid outcome is required",
        });
      }

      if (
        typeof outcome.id !== "string" ||
        typeof outcome.title !== "string" ||
        typeof outcome.description !==
          "string"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Outcome must contain id, title, and description",
        });
      }

      const learningPath =
        await generateLearningPath(
          {
            domain,
            goal,
            studentLevel,
            outcome,
            preferences,
            existingKnowledge,
            constraints,
          },
          modelRouter
        );

      return res.json({
        success: true,
        learningPath: learningPath.learningPath,
        domainProfile: learningPath.domainProfile,
      });
    } catch (error) {
      console.error(
        "Learning path generation error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Learning path generation failed",
      });
    }
  }
);

app.post(
  "/api/learning-state/create",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        studentId,
        domain,
        goal,
        studentLevel,
        outcome,
        preferences,
        existingKnowledge,
        constraints,
      } = req.body;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const requestedStudentId =
        typeof studentId === "string" && studentId.trim()
          ? studentId.trim()
          : req.user.studentId;

      if (!(await assertStudentOwnership(req.user.id, requestedStudentId))) {
        return res.status(403).json({
          success: false,
          message: "You cannot create a learning state for another user",
        });
      }

      const ownedStudentId = requestedStudentId;

      if (
        !ownedStudentId ||
        typeof ownedStudentId !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A valid studentId is required",
        });
      }

      if (
        !domain ||
        typeof domain !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A valid domain is required",
        });
      }

      if (
        !goal ||
        typeof goal !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A valid goal is required",
        });
      }

      if (
        !studentLevel ||
        ![
          "beginner",
          "intermediate",
          "advanced",
        ].includes(studentLevel)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A valid student level is required",
        });
      }

      if (
        !outcome ||
        typeof outcome !== "object"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A valid outcome is required",
        });
      }

      if (
        typeof outcome.id !== "string" ||
        typeof outcome.title !== "string" ||
        typeof outcome.description !==
          "string"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Outcome must contain id, title, and description",
        });
      }

      const learningState =
        await startLearningSession(
          {
            studentId: ownedStudentId,

            domain,

            goal,

            studentLevel,

            outcome,

            preferences,

            existingKnowledge,

            constraints,
          },
          modelRouter
        );

      return res.json({
        success: true,
        learningState,
      });
    } catch (error) {
      console.error(
        "Learning state creation error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Learning state creation failed",
      });
    }
  }
);

async function startServer(): Promise<void> {
  try {
    await checkDatabaseConnection();
    console.log("PostgreSQL connection established");

    await ensureDatabaseSchema();
    console.log("ORBIT database schema is ready");

    app.listen(PORT, () => {
      console.log(
        `ORBIT backend running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
}

void startServer();