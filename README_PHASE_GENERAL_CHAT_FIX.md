# ORBIT Backend — General Chat Session Fix

## What was fixed

`POST /api/teacher/respond` now branches on `mode` before attempting to load a learning session.

### General Chat (`mode: "GENERAL_TEACHER"`)

- Calls the existing AI orchestrator directly.
- Does not call `getLearningSession`, `generateTeacherResponse`, or `updateLearningSession`.
- Does not create or mutate a learning state.
- Returns the response in the existing `decision.response` shape expected by the React Native client.
- Sets task completion/progression flags to false and returns `updatedState: null`.
- Accepts an optional `conversationHistory` array (last 12 user/assistant messages, each content capped at 4,000 characters). This is optional for backward compatibility.

### Course / learning modes

- Continue through the existing learning-session service.
- Require a `studentId` and a matching learning session.
- Keep course progress/state updates in the existing service.
- Return a more actionable 404 message if the selected course has not been started yet.

### Validation / product consistency

- Validates mode and message once.
- Rejects empty messages and messages over 20,000 characters.
- Updates health/test prompts to use ORBIT naming.

## Important note about conversation history

The current frontend's `sendTeacherMessage` request sends `studentId`, `message`, and `mode`. It does not currently send `conversationHistory`, so this backend fix resolves the immediate error but does not by itself add server-side persistence for General Chat history. The frontend can optionally pass recent messages using:

```ts
conversationHistory: [
  { role: "user", content: "Earlier user message" },
  { role: "assistant", content: "Earlier ORBIT response" }
]
```

This history is used only for `GENERAL_TEACHER`; it is never pulled from course learning state. Durable, per-chat history across app restarts should be implemented as a separate persistence/authentication phase.

## Apply

1. Stop the running backend.
2. Back up your current `backend/src/server.ts`.
3. Copy the updated `src/server.ts` from this archive into your backend.
4. Keep your existing local `.env` file; it is intentionally not included in this archive so secrets are not redistributed.
5. From the backend directory, run:

```powershell
npm install
npm run build
npm run dev
```

## Quick API test

With the backend running, run this in PowerShell:

```powershell
$body = @{
  message = "What is the difference between weather and climate?"
  mode = "GENERAL_TEACHER"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:5000/api/teacher/respond" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

Expected: `success = true`, `decision.response` contains ORBIT's answer, and `updatedState` is `null`. The request should succeed even if no learning session exists for this general conversation.

For course mode, send the course-specific `studentId` and a valid learning mode. Course requests still require a previously created learning session.
