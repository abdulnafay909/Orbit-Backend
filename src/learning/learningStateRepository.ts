import { StudentLearningState } from "./types";

export interface LearningStateRepository {
  save(state: StudentLearningState): Promise<StudentLearningState>;
  get(studentId: string): Promise<StudentLearningState | undefined>;
  update(state: StudentLearningState): Promise<StudentLearningState>;
  delete(studentId: string): Promise<boolean>;
}
