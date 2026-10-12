import {
  LearningTask,
  PracticalLearningPath,
  RealWorldOutcome,
} from "./types";

export function createLearningPath(
  outcome: RealWorldOutcome,
  tasks: LearningTask[]
): PracticalLearningPath {
  const normalizedTasks = tasks.map((task, index) => ({
    ...task,
    order: index + 1,
  }));

  if (normalizedTasks.length > 0) {
    normalizedTasks[0].status = "current";
  }

  return {
    id: `path_${Date.now()}`,
    outcomeId: outcome.id,
    tasks: normalizedTasks,
  };
}

export function getCurrentTask(
  learningPath: PracticalLearningPath
): LearningTask | undefined {
  return learningPath.tasks.find(
    (task) => task.status === "current"
  );
}

export function getNextAvailableTask(
  learningPath: PracticalLearningPath
): LearningTask | undefined {
  return learningPath.tasks.find(
    (task) => task.status === "available"
  );
}

export function completeTask(
  learningPath: PracticalLearningPath,
  taskId: string
): PracticalLearningPath {
  const tasks = learningPath.tasks.map((task) => {
    if (task.id === taskId) {
      return {
        ...task,
        status: "completed" as const,
      };
    }

    return task;
  });

  const nextTask = tasks.find(
    (task) => task.status === "available"
  );

  if (nextTask) {
    nextTask.status = "current";
  }

  return {
    ...learningPath,
    tasks,
  };
}

export function skipTask(
  learningPath: PracticalLearningPath,
  taskId: string
): PracticalLearningPath {
  const tasks = learningPath.tasks.map((task) => {
    if (task.id === taskId) {
      return {
        ...task,
        status: "skipped" as const,
      };
    }

    return task;
  });

  const nextTask = tasks.find(
    (task) => task.status === "available"
  );

  if (nextTask) {
    nextTask.status = "current";
  }

  return {
    ...learningPath,
    tasks,
  };
}