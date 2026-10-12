import { StudentLearningState, LearningTask, Skill } from "./types";

export function getCurrentTaskFromState(state: StudentLearningState): LearningTask | undefined {
  if (!state.currentTaskId) return undefined;
  return state.learningPath.tasks.find((task) => task.id === state.currentTaskId);
}

export function getCompletedTasks(state: StudentLearningState): LearningTask[] {
  return state.learningPath.tasks.filter((task) => task.status === "completed");
}

export function getRemainingTasks(state: StudentLearningState): LearningTask[] {
  return state.learningPath.tasks.filter(
    (task) => task.status !== "completed" && task.status !== "skipped"
  );
}

export function getAvailableTasks(state: StudentLearningState): LearningTask[] {
  return state.learningPath.tasks.filter((task) => task.status === "available");
}

export function calculateTaskProgress(state: StudentLearningState): number {
  const total = state.learningPath.tasks.length;
  if (total === 0) return 0;
  const progressed = state.learningPath.tasks.filter(
    (task) => task.status === "completed" || task.status === "skipped"
  ).length;
  return Math.round((progressed / total) * 100);
}

export function getDemonstratedSkillCount(skills: Skill[]): number {
  return skills.filter(
    (skill) => skill.status === "demonstrated" || skill.status === "mastered"
  ).length;
}

export function addLearningHistory(state: StudentLearningState, event: string): StudentLearningState {
  return { ...state, learningHistory: [...state.learningHistory, event] };
}

export function hasSufficientTaskEvidence(task: LearningTask): boolean {
  return Boolean(task.completionEvidence && task.completionEvidence.trim());
}

export function areAllTasksSatisfied(state: StudentLearningState): boolean {
  return state.learningPath.tasks.length > 0 && state.learningPath.tasks.every(
    (task) => task.status === "completed" || (task.status === "skipped" && hasSufficientTaskEvidence(task))
  );
}

export function hasRealWorldOutcomeEvidence(state: StudentLearningState): boolean {
  return Boolean(
    state.outcome.completionEvidence &&
    state.outcome.completionEvidence.trim()
  );
}

export function canCompleteOutcome(state: StudentLearningState): boolean {
  return (
    areAllTasksSatisfied(state) &&
    hasRealWorldOutcomeEvidence(state)
  );
}

export function isOutcomeCompleted(state: StudentLearningState): boolean {
  return state.outcome.completed && canCompleteOutcome(state);
}

export function getOutcomeVerificationSummary(
  state: StudentLearningState
): {
  status: StudentLearningState["outcomeVerification"]["status"];
  confidence: number;
  evidenceCount: number;
} {
  return {
    status: state.outcomeVerification?.status ?? "NOT_STARTED",
    confidence: state.outcomeVerification?.confidence ?? 0,
    evidenceCount: state.outcomeEvidence?.length ?? 0,
  };
}
