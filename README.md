# SUN SPY AI v6 — World Class Mobile UI

## Frontend
Deploy `index.html`, `style.css`, `app.js` to GitHub Pages.

## Backend
Render:
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Environment variable: `GEMINI_API_KEY`

## Mobile behavior
- Enter = newline
- Ctrl/⌘ + Enter = send
- Hamburger opens drawer
- Tap scrim, close button, Escape, or swipe left to close
- Swipe from the left edge to open

## Chat
- Local chat history
- New chat
- Search saved chats
- Image attachment preview
- Stop generation
- Fast / Smart
- Voice input / speech
- Voice conversation toggle

## AI Code Agent
AI can return a complete edited file for review. The user must review/apply/download it; production deployment is not silently overwritten.

## Media
The UI contains workflows for Image, Video, Music and Recap. Actual media generation requires the corresponding provider/API to be configured on the backend. The app never pretends a file was generated when no provider generated it.
