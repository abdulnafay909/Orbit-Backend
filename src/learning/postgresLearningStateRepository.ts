import { LearningStateRepository } from "./learningStateRepository";
import { StudentLearningState } from "./types";
import { pool, withTransaction } from "../db/database";

export class PostgresLearningStateRepository implements LearningStateRepository {
  async save(state: StudentLearningState): Promise<StudentLearningState> {
    return this.persist(state);
  }

  async update(state: StudentLearningState): Promise<StudentLearningState> {
    return this.persist(state);
  }

  async get(studentId: string): Promise<StudentLearningState | undefined> {
    const result = await pool.query(
      `SELECT state_json FROM learning_sessions WHERE student_id = $1`,
      [studentId]
    );

    if (result.rowCount === 0) return undefined;

    const raw = result.rows[0].state_json as StudentLearningState & {
      outcomeVerification?: StudentLearningState["outcomeVerification"];
      outcomeEvidence?: StudentLearningState["outcomeEvidence"];
    };

    // Backward-compatible migration for Phase 6/7/8 sessions.
    return {
      ...raw,
      outcomeVerification: raw.outcomeVerification ?? {
        status: "NOT_STARTED",
        summary: "",
        confidence: 0,
        lastEvidenceType: "NONE",
        updatedAt: new Date().toISOString(),
      },
      outcomeEvidence: raw.outcomeEvidence ?? [],
    };
  }

  async delete(studentId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM students WHERE id = $1`,
      [studentId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  private async persist(
    state: StudentLearningState
  ): Promise<StudentLearningState> {
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO students (id)
         VALUES ($1)
         ON CONFLICT (id) DO NOTHING`,
        [state.studentId]
      );

      await client.query(
        `INSERT INTO learning_sessions (
           student_id, course, goal, preferences, existing_knowledge,
           constraints, outcome, learning_path, current_task_id,
           completed_task_ids, skipped_task_ids, learning_history,
           conversation_history, state_json, updated_at
         )
         VALUES ($1,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,
                 $7::jsonb,$8::jsonb,$9,$10::jsonb,$11::jsonb,$12::jsonb,
                 $13::jsonb,$14::jsonb,NOW())
         ON CONFLICT (student_id) DO UPDATE SET
           course = EXCLUDED.course,
           goal = EXCLUDED.goal,
           preferences = EXCLUDED.preferences,
           existing_knowledge = EXCLUDED.existing_knowledge,
           constraints = EXCLUDED.constraints,
           outcome = EXCLUDED.outcome,
           learning_path = EXCLUDED.learning_path,
           current_task_id = EXCLUDED.current_task_id,
           completed_task_ids = EXCLUDED.completed_task_ids,
           skipped_task_ids = EXCLUDED.skipped_task_ids,
           learning_history = EXCLUDED.learning_history,
           conversation_history = EXCLUDED.conversation_history,
           state_json = EXCLUDED.state_json,
           updated_at = NOW()`,
        [
          state.studentId,
          JSON.stringify(state.course),
          JSON.stringify(state.goal),
          JSON.stringify(state.preferences ?? null),
          JSON.stringify(state.existingKnowledge ?? []),
          JSON.stringify(state.constraints ?? []),
          JSON.stringify(state.outcome),
          JSON.stringify(state.learningPath),
          state.currentTaskId ?? null,
          JSON.stringify(state.completedTaskIds),
          JSON.stringify(state.skippedTaskIds),
          JSON.stringify(state.learningHistory),
          JSON.stringify(state.conversationHistory),
          JSON.stringify(state),
        ]
      );

      await client.query(`DELETE FROM learning_tasks WHERE student_id = $1`, [state.studentId]);
      for (const task of state.learningPath.tasks) {
        await client.query(
          `INSERT INTO learning_tasks
             (student_id, task_id, title, description, status, required_skills, task_order, completion_evidence, completion_evidence_type)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)`,
          [
            state.studentId, task.id, task.title, task.description, task.status,
            JSON.stringify(task.requiredSkills), task.order,
            task.completionEvidence ?? null, task.completionEvidenceType ?? null,
          ]
        );
      }

      await client.query(`DELETE FROM student_skills WHERE student_id = $1`, [state.studentId]);
      for (const skill of state.skills) {
        await client.query(
          `INSERT INTO student_skills (student_id, skill_id, name, description, status)
           VALUES ($1,$2,$3,$4,$5)`,
          [state.studentId, skill.id, skill.name, skill.description ?? null, skill.status]
        );
      }

      await client.query(`DELETE FROM learning_history WHERE student_id = $1`, [state.studentId]);
      for (let i = 0; i < state.learningHistory.length; i++) {
        await client.query(
          `INSERT INTO learning_history (student_id, history_order, entry) VALUES ($1,$2,$3)`,
          [state.studentId, i, state.learningHistory[i]]
        );
      }

      await client.query(`DELETE FROM conversation_messages WHERE student_id = $1`, [state.studentId]);
      for (let i = 0; i < state.conversationHistory.length; i++) {
        const message = state.conversationHistory[i];
        await client.query(
          `INSERT INTO conversation_messages (student_id, message_order, role, content, message_timestamp)
           VALUES ($1,$2,$3,$4,$5)`,
          [state.studentId, i, message.role, message.content, message.timestamp]
        );
      }
    });

    return state;
  }
}
