# SUN SPY AI — v12 FREE VIDEO

SUN SPY AI chat/coding tools plus a free video path using a public Hugging Face Gradio Space running a Wan2.2-based model.

## Free video
- Text → Video through a public GPU queue.
- No Veo API key is required for the free path.
- Public queue, sleeping Space, rate limits and anonymous quota can affect availability.
- Do not upload sensitive/private material to the public provider.
- The existing paid Google Veo endpoints are still present but the Video Studio button uses the free path by default.

## Backend
- `backend/server.js`
- `GEMINI_API_KEY` remains server-side for chat/coding.
- Free video uses the public Gradio API at `mastap-wan22-remix-sfw-t2v.hf.space` and does not require a secret in SUN SPY AI.

## Run
```bash
cd backend
npm install
npm start
```
