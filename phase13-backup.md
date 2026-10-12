# Phase 13 AI Reliability Configuration

Optional environment variables:

```env
# Maximum time to wait for an individual provider request.
AI_PROVIDER_TIMEOUT_MS=30000

# Number of JSON recovery attempts on a provider.
AI_JSON_RECOVERY_ATTEMPTS=1

# Maximum serialized learning context sent to a provider.
AI_MAX_CONTEXT_CHARS=24000

# Maximum items retained per context array at orchestration boundary.
AI_MAX_CONTEXT_ARRAY_ITEMS=20

# Maximum characters retained per context string.
AI_MAX_CONTEXT_STRING_CHARS=4000
```

Recommended low-cost development configuration:

```env
AI_PRIMARY_PROVIDER=gemini
AI_FALLBACK_PROVIDERS=groq

AI_PROVIDER_TIMEOUT_MS=30000
AI_JSON_RECOVERY_ATTEMPTS=1
AI_MAX_CONTEXT_CHARS=24000
AI_MAX_CONTEXT_ARRAY_ITEMS=20
AI_MAX_CONTEXT_STRING_CHARS=4000
```

Do not put API keys in this file or commit them to source control.

## Behavior

- The orchestrator stops immediately after a valid provider response.
- A provider timeout or temporary failure moves to the next configured provider.
- Invalid JSON gets one controlled recovery attempt by default.
- Empty responses are rejected.
- Provider diagnostics stay on the backend.
- Teacher-facing failures are converted to user-friendly messages.
- Context is bounded before it reaches a model.
- No learning quizzes, mandatory evidence, or assessment gates are introduced.
