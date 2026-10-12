import {
  PracticalLearningPath,
} from "./types";

export function validateLearningPath(
  path: PracticalLearningPath
): PracticalLearningPath {
  if (!path) {
    throw new Error(
      "Learning path is required"
    );
  }

  if (
    typeof path.id !== "string" ||
    path.id.trim().length === 0
  ) {
    throw new Error(
      "Learning path must have a valid id"
    );
  }

  if (
    typeof path.outcomeId !== "string" ||
    path.outcomeId.trim().length === 0
  ) {
    throw new Error(
      "Learning path must have a valid outcomeId"
    );
  }

  if (
    !Array.isArray(path.tasks) ||
    path.tasks.length === 0
  ) {
    throw new Error(
      "Learning path must contain at least one task"
    );
  }

  const taskIds = new Set<string>();

  path.tasks.forEach((task, index) => {
    if (
      typeof task.id !== "string" ||
      task.id.trim().length === 0
    ) {
      throw new Error(
        `Task ${index} must have a valid id`
      );
    }

    if (taskIds.has(task.id)) {
      throw new Error(
        `Duplicate task id: ${task.id}`
      );
    }

    taskIds.add(task.id);

    if (
      typeof task.title !== "string" ||
      task.title.trim().length === 0
    ) {
      throw new Error(
        `Task ${task.id} must have a title`
      );
    }

    if (
      typeof task.description !== "string" ||
      task.description.trim().length === 0
    ) {
      throw new Error(
        `Task ${task.id} must have a description`
      );
    }

    if (
      !Array.isArray(task.requiredSkills)
    ) {
      throw new Error(
        `Task ${task.id} must contain requiredSkills`
      );
    }

    if (
      task.requiredSkills.some(
        (skill) =>
          typeof skill !== "string" ||
          skill.trim().length === 0
      )
    ) {
      throw new Error(
        `Task ${task.id} contains an invalid required skill`
      );
    }

    if (
      typeof task.order !== "number" ||
      task.order !== index + 1
    ) {
      throw new Error(
        `Task ${task.id} has an invalid order`
      );
    }

    const validStatuses = [
      "locked",
      "available",
      "current",
      "completed",
      "skipped",
    ];

    if (
      !validStatuses.includes(
        task.status
      )
    ) {
      throw new Error(
        `Task ${task.id} has an invalid status`
      );
    }
  });

  const currentTasks =
    path.tasks.filter(
      (task) => task.status === "current"
    );

  if (currentTasks.length > 1) {
    throw new Error(
      "Learning path cannot have multiple current tasks"
    );
  }

  const completedTasks =
    path.tasks.filter(
      (task) => task.status === "completed"
    );

  const skippedTasks =
    path.tasks.filter(
      (task) => task.status === "skipped"
    );

  if (
    completedTasks.length +
      skippedTasks.length ===
    path.tasks.length
  ) {
    throw new Error(
      "Learning path cannot contain only completed or skipped tasks"
    );
  }

  return path;
}