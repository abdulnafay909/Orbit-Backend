import {
  StudentLearningState,
  OutcomeEvidenceRecord,
} from "../../learning/types";
import { isValidSkillTransition } from "../../learning/skillEngine";
import { canCompleteOutcome } from "../../learning/progressEngine";
import { TeacherDecision } from "./teacherDecision";

const TASK_COMPLETION_EVIDENCE = new Set(["SELF_REPORT", "DEMONSTRATED_ACTION", "OUTPUT", "RESULT", "REAL_WORLD_RESULT"]);


function applyPathChange(state: StudentLearningState, decision: TeacherDecision): void {
  const change = decision.pathChange;
  if (!change || change.type === "NONE") return;

  const currentTask = state.learningPath.tasks.find((task) => task.id === state.currentTaskId);
  if (!currentTask) return;

  if (change.type === "SKIP_CURRENT") {
    if (!decision.evidence.sufficientForTaskCompletion || !TASK_COMPLETION_EVIDENCE.has(decision.evidence.type)) return;
    currentTask.status = "skipped";
    currentTask.completionEvidence = decision.evidence.summary;
    currentTask.completionEvidenceType = decision.evidence.type;
    if (!state.skippedTaskIds.includes(currentTask.id)) state.skippedTaskIds.push(currentTask.id);
    state.completedTaskIds = state.completedTaskIds.filter((id) => id !== currentTask.id);
  }

  if (change.type === "SIMPLIFY_CURRENT" && change.description?.trim()) {
    currentTask.description = change.description.trim();
  }

  if (change.type === "INCREASE_CURRENT_CHALLENGE" && change.description?.trim()) {
    currentTask.description = change.description.trim();
  }

  if (change.type === "INSERT_SUPPORT" && change.title?.trim() && change.description?.trim()) {
    const supportTaskId = `adaptive_task_${Date.now()}`;
    const supportTask = {
      id: supportTaskId,
      title: change.title.trim(),
      description: change.description.trim(),
      status: "current" as const,
      requiredSkills: (change.requiredSkills ?? currentTask.requiredSkills).map((skill) => skill),
      order: 0,
    };
    currentTask.status = "available";
    state.learningPath.tasks.splice(currentTask.order - 1, 0, supportTask);
    state.currentTaskId = supportTaskId;
  }

  state.learningPath.tasks = state.learningPath.tasks.map((task, index) => ({ ...task, order: index + 1 }));
}

