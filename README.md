# SUN SPY AI v5 — Professional Mobile AI Studio

## Included
- ChatGPT-style chat UI with Fast / Smart modes
- Enter = new line; Ctrl/⌘ + Enter = send
- Stop generation button
- Image attachment preview + mobile-size compression + Gemini vision input
- Burmese/English welcome identity for SI THU KYAW / SUN SPY AI
- Voice input, text-to-speech and local voice-conversation controls
- Local phone/browser chat history, New Chat, export and clear
- AI Coder: edit -> review -> apply -> download workflow
- UI customization through allow-listed AI commands
- Online background URL + local image/video background
- Text-to-image / text-to-video / photo-to-video / music / recap workflow panels
- Video project duration selector up to 120 seconds

## Important media note
The UI supports a 120-second video project, but a single Veo 3.1 generation is 4/6/8 seconds. Current Gemini documentation says Veo 3.1 can extend Veo-generated videos in 7-second steps and can produce an extended output up to 148 seconds. A real 2-minute generator therefore needs a backend orchestration/extension pipeline and the relevant media API access.

## Render
Root directory: `backend`
Build command: `npm install`
Start command: `npm start`
Environment variable: `GEMINI_API_KEY`

## GitHub Pages
Upload `index.html`, `style.css`, and `app.js` to the Pages site. Keep the Gemini API key only on Render; never put it in frontend code.
