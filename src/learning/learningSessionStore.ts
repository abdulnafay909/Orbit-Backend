import { StudentLearningState } from "./types";
import { LearningStateRepository } from "./learningStateRepository";
import { PostgresLearningStateRepository } from "./postgresLearningStateRepository";

const repository: LearningStateRepository =
  new PostgresLearningStateRepository();

export function getLearningStateRepository(): LearningStateRepository {
  return repository;
}

export async function saveLearningSession(
  state: StudentLearningState
): Promise<StudentLearningState> {
  return repository.save(state);
}

export async function getLearningSession(
  studentId: string
): Promise<StudentLearningState | undefined> {
  return repository.get(studentId);
}

export async function updateLearningSession(
  state: StudentLearningState
): Promise<StudentLearningState> {
  return repository.update(state);
}

export async function deleteLearningSession(
  studentId: string
): Promise<boolean> {
  return repository.delete(studentId);
}
