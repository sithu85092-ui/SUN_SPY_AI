// @ts-nocheck

import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3.8-flash";

app.use(cors());
app.use(express.json({ limit: "10mb" }));

let ai = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
  console.log("Gemini API configured");
} else {
  console.error("GEMINI_API_KEY is missing");
}

const SYSTEM_INSTRUCTION = `
You are SUN SPY AI.

You are a friendly, natural, direct AI assistant.
Speak like a helpful human, not a robotic corporate bot.
Support Burmese and English. If the user speaks Burmese, answer naturally in Burmese.

Help with general questions, programming, coding, writing, translation,
technology, education, authorized cybersecurity education, and mature sexual
health/relationship education.

For cybersecurity, only help with authorized, defensive and educational work.
Do not help with credential theft, malware deployment, destructive attacks,
or unauthorized intrusion.

Do not generate explicit sexual imagery or sexual content involving minors.

SUN SPY AI has a user-controlled interface. If the user asks to change the
appearance, explain the change naturally. The frontend has an allow-listed
appearance controller. Never invent arbitrary JavaScript or CSS commands.

Available UI commands are only:
THEME_DARK
THEME_LIGHT
THEME_MIDNIGHT
ACCENT_PURPLE
ACCENT_BLUE
ACCENT_GREEN
DENSITY_COMPACT
DENSITY_COMFORTABLE
DENSITY_SPACIOUS

When a UI change is requested, put exactly one command token on the first line:
[[UI:THEME_LIGHT]]
or one of the other allowed tokens above.
Then write the normal friendly answer below it.
If no UI change is requested, do not include a UI token.

Be concise when a short answer is enough.
`;

function buildContents(message, history = []) {
  const safeHistory = Array.isArray(history) ? history.slice(-12) : [];
  const contents = [];

  for (const item of safeHistory) {
    if (!item || typeof item.text !== "string") continue;
    contents.push({
      role: item.role === "model" ? "model" : "user",
      parts: [{ text: item.text.slice(0, 12000) }]
    });
  }

  contents.push({
    role: "user",
    parts: [{ text: message }]
  });

  return contents;
}

function parseUICommand(reply) {
  const match = reply.match(/^\s*\[\[UI:(THEME_DARK|THEME_LIGHT|THEME_MIDNIGHT|ACCENT_PURPLE|ACCENT_BLUE|ACCENT_GREEN|DENSITY_COMPACT|DENSITY_COMFORTABLE|DENSITY_SPACIOUS)\]\]\s*/);
  if (!match) return { reply, uiCommand: null };

  const token = match[1];
  const map = {
    THEME_DARK: { action: "theme", value: "dark" },
    THEME_LIGHT: { action: "theme", value: "light" },
    THEME_MIDNIGHT: { action: "theme", value: "midnight" },
    ACCENT_PURPLE: { action: "accent", value: "#7c5cff" },
    ACCENT_BLUE: { action: "accent", value: "#3b82f6" },
    ACCENT_GREEN: { action: "accent", value: "#22c55e" },
    DENSITY_COMPACT: { action: "density", value: "compact" },
    DENSITY_COMFORTABLE: { action: "density", value: "comfortable" },
    DENSITY_SPACIOUS: { action: "density", value: "spacious" }
  };

  return {
    reply: reply.slice(match[0].length),
    uiCommand: map[token]
  };
}

app.get("/", (req, res) => {
  res.json({
    service: "SUN SPY AI",
    status: "online",
    version: "3.0.0",
    ai: Boolean(API_KEY),
    model: MODEL
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    service: "SUN SPY AI",
    status: "ok",
    geminiConfigured: Boolean(API_KEY),
    model: MODEL
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const message = req.body?.message;
    const mode = req.body?.mode === "smart" ? "smart" : "fast";
    const history = req.body?.history;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is missing" });
    }

    if (!ai) {
      return res.status(500).json({ error: "Gemini client is not initialized" });
    }

    const thinkingLevel = mode === "smart" ? "high" : "low";

    console.log("User:", message);
    console.log("Mode:", mode, "Thinking:", thinkingLevel);

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: buildContents(message, history),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        thinkingConfig: {
          thinkingLevel
        }
      }
    });

    const rawReply = response.text;

    if (!rawReply) {
      return res.status(502).json({
        error: "Gemini returned an empty response"
      });
    }

    const parsed = parseUICommand(rawReply);

    return res.json({
      reply: parsed.reply,
      uiCommand: parsed.uiCommand,
      model: MODEL,
      mode
    });
  } catch (error) {
    console.error("========== GEMINI ERROR ==========");
    console.error(error);
    console.error("Message:", error?.message);
    console.error("Status:", error?.status);
    console.error("Code:", error?.code);
    console.error("==================================");

    return res.status(500).json({
      error: "Gemini API error",
      details: error?.message || String(error)
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl
  });
});

app.listen(PORT, () => {
  console.log("================================");
  console.log("SUN SPY AI SERVER");
  console.log("Port:", PORT);
  console.log("Model:", MODEL);
  console.log("Gemini configured:", Boolean(API_KEY));
  console.log("================================");
});
