# Phase 12 AI orchestration environment

The orchestrator is provider-agnostic. It selects the primary provider and automatically falls back to configured providers.

```env
AI_PRIMARY_PROVIDER=gemini
AI_FALLBACK_PROVIDERS=groq,llama,openai

# Existing
GEMINI_API_KEY=your_gemini_key

# Optional
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_API_URL=https://api.groq.com/openai/v1/chat/completions

# Optional Llama-compatible endpoint (OpenRouter by default)
LLAMA_API_KEY=your_llama_provider_key
LLAMA_MODEL=meta-llama/llama-3.3-70b-instruct
LLAMA_API_URL=https://openrouter.ai/api/v1/chat/completions
LLAMA_APP_URL=http://localhost:5000
LLAMA_APP_NAME=AI Teacher

# Optional
OPENAI_API_KEY=your_openai_key
```

Provider names are `gemini`, `groq`, `llama`, and `openai`.
Only providers with an API key are registered. The configured primary is attempted first, followed by the configured fallback list, then any remaining configured providers.
