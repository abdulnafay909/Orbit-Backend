import { TeacherMode } from "./teacherModes";
import { prepareTeacherRequest } from "./teacherEngine";
import { ModelRouter } from "../router/modelRouter";
import { createAIOrchestrator } from "../orchestration/aiOrchestrator";
import { parseTeacherDecision } from "./teacherDecisionParser";
import { TeacherDecision } from "./teacherDecision";
import { validateTeacherDecision } from "./teacherDecisionValidator";
import { applyTeacherDecision } from "./teacherStateUpdater";
import { StudentLearningState } from "../../learning/types";
import { addConversationMessage } from "../../learning/conversationHistory";
import { toSafeAIErrorMessage } from "../orchestration/aiReliability";

export interface TeacherServiceRequest {
  state: StudentLearningState;
  userMessage: string;
  mode: TeacherMode;
}

export interface TeacherServiceResponse {
  decision: TeacherDecision;
  updatedState: StudentLearningState;
}

export async function generateTeacherResponse(
  request: TeacherServiceRequest,
  modelRouter: ModelRouter
): Promise<TeacherServiceResponse> {
  // Add the student's message to the conversation
  // before preparing the AI context.
  const stateWithStudentMessage =
    addConversationMessage(
      request.state,
      "student",
      request.userMessage
    );

  const teacherRequest = prepareTeacherRequest({
    state: stateWithStudentMessage,
    userMessage: request.userMessage,
    mode: request.mode,
  });

  const orchestrator = createAIOrchestrator(modelRouter);

  let response;

  try {
    response = await orchestrator.generate({
      operation: "teacher-response",
      expectJson: true,
      systemPrompt: teacherRequest.instructions,
      userMessage: request.userMessage,
      context: teacherRequest.context,
    });
  } catch (error) {
    console.error(
      "AI Teacher orchestration failed:",
      error
    );

    throw new Error(
      toSafeAIErrorMessage("teacher-response")
    );
  }

  let parsedResponse: unknown;

  try {
    parsedResponse = JSON.parse(response.text);
  } catch {
    throw new Error(
      toSafeAIErrorMessage("teacher-response")
    );
  }

  const decision = parseTeacherDecision(
    parsedResponse
  );

  const validatedDecision = validateTeacherDecision(
    decision,
    stateWithStudentMessage
  );

  let updatedState = applyTeacherDecision(
    stateWithStudentMessage,
    validatedDecision
  );

  // Save the Teacher's response to conversation history.
  updatedState = addConversationMessage(
    updatedState,
    "teacher",
    validatedDecision.response
  );

  return {
    decision: validatedDecision,
    updatedState,
  };
}