export function applyTeacherDecision(state: StudentLearningState, decision: TeacherDecision): StudentLearningState {
  const updatedState: StudentLearningState = {
    ...state,
    skills: state.skills.map((skill) => ({ ...skill })),
    learningPath: { ...state.learningPath, tasks: state.learningPath.tasks.map((task) => ({ ...task })) },
    completedTaskIds: [...state.completedTaskIds],
    skippedTaskIds: [...state.skippedTaskIds],
    learningHistory: [...state.learningHistory],
    outcome: { ...state.outcome },
    outcomeVerification: state.outcomeVerification
      ? { ...state.outcomeVerification }
      : {
          status: "NOT_STARTED",
          summary: "",
          confidence: 0,
          lastEvidenceType: "NONE",
          updatedAt: new Date().toISOString(),
        },
    outcomeEvidence: [...(state.outcomeEvidence ?? [])],
    conversationHistory: [...state.conversationHistory],
  };

  for (const update of decision.skillUpdates) {
    const currentSkill = updatedState.skills.find((skill) => skill.id === update.skillId);
    if (!currentSkill) throw new Error(`Cannot update skill: ${update.skillId} does not exist`);
    if (!isValidSkillTransition(currentSkill.status, update.status)) {
      throw new Error(`Invalid skill transition for ${update.skillId}: ${currentSkill.status} → ${update.status}`);
    }
    updatedState.skills = updatedState.skills.map((skill) =>
      skill.id === update.skillId ? { ...skill, status: update.status } : skill
    );
    updatedState.learningHistory.push(
      `Skill "${currentSkill.name}" updated from ${currentSkill.status} to ${update.status}. Evidence: ${update.evidence}`
    );
  }

  updatedState.learningHistory.push(
    `Evidence: ${decision.evidence.type} — ${decision.evidence.summary || "No evidence summary provided"}`
  );
  updatedState.learningHistory.push(`Adaptation: ${decision.adaptation}`);
  applyPathChange(updatedState, decision);
  if (decision.pathChange.type !== "NONE") {
    updatedState.learningHistory.push(`Learning path adapted: ${decision.pathChange.type}`);
  }

  if (decision.taskCompleted) {
    const currentTaskId = updatedState.currentTaskId;
    if (!currentTaskId) throw new Error("Cannot complete task: no current task exists");
    const currentTask = updatedState.learningPath.tasks.find((task) => task.id === currentTaskId);
    if (!currentTask) throw new Error(`Cannot complete task: task ${currentTaskId} does not exist`);
    if (currentTask.status === "completed") throw new Error(`Task ${currentTaskId} is already completed`);
    if (currentTask.status === "skipped") throw new Error(`Task ${currentTaskId} is already skipped`);
    if (!decision.evidence.sufficientForTaskCompletion || !TASK_COMPLETION_EVIDENCE.has(decision.evidence.type)) {
      throw new Error("Cannot complete task without sufficient completion confidence");
    }

    updatedState.learningPath.tasks = updatedState.learningPath.tasks.map((task) =>
      task.id === currentTaskId
        ? { ...task, status: "completed", completionEvidence: decision.evidence.summary, completionEvidenceType: decision.evidence.type }
        : task
    );
    if (!updatedState.completedTaskIds.includes(currentTaskId)) updatedState.completedTaskIds.push(currentTaskId);
    updatedState.skippedTaskIds = updatedState.skippedTaskIds.filter((id) => id !== currentTaskId);
    updatedState.learningHistory.push(`Task "${currentTask.title}" completed with ${decision.evidence.type} evidence.`);
  }

  if (decision.taskCompleted && !decision.moveToNextTask) {
    const nextTask = updatedState.learningPath.tasks
      .filter((task) => task.status === "available")
      .sort((a, b) => a.order - b.order)[0];

    if (nextTask) {
      updatedState.learningPath.tasks = updatedState.learningPath.tasks.map((task) =>
        task.id === nextTask.id ? { ...task, status: "current" } : task
      );
      updatedState.currentTaskId = nextTask.id;
      updatedState.learningHistory.push(`Automatically advanced to next available task: ${nextTask.title}`);
    } else {
      updatedState.currentTaskId = undefined;
    }
  }

  if (decision.adaptation === "SKIP_KNOWN_CONTENT") {
  const currentTaskId = updatedState.currentTaskId;

  if (!currentTaskId) {
    throw new Error(
      "Cannot skip known content: no current task exists"
    );
  }

  const currentTask =
    updatedState.learningPath.tasks.find(
      (task) => task.id === currentTaskId
    );

  if (!currentTask) {
    throw new Error(
      `Cannot skip known content: task ${currentTaskId} does not exist`
    );
  }

  /*
   * Known-content skipping is intentionally self-reported.
   *
   * The student does not need to provide screenshots, output,
   * or other evidence simply because they already know the
   * material. Evidence may still be attached when available,
   * but it is not required for progression.
   */
  updatedState.learningPath.tasks =
    updatedState.learningPath.tasks.map((task) =>
      task.id === currentTaskId
        ? {
            ...task,
            status: "skipped",
            completionEvidence:
              decision.evidence.summary ||
              "Student indicated that this content is already known.",
            completionEvidenceType:
              decision.evidence.type || "SELF_REPORT",
          }
        : task
    );

  if (
    !updatedState.skippedTaskIds.includes(
      currentTaskId
    )
  ) {
    updatedState.skippedTaskIds.push(
      currentTaskId
    );
  }

  updatedState.completedTaskIds =
    updatedState.completedTaskIds.filter(
      (id) => id !== currentTaskId
    );

  const nextTask =
    updatedState.learningPath.tasks.find(
      (task) => task.status === "available"
    );

  if (nextTask) {
    nextTask.status = "current";
    updatedState.currentTaskId = nextTask.id;

    updatedState.learningHistory.push(
      `Skipped known content: ${currentTask.title}. Continued with: ${nextTask.title}.`
    );
  } else {
    updatedState.currentTaskId = undefined;

    updatedState.learningHistory.push(
      `Skipped known content: ${currentTask.title}. No remaining available task.`
    );
  }
}
if (decision.moveToNextTask && decision.taskCompleted) {
  const nextTaskId = decision.nextTaskId;

  /*
   * Validator normally resolves this.
   * Keep the updater defensive so malformed AI output
   * can never crash a user conversation.
   */
  if (nextTaskId) {
    const nextTask =
      updatedState.learningPath.tasks.find(
        (task) => task.id === nextTaskId
      );

    if (
      nextTask &&
      nextTask.status !== "completed" &&
      nextTask.status !== "skipped"
    ) {
      updatedState.learningPath.tasks =
        updatedState.learningPath.tasks.map(
          (task) => {
            if (task.id === nextTaskId) {
              return {
                ...task,
                status: "current",
              };
            }

            if (task.status === "current") {
              return {
                ...task,
                status: "available",
              };
            }

            return task;
          }
        );

      updatedState.currentTaskId = nextTaskId;

      updatedState.learningHistory.push(
        `Moved to next task: ${nextTask.title}`
      );
    }
  }
}

  // Phase 9: keep a compact, persistent trail of meaningful evidence.
  // Evidence is informative, not a proof ceremony. A clear student
  // self-report is valid evidence for task progression.
  if (decision.evidence.type !== "NONE" && decision.evidence.summary.trim()) {
    const source: OutcomeEvidenceRecord["source"] =
      decision.evidence.type === "SELF_REPORT"
        ? "STUDENT_MESSAGE"
        : "TEACHER_INFERENCE";

    const evidenceRecord: OutcomeEvidenceRecord = {
      id: `outcome_evidence_${Date.now()}_${updatedState.outcomeEvidence.length + 1}`,
      type: decision.evidence.type,
      summary: decision.evidence.summary,
      confidence: decision.confidence,
      source,
      timestamp: new Date().toISOString(),
    };

    updatedState.outcomeEvidence = [
      ...updatedState.outcomeEvidence,
      evidenceRecord,
    ].slice(-20);

    updatedState.outcomeVerification = {
      status:
        decision.evidence.sufficientForOutcomeCompletion &&
        decision.adaptation === "COMPLETE_OUTCOME"
          ? "COMPLETED"
          : "IN_PROGRESS",
      summary: decision.evidence.summary,
      confidence: decision.confidence,
      lastEvidenceType: decision.evidence.type,
      updatedAt: evidenceRecord.timestamp,
    };
  }

  if (
    decision.evidence.sufficientForOutcomeCompletion &&
    decision.evidence.summary.trim()
  ) {
    updatedState.outcome = {
      ...updatedState.outcome,
      completionEvidence: decision.evidence.summary,
    };
  }

  if (canCompleteOutcome(updatedState)) {
    updatedState.outcome = {
      ...updatedState.outcome,
      completed: true,
    };
    updatedState.outcomeVerification = {
      status: "COMPLETED",
      summary:
        updatedState.outcome.completionEvidence ??
        updatedState.outcomeVerification.summary,
      confidence: Math.max(
        updatedState.outcomeVerification.confidence,
        decision.confidence
      ),
      lastEvidenceType:
        updatedState.outcomeVerification.lastEvidenceType,
      updatedAt: new Date().toISOString(),
    };
    updatedState.currentTaskId = undefined;
    updatedState.learningHistory.push(
      "REAL-WORLD OUTCOME COMPLETED: outcome requirements and supporting evidence were satisfied."
    );
  } else if (updatedState.outcome.completed) {
    updatedState.outcome = {
      ...updatedState.outcome,
      completed: false,
    };
    updatedState.outcomeVerification = {
      ...updatedState.outcomeVerification,
      status: "IN_PROGRESS",
      updatedAt: new Date().toISOString(),
    };
  }

  updatedState.learningHistory.push(`Teacher action: ${decision.action}`);
  return updatedState;
}
