import { StudentLearningState } from "../../learning/types";
import { getCurrentTaskFromState, getCompletedTasks, getRemainingTasks, calculateTaskProgress, getDemonstratedSkillCount } from "../../learning/progressEngine";
import { getRecentConversation } from "../../learning/conversationHistory";
import { TeacherMode } from "./teacherModes";

export interface AdaptiveGuidancePolicy {
  taskCompletionRequiresEvidence: boolean;
  outcomeCompletionRequiresRealWorldEvidence: boolean;
  progressiveHelpLevels: ("HINT" | "EXPLANATION" | "EXAMPLE" | "STRONGER_GUIDANCE" | "DIRECT_ASSISTANCE")[];
  avoidUnnecessaryTeaching: boolean;
  respectExistingKnowledge: boolean;
  adaptToActualResults: boolean;
}

export interface TeacherContext {
  mode: TeacherMode;
  student: { id: string; experienceLevel: string };
  course: { id: string; name: string; description?: string };
  domainProfile: { domainLabel: string; outcomeType: string; learningMode: string; successSignals: string[]; importantConsiderations: string[]; confidence: number };
  goal: { description: string; technology?: { platform?: string; framework?: string; language?: string; target?: string } };
  preferences?: { platform?: string; framework?: string; language?: string; tools?: string[]; approach?: string };
  existingKnowledge?: string[];
  constraints?: string[];
  outcome: {
    id: string;
    title: string;
    description: string;
    completed: boolean;
    completionEvidence?: string;
    verification: {
      status: string;
      summary: string;
      confidence: number;
      lastEvidenceType: string;
    };
    evidenceCount: number;
  };
  currentTask?: { id: string; title: string; description: string; requiredSkills: string[]; completionEvidence?: string; completionEvidenceType?: string };
  learningPath: { id: string; outcomeId: string; tasks: { id: string; title: string; description: string; status: string; requiredSkills: string[]; order: number }[] };
  skills: { id: string; name: string; status: string }[];
  progress: { taskProgress: number; completedTasks: number; remainingTasks: number; demonstratedSkills: number };
  recentLearningHistory: string[];
  conversationHistory: { role: "student" | "teacher"; content: string; timestamp: string }[];
  adaptiveGuidance: AdaptiveGuidancePolicy;
  userMessage: string;
}

export function buildTeacherContext(state: StudentLearningState, userMessage: string, mode: TeacherMode): TeacherContext {
  const currentTask = getCurrentTaskFromState(state);
  const completedTasks = getCompletedTasks(state);
  const remainingTasks = getRemainingTasks(state);
  return {
    mode,
    student: { id: state.studentId, experienceLevel: state.goal.experienceLevel },
    course: { id: state.course.id, name: state.course.name, description: state.course.description },
    domainProfile: { ...state.domainProfile },
    goal: { description: state.goal.description, technology: state.goal.technology },
    preferences: state.preferences,
    existingKnowledge: state.existingKnowledge,
    constraints: state.constraints,
    outcome: {
      ...state.outcome,
      verification: {
        status: state.outcomeVerification?.status ?? "NOT_STARTED",
        summary: state.outcomeVerification?.summary ?? "",
        confidence: state.outcomeVerification?.confidence ?? 0,
        lastEvidenceType:
          state.outcomeVerification?.lastEvidenceType ?? "NONE",
      },
      evidenceCount: state.outcomeEvidence?.length ?? 0,
    },
    currentTask: currentTask ? { ...currentTask } : undefined,
    learningPath: {
      id: state.learningPath.id,
      outcomeId: state.learningPath.outcomeId,
      tasks: state.learningPath.tasks.map((task) => ({
        id: task.id, title: task.title, description: task.description,
        status: task.status, requiredSkills: [...task.requiredSkills], order: task.order,
      })),
    },
    skills: state.skills.map((skill) => ({ id: skill.id, name: skill.name, status: skill.status })),
    progress: {
      taskProgress: calculateTaskProgress(state),
      completedTasks: completedTasks.length,
      remainingTasks: remainingTasks.length,
      demonstratedSkills: getDemonstratedSkillCount(state.skills),
    },
    recentLearningHistory: state.learningHistory.slice(-10),
    conversationHistory: getRecentConversation(state, 10),
    adaptiveGuidance: {
      taskCompletionRequiresEvidence: false,
      outcomeCompletionRequiresRealWorldEvidence: false,
      progressiveHelpLevels: ["HINT", "EXPLANATION", "EXAMPLE", "STRONGER_GUIDANCE", "DIRECT_ASSISTANCE"],
      avoidUnnecessaryTeaching: true,
      respectExistingKnowledge: true,
      adaptToActualResults: true,
    },
    userMessage,
  };
}
