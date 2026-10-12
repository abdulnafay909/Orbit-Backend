import { StudentLearningState } from "../../learning/types";
import { TeacherMode } from "./teacherModes";
import { buildTeacherContext } from "./teacherContext";
import { buildTeacherInstructions } from "./teacherInstructions";

export interface TeacherRequest {
  state: StudentLearningState;
  userMessage: string;
  mode: TeacherMode;
}

export interface TeacherEngineInput {
  instructions: string;
  context: ReturnType<typeof buildTeacherContext>;
}

export function prepareTeacherRequest(
  request: TeacherRequest
): TeacherEngineInput {
  const context = buildTeacherContext(
    request.state,
    request.userMessage,
    request.mode
  );

  const instructions = buildTeacherInstructions(
    request.mode
  );

  return {
    instructions,
    context,
  };
}