import { StudentLearningState } from "../../learning/types";
import { TeacherDecision } from "./teacherDecision";

const VALID_SKILL_STATUSES = [
  "unknown",
  "learning",
  "developing",
  "demonstrated",
  "mastered",
] as const;

const TASK_COMPLETION_EVIDENCE = new Set([
  "SELF_REPORT",
  "DEMONSTRATED_ACTION",
  "OUTPUT",
  "RESULT",
  "REAL_WORLD_RESULT",
]);

const OUTCOME_COMPLETION_EVIDENCE = new Set([
  "SELF_REPORT",
  "DEMONSTRATED_ACTION",
  "OUTPUT",
  "RESULT",
  "REAL_WORLD_RESULT",
]);

export function validateTeacherDecision(
  decision: TeacherDecision,
  state: StudentLearningState
): TeacherDecision {
  const validSkillIds = new Set(
    state.skills.map((skill) => skill.id)
  );

  const validTaskIds = new Set(
    state.learningPath.tasks.map((task) => task.id)
  );

  /*
   * ---------------------------------------------------------
   * GENERAL CONVERSATION SAFETY
   * ---------------------------------------------------------
   *
   * ORBIT can receive ordinary conversational messages even
   * when there is no active learning task.
   *
   * In that situation, task progression is impossible.
   * Recover safely instead of allowing an invalid AI decision
   * to crash the request.
   */
  if (!state.currentTaskId) {
    decision.taskCompleted = false;
    decision.moveToNextTask = false;
    decision.nextTaskId = undefined;

    /*
     * A task-specific adaptation cannot operate without a
     * current task.
     */
    if (
      decision.adaptation === "SKIP_KNOWN_CONTENT"
    ) {
      decision.adaptation = "CONTINUE";
    }
  }

  /*
   * ---------------------------------------------------------
   * SKILL VALIDATION
   * ---------------------------------------------------------
   */

  for (const update of decision.skillUpdates) {
    if (!validSkillIds.has(update.skillId)) {
      throw new Error(
        `AI attempted to update unknown skill: ${update.skillId}`
      );
    }

    if (!VALID_SKILL_STATUSES.includes(update.status)) {
      throw new Error(
        `AI returned invalid skill status: ${update.status}`
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * NEXT TASK VALIDATION
   * ---------------------------------------------------------
   */

  if (
    decision.nextTaskId &&
    !validTaskIds.has(decision.nextTaskId)
  ) {
    throw new Error(
      `AI selected unknown next task: ${decision.nextTaskId}`
    );
  }

  /*
   * ---------------------------------------------------------
   * TASK COMPLETION
   * ---------------------------------------------------------
   */

  if (decision.taskCompleted) {
    if (!state.currentTaskId) {
      decision.taskCompleted = false;
      decision.moveToNextTask = false;
      decision.nextTaskId = undefined;
    } else {
      if (!decision.evidence.sufficientForTaskCompletion) {
        throw new Error(
          "AI attempted to complete a task without sufficient completion confidence"
        );
      }

      if (
        !TASK_COMPLETION_EVIDENCE.has(
          decision.evidence.type
        )
      ) {
        throw new Error(
          `Insufficient evidence type for task completion: ${decision.evidence.type}`
        );
      }
    }
  }

  /*
   * ---------------------------------------------------------
   * KNOWN CONTENT
   * ---------------------------------------------------------
   *
   * Self-report is intentionally enough.
   * No screenshot/proof ceremony.
   */

  if (
    decision.adaptation === "SKIP_KNOWN_CONTENT"
  ) {
    if (!state.currentTaskId) {
      decision.adaptation = "CONTINUE";
    }
  }

  /*
   * ---------------------------------------------------------
   * NEXT TASK RECOVERY
   * ---------------------------------------------------------
   *
   * If the AI says "move forward" after completing a real
   * task but forgets to provide nextTaskId, recover using the
   * first available task.
   */

  if (
    decision.moveToNextTask &&
    decision.taskCompleted
  ) {
    if (!decision.nextTaskId) {
      const nextTask = state.learningPath.tasks
        .filter(
          (task) =>
            task.status === "available"
        )
        .sort(
          (a, b) => a.order - b.order
        )[0];

      if (nextTask) {
        decision.nextTaskId = nextTask.id;
      } else {
        /*
         * There is nothing left to move to.
         * Task completion itself is still valid.
         */
        decision.moveToNextTask = false;
      }
    }

    if (decision.nextTaskId) {
      const nextTask =
        state.learningPath.tasks.find(
          (task) =>
            task.id === decision.nextTaskId
        );

      if (!nextTask) {
        throw new Error(
          `AI selected unknown next task: ${decision.nextTaskId}`
        );
      }

      if (
        nextTask.status === "completed" ||
        nextTask.status === "skipped"
      ) {
        throw new Error(
          `AI selected unavailable next task: ${decision.nextTaskId}`
        );
      }

      if (
        nextTask.status !== "available" &&
        nextTask.status !== "current"
      ) {
        throw new Error(
          `AI selected unavailable next task: ${decision.nextTaskId}`
        );
      }
    }
  }

  /*
   * Never allow movement without completion.
   */
  if (
    decision.moveToNextTask &&
    !decision.taskCompleted
  ) {
    decision.moveToNextTask = false;
    decision.nextTaskId = undefined;
  }

  /*
   * ---------------------------------------------------------
   * ACTION CONSISTENCY
   * ---------------------------------------------------------
   */

  if (
    decision.action === "COMPLETE_TASK" &&
    !decision.taskCompleted
  ) {
    decision.action = "TEACH";
  }

  if (
    decision.action === "MOVE_TO_NEXT_TASK" &&
    !decision.moveToNextTask
  ) {
    decision.action = decision.taskCompleted
      ? "TEACH"
      : "ASK_QUESTION";
  }

  /*
   * ---------------------------------------------------------
   * OUTCOME COMPLETION
   * ---------------------------------------------------------
   */

  if (
    decision.adaptation === "COMPLETE_OUTCOME"
  ) {
    if (
      !OUTCOME_COMPLETION_EVIDENCE.has(
        decision.evidence.type
      )
    ) {
      throw new Error(
        `Insufficient evidence type for outcome completion: ${decision.evidence.type}`
      );
    }

    if (
      !decision.evidence
        .sufficientForOutcomeCompletion
    ) {
      throw new Error(
        "Outcome completion requires sufficient completion confidence"
      );
    }
  }

  return decision;
}