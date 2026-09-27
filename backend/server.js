// @ts-nocheck

import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3.8-flash";

app.use(cors());
app.use(express.json({ limit: "20mb" }));

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

The product is made by SI THU KYAW and is called SUN SPY AI. Keep the welcome identity concise and friendly.

You can help plan and create prompts/workflows for text-to-image, image-to-image, text-to-video, photo-to-video, music, video recap, voice, translation, writing, coding and UI design. Actual media generation depends on configured provider APIs; never claim a provider generated a file when it did not.

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
UI_ADD_BUTTON
UI_REMOVE_BUTTON
UI_SET_TEXT
UI_SET_BACKGROUND
UI_SET_LAYOUT

When a UI change is requested, put exactly one command token on the first line:
[[UI:THEME_LIGHT]]
or one of the other allowed tokens above.
Then write the normal friendly answer below it.
If no UI change is requested, do not include a UI token.

Be concise when a short answer is enough.
`;

function buildContents(message, history = [], image = null) {
  const safeHistory = Array.isArray(history) ? history.slice(-12) : [];
  const contents = [];
  for (const item of safeHistory) {
    if (!item || typeof item.text !== "string") continue;
    contents.push({
      role: item.role === "model" ? "model" : "user",
      parts: [{ text: item.text.slice(0, 12000) }]
    });
  }
  const parts = [{ text: message || "Please analyze the uploaded image." }];
  if (image && typeof image.data === "string" && image.data) {
    parts.push({ inlineData: { mimeType: image.mimeType || "image/jpeg", data: image.data } });
  }
  contents.push({ role: "user", parts });
  return contents;
}


function parseUICommand(reply) {
  const match = reply.match(/^\s*\[\[UI:(THEME_DARK|THEME_LIGHT|THEME_MIDNIGHT|ACCENT_PURPLE|ACCENT_BLUE|ACCENT_GREEN|DENSITY_COMPACT|DENSITY_COMFORTABLE|DENSITY_SPACIOUS|UI_ADD_BUTTON|UI_REMOVE_BUTTON|UI_SET_TEXT|UI_SET_BACKGROUND|UI_SET_LAYOUT)\]\]\s*/);
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
    DENSITY_SPACIOUS: { action: "density", value: "spacious" },
    UI_ADD_BUTTON: { action: "ui_request", value: "add_button" },
    UI_REMOVE_BUTTON: { action: "ui_request", value: "remove_button" },
    UI_SET_TEXT: { action: "ui_request", value: "set_text" },
    UI_SET_BACKGROUND: { action: "ui_request", value: "background" },
    UI_SET_LAYOUT: { action: "ui_request", value: "layout" }
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
    version: "5.0.0",
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
    const image = req.body?.image || null;

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
      contents: buildContents(message, history, image),
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


app.post("/api/code-edit", async (req, res) => {
  try {
    const fileName = typeof req.body?.fileName === "string" ? req.body.fileName : "app.js";
    const instruction = typeof req.body?.instruction === "string" ? req.body.instruction : "";
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    const mode = req.body?.mode === "smart" ? "smart" : "fast";

    if (!instruction || !code) return res.status(400).json({ error: "instruction and code are required" });
    if (code.length > 120000) return res.status(413).json({ error: "Code is too large. Keep it under 120 KB." });

    const prompt = `You are SUN SPY AI Code Editor.

File: ${fileName}

User request:
${instruction}

Current code:
\`\`\`\n${code}
\`\`\`

Return ONLY the complete corrected file contents. Do not wrap it in Markdown fences. Preserve working functionality unless the request requires changing it. Fix syntax errors you introduce. Do not add secrets, API keys, malware, credential theft, destructive code, or unauthorized access logic.`;
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION + "\nYou can edit code, but return complete files for user review before application.", thinkingConfig: { thinkingLevel: mode === "smart" ? "high" : "low" } }
    });
    const edited = response.text?.trim();
    if (!edited) return res.status(502).json({ error: "Gemini returned empty code" });
    const clean = edited.replace(/^```[a-zA-Z0-9_-]*\s*/, "").replace(/\s*```$/, "").trim();
    res.json({ fileName, code: clean, mode });
  } catch (error) {
    console.error("CODE EDIT ERROR", error);
    res.status(500).json({ error: "AI code edit error", details: error?.message || String(error) });
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
