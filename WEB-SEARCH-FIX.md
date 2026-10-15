# ORBIT web search fix

`POST /api/features/web-search` now tries Tavily when `TAVILY_API_KEY` is set, and falls back to Gemini Google Search grounding if Tavily is not configured or fails. Gemini grounding uses `GEMINI_API_KEY` and `GEMINI_SEARCH_MODEL` (defaults to `gemini-2.5-flash`).

In Render, confirm `GEMINI_API_KEY` is present under the backend service's Environment settings. `TAVILY_API_KEY` is optional. Deploy the updated backend source after committing/pushing it. The previous "not configured yet" message strongly suggests the deployed backend is running older code or has neither provider key configured.
