import { StudentLearningState } from "./types";
import { LearningStateRepository } from "./learningStateRepository";

export class InMemoryLearningStateRepository implements LearningStateRepository {
  private readonly sessions = new Map<string, StudentLearningState>();

  async save(state: StudentLearningState): Promise<StudentLearningState> {
    this.sessions.set(state.studentId, state);
    return state;
  }

  async get(studentId: string): Promise<StudentLearningState | undefined> {
    return this.sessions.get(studentId);
  }

  async update(state: StudentLearningState): Promise<StudentLearningState> {
    this.sessions.set(state.studentId, state);
    return state;
  }

  async delete(studentId: string): Promise<boolean> {
    return this.sessions.delete(studentId);
  }
}
