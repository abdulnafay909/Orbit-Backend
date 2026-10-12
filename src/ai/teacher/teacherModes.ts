export type TeacherMode =
  | "GENERAL_TEACHER"
  | "OUTCOME_TEACHER"
  | "QUIZ"
  | "ASSESSMENT"
  | "CODING_TEACHER";

export interface TeacherModeConfig {
  mode: TeacherMode;
  description: string;
  primaryGoal: string;
}

export const TEACHER_MODES: Record<
  TeacherMode,
  TeacherModeConfig
> = {
  GENERAL_TEACHER: {
    mode: "GENERAL_TEACHER",

    description:
      "General educational conversation where the student may ask about any topic.",

    primaryGoal:
      "Teach the concept clearly, determine what the student understands, and guide them toward useful understanding.",
  },

  OUTCOME_TEACHER: {
    mode: "OUTCOME_TEACHER",

    description:
      "The student is actively working toward a specific real-world outcome.",

    primaryGoal:
      "Help the student complete the current task while teaching only the knowledge and skills needed at the appropriate time.",
  },

  QUIZ: {
    mode: "QUIZ",

    description:
      "The student is answering structured questions to check understanding.",

    primaryGoal:
      "Evaluate understanding accurately without unnecessarily giving away the answer.",
  },

  ASSESSMENT: {
    mode: "ASSESSMENT",

    description:
      "The system is evaluating whether the student has demonstrated a specific skill or capability.",

    primaryGoal:
      "Collect evidence of the student's understanding or ability and determine an appropriate skill status.",
  },

  CODING_TEACHER: {
    mode: "CODING_TEACHER",

    description:
      "The student is learning or applying programming concepts while building something.",

    primaryGoal:
      "Teach programming concepts through practical application, explain why code works, encourage understanding, and progressively reduce assistance as the student's ability improves.",
  },
};