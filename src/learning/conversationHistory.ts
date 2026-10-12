import {
  ConversationMessage,
  StudentLearningState,
} from "./types";

export function addConversationMessage(
  state: StudentLearningState,
  role: ConversationMessage["role"],
  content: string
): StudentLearningState {
  return {
    ...state,
    conversationHistory: [
      ...state.conversationHistory,
      {
        role,
        content,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export function getRecentConversation(
  state: StudentLearningState,
  limit = 10
): ConversationMessage[] {
  return state.conversationHistory.slice(-limit);
}