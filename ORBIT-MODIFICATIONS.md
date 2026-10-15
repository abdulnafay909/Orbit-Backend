# ORBIT backend modifications

- File analysis now supports PDF, JPG/JPEG, PNG, WEBP, GIF, Word DOCX, and plain-text TXT files (10 MB upload cap).
- DOCX text is extracted from its document XML without requiring native binaries or an extra npm package.
- Images continue through Gemini vision; PDF/DOCX/TXT content is passed to the configured AI orchestrator.
- Web search uses Tavily when `TAVILY_API_KEY` is configured; otherwise it uses Gemini Google Search grounding when `GEMINI_API_KEY` is available. Tavily is optional with this change.
- Copy `.env.example` to `.env` for local development. Do not commit `.env` or ship it in archives.

- Web search route now falls back to Gemini Google Search grounding when Tavily is missing or fails; see `WEB-SEARCH-FIX.md`.
