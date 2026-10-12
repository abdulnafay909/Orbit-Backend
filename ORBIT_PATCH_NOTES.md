# ORBIT backend patch notes

Changes in this archive:
- Added authenticated `/api/teacher/respond/stream` SSE transport for learning chat while preserving the existing learning-state engine and ownership check.
- Added learning-context-aware PDF/image analysis so Learn uploads do not create or contaminate General Chat conversation history.
- General Chat file analysis behavior is preserved.

Security:
- The supplied archive contained a `.env` file. It is intentionally excluded from this output archive. Copy `.env.example` to `.env` and enter your own credentials.
- If the original archive was shared beyond your own machine, rotate the exposed API/database/JWT credentials.

Verification:
- Changed TypeScript files passed syntax transpilation.
- A full `npm run build` could not be verified in this environment because dependency installation did not complete; run `npm ci` and `npm run build` locally.
