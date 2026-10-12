import {
  LongTermLearningMemory,
  LongTermMemoryCategory,
  LongTermMemoryEntry,
  StudentLearningState,
  StudentPreferences,
} from "./types";

const MAX_MEMORY_ENTRIES = 100;
const MIN_CONFIDENCE = 0.55;

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function createId(category: LongTermMemoryCategory, content: string): string {
  const normalized = normalize(content)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `memory_${category.toLowerCase()}_${normalized || "item"}`;
}

export function createInitialLongTermMemory(
  stateInput: Pick<StudentLearningState, "existingKnowledge" | "preferences">
): LongTermLearningMemory {
  const memory: LongTermLearningMemory = {
    entries: [],
    updatedAt: new Date().toISOString(),
  };

  for (const knowledge of stateInput.existingKnowledge ?? []) {
    addOrReinforceMemory(memory, {
      category: "KNOWN_CAPABILITY",
      content: `Already knows: ${knowledge}`,
      evidence: "Student-provided existing knowledge",
      confidence: 0.7,
    });
  }

  addPreferenceMemories(memory, stateInput.preferences);
  return memory;
}

function addPreferenceMemories(
  memory: LongTermLearningMemory,
  preferences?: StudentPreferences
): void {
  if (!preferences) return;

  const values: Array<[string, string | undefined]> = [
    ["platform", preferences.platform],
    ["framework", preferences.framework],
    ["language", preferences.language],
    ["approach", preferences.approach],
  ];

  for (const [label, value] of values) {
    if (value) {
      addOrReinforceMemory(memory, {
        category: "PREFERENCE",
        content: `Prefers ${label}: ${value}`,
        evidence: "Student-provided learning preference",
        confidence: 0.9,
      });
    }
  }

  for (const tool of preferences.tools ?? []) {
    addOrReinforceMemory(memory, {
      category: "PREFERENCE",
      content: `Uses/prefer tool: ${tool}`,
      evidence: "Student-provided tool preference",
      confidence: 0.85,
    });
  }
}

export interface MemoryUpdateInput {
  category: LongTermMemoryCategory;
  action?: "ADD" | "REINFORCE" | "REMOVE";
  content: string;
  evidence: string;
  confidence: number;
}

function addOrReinforceMemory(
  memory: LongTermLearningMemory,
  input: Omit<MemoryUpdateInput, "action">
): void {
  const now = new Date().toISOString();
  const existing = memory.entries.find(
    (entry) =>
      entry.category === input.category &&
      normalize(entry.content) === normalize(input.content)
  );

  if (existing) {
    existing.occurrences += 1;
    existing.lastObservedAt = now;
    existing.confidence = Math.max(existing.confidence, input.confidence);
    if (input.evidence.trim()) existing.evidence = input.evidence.trim();
    return;
  }

  memory.entries.push({
    id: createId(input.category, input.content),
    category: input.category,
    content: input.content.trim(),
    evidence: input.evidence.trim(),
    confidence: Math.max(0, Math.min(1, input.confidence)),
    occurrences: 1,
    firstObservedAt: now,
    lastObservedAt: now,
  });
}

export function applyMemoryUpdates(
  memory: LongTermLearningMemory,
  updates: MemoryUpdateInput[]
): LongTermLearningMemory {
  const updated: LongTermLearningMemory = {
    entries: memory.entries.map((entry) => ({ ...entry })),
    updatedAt: new Date().toISOString(),
  };

  for (const update of updates) {
    const content = update.content.trim();
    if (!content || update.confidence < MIN_CONFIDENCE) continue;

    if (update.action === "REMOVE") {
      updated.entries = updated.entries.filter(
        (entry) =>
          !(
            entry.category === update.category &&
            normalize(entry.content) === normalize(content)
          )
      );
      continue;
    }

    addOrReinforceMemory(updated, {
      category: update.category,
      content,
      evidence: update.evidence,
      confidence: update.confidence,
    });
  }

  updated.entries = updated.entries
    .sort((a, b) => b.lastObservedAt.localeCompare(a.lastObservedAt))
    .slice(0, MAX_MEMORY_ENTRIES);

  return updated;
}

export function syncDerivedLongTermMemory(
  state: StudentLearningState
): StudentLearningState {
  let memory = applyMemoryUpdates(state.longTermMemory, []);

  const updates: MemoryUpdateInput[] = [];

  for (const skill of state.skills) {
    if (skill.status === "demonstrated" || skill.status === "mastered") {
      updates.push({
        category: "KNOWN_CAPABILITY",
        content: `Demonstrated capability: ${skill.name}`,
        evidence: `Skill status is ${skill.status}.`,
        confidence: skill.status === "mastered" ? 0.95 : 0.85,
      });
    }
  }

  for (const task of state.learningPath.tasks) {
    if (task.status === "completed" || task.status === "skipped") {
      updates.push({
        category: "ACCOMPLISHMENT",
        content: `Completed learning task: ${task.title}`,
        evidence:
          task.completionEvidence ||
          "Task was marked completed or skipped in the learning state.",
        confidence: task.completionEvidenceType === "SELF_REPORT" ? 0.7 : 0.9,
      });
    }
  }

  const currentTask = state.learningPath.tasks.find(
    (task) => task.id === state.currentTaskId
  );

  if (currentTask) {
    updates.push({
      category: "ACTIVE_FOCUS",
      content: `Currently working on: ${currentTask.title}`,
      evidence: "Current task in the learning state.",
      confidence: 0.95,
    });
  }

  memory = applyMemoryUpdates(memory, updates);

  // Remove stale ACTIVE_FOCUS entries so only the current practical focus remains.
  if (currentTask) {
    memory.entries = memory.entries.filter(
      (entry) =>
        entry.category !== "ACTIVE_FOCUS" ||
        normalize(entry.content) === normalize(`Currently working on: ${currentTask.title}`)
    );
  }

  memory = applyMemoryUpdates(memory, []);
  return {
    ...state,
    longTermMemory: memory,
  };
}

export function buildLongTermMemoryContext(
  memory: LongTermLearningMemory
): Array<Pick<LongTermMemoryEntry, "category" | "content" | "confidence" | "occurrences">> {
  return memory.entries
    .slice(0, 40)
    .map((entry) => ({
    category: entry.category,
    content: entry.content,
    confidence: entry.confidence,
    occurrences: entry.occurrences,
  }));
}
