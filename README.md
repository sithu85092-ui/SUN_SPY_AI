# SUN SPY AI v8 — Stable Chat

This version keeps the v7 ChatGPT-style mobile UI and fixes transient Gemini 503 handling.

### Backend resilience
- Retries transient 429/500/502/503/504 failures with exponential backoff.
- Falls back from `gemini-3.8-flash` to `gemini-3.7-flash` when the primary is temporarily unavailable.
- Frontend shows a friendly message instead of raw Gemini JSON errors.

### Render
Root Directory: `backend`
Build Command: `npm install`
Start Command: `npm start`
Environment Variable: `GEMINI_API_KEY`

Never place the API key in GitHub Pages/frontend files.
