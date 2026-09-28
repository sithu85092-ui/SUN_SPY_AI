// @ts-nocheck

import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const PRIMARY_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.7-flash";
const VIDEO_MODEL = "veo-3.1-generate-preview";

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

You can help plan and create prompts/workflows for text-to-image, image-to-image, text-to-video, photo-to-video, music, video recap, voice, translation, writing, coding and UI design. SUN SPY AI can generate real 8-second video jobs through the configured Google Veo provider. Never claim a file was generated unless the provider operation completed successfully.

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

Important action truthfulness rules:
- The model does not directly execute frontend actions. The frontend executes allow-listed commands.
- For "change this photo to background" when the user uploaded an image in the same request, use [[UI:UI_SET_BACKGROUND]] and say it is being applied locally.
- Do not claim that a background was changed to a trending image, a named movie/donghua character, or an online image unless an actual image URL/provider result is supplied to the application.
- Do not claim buttons, layouts, text, files, or code were changed unless the frontend actually performed that operation.
- Never invent successful execution just because a command was requested.

For the first interaction in a new chat, greet the user briefly and introduce yourself as SUN SPY AI, built by SI THU KYAW, then mention the main things you can help with in one compact paragraph.

BACKGROUND COMMAND RULE: If an uploaded image is requested as the app background (for example "ဒီပုံကို background လုပ်", "use this as background", "set this photo as background"), this is NOT image editing. Emit [[UI:UI_SET_BACKGROUND]] and do not discuss replacing the photo background.

VIDEO RULE: If the user asks to generate a video and the request reaches the Video Studio, help produce a concise generation prompt. The frontend/backend will perform the actual Veo job. Do not say a video was generated until the job reports done.

CODE AGENT RULE: You may propose edits to the supplied project files. Return complete files only when requested by the Code Agent. Never claim that production files were changed unless the application actually wrote them.

For UI requests, prefer actionable intent. If the user asks to add/remove a button or change layout, use the allow-listed UI command and explain that the change is applied locally or can be prepared in the Code Agent. Never claim to have edited a production file unless the frontend actually applied it.

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
    version: "9.0.0",
    ai: Boolean(API_KEY),
    model: PRIMARY_MODEL
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    service: "SUN SPY AI",
    status: "ok",
    geminiConfigured: Boolean(API_KEY),
    model: PRIMARY_MODEL
  });
});

app.post("/api/chat", async (req, res) => {
  const message = req.body?.message;
  const mode = req.body?.mode === "smart" ? "smart" : "fast";
  const history = req.body?.history;
  const image = req.body?.image || null;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }
  if (!API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY is missing" });
  if (!ai) return res.status(500).json({ error: "Gemini client is not initialized" });

  const thinkingLevel = mode === "smart" ? "high" : "low";
  const contents = buildContents(message, history, image);

  console.log("User:", message);
  console.log("Mode:", mode, "Thinking:", thinkingLevel, "Streaming: SSE");

  const headersStarted = () => Boolean(res.headersSent);
  let streamStarted = false;
  let sentText = false;
  let uiChecked = false;
  let commandBuffer = "";

  const sendEvent = (type, payload = {}) => {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
  };

  const emitModelText = (text) => {
    if (!text) return;
    sentText = true;
    sendEvent("delta", { text });
  };

  const emitUIAndText = (chunk) => {
    if (!chunk) return;
    if (uiChecked) return emitModelText(chunk);

    commandBuffer += chunk;
    const tokenMatch = commandBuffer.match(/^\s*\[\[UI:(THEME_DARK|THEME_LIGHT|THEME_MIDNIGHT|ACCENT_PURPLE|ACCENT_BLUE|ACCENT_GREEN|DENSITY_COMPACT|DENSITY_COMFORTABLE|DENSITY_SPACIOUS|UI_ADD_BUTTON|UI_REMOVE_BUTTON|UI_SET_TEXT|UI_SET_BACKGROUND|UI_SET_LAYOUT)\]\]\s*/);

    if (tokenMatch) {
      uiChecked = true;
      const token = tokenMatch[1];
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
      sendEvent("ui", { command: map[token] });
      const rest = commandBuffer.slice(tokenMatch[0].length);
      commandBuffer = "";
      if (rest) emitModelText(rest);
      return;
    }

    // If this is clearly not a UI token, release buffered text immediately.
    // If it starts like a UI token, wait until the complete token arrives.
    if (!/^\s*\[\[UI:/.test(commandBuffer) || commandBuffer.length > 260) {
      uiChecked = true;
      const rest = commandBuffer;
      commandBuffer = "";
      emitModelText(rest);
    }
  };

  const makeStream = async (modelName) => {
    const stream = await ai.models.generateContentStream({
      model: modelName,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingLevel }
      }
    });

    let gotChunk = false;
    let lastChunkAt = Date.now();
    for await (const chunk of stream) {
      lastChunkAt = Date.now();
      const text = chunk?.text || "";
      if (text) {
        gotChunk = true;
        emitUIAndText(text);
        // Keep proxies/load balancers aware that the SSE connection is active.
        sendEvent("heartbeat", { t: lastChunkAt });
      }
    }
    return gotChunk;
  };

  const retryableError = (err) => {
    const status = Number(err?.status || err?.code || 0);
    const text = String(err?.message || "");
    return [429, 500, 502, 503, 504].includes(status) || /UNAVAILABLE|high demand|temporar/i.test(text);
  };

  try {
    // Open SSE only after request validation, so normal HTTP errors remain JSON.
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (typeof res.flushHeaders === "function") res.flushHeaders();

    sendEvent("meta", { model: PRIMARY_MODEL, mode, streaming: true });
    streamStarted = true;

    let usedModel = PRIMARY_MODEL;
    let completed = false;
    let lastError = null;

    for (let attempt = 0; attempt < 3 && !completed; attempt++) {
      try {
        await Promise.race([
          makeStream(PRIMARY_MODEL),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini stream timeout after 120 seconds")), 120000))
        ]);
        completed = true;
      } catch (err) {
        lastError = err;
        if (!retryableError(err) || sentText || attempt === 2) break;
        await new Promise(r => setTimeout(r, 500 * (2 ** attempt)));
      }
    }

    if (!completed && retryableError(lastError) && !sentText) {
      console.warn(`Primary stream unavailable; switching to ${FALLBACK_MODEL}`);
      usedModel = FALLBACK_MODEL;
      commandBuffer = "";
      uiChecked = false;
      for (let attempt = 0; attempt < 2 && !completed; attempt++) {
        try {
          await Promise.race([
            makeStream(FALLBACK_MODEL),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Fallback Gemini stream timeout after 120 seconds")), 120000))
          ]);
          completed = true;
        } catch (err) {
          lastError = err;
          if (!retryableError(err) || sentText || attempt === 1) break;
          await new Promise(r => setTimeout(r, 500 * (2 ** attempt)));
        }
      }
    }

    if (!completed) throw lastError || new Error("Gemini stream ended unexpectedly");

    if (!uiChecked && commandBuffer) emitModelText(commandBuffer);
    sendEvent("done", { model: usedModel });
    res.end();
  } catch (error) {
    console.error("========== GEMINI STREAM ERROR ==========");
    console.error(error);
    console.error("Message:", error?.message);
    console.error("Status:", error?.status);
    console.error("Code:", error?.code);
    console.error("=========================================");

    if (streamStarted) {
      sendEvent("error", {
        error: "Gemini API error",
        details: error?.message || String(error),
        partial: sentText
      });
      res.end();
    } else {
      return res.status(500).json({ error: "Gemini API error", details: error?.message || String(error) });
    }
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
      model: PRIMARY_MODEL,
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



function cleanBase64Data(value) {
  if (typeof value !== "string") return null;
  return value.includes(",") ? value.split(",", 2)[1] : value;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

app.post("/api/video/generate", async (req, res) => {
  try {
    if (!API_KEY || !ai) return res.status(500).json({ error: "GEMINI_API_KEY is missing" });
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    const aspectRatio = ["16:9", "9:16"].includes(req.body?.aspectRatio) ? req.body.aspectRatio : "16:9";
    const resolution = ["720p", "1080p"].includes(req.body?.resolution) ? req.body.resolution : "720p";
    const image = req.body?.image;
    if (!prompt) return res.status(400).json({ error: "Video prompt is required" });

    const payload = {
      instances: [{ prompt }],
      parameters: { aspectRatio, resolution, numberOfVideos: 1 }
    };
    if (image?.data) {
      payload.instances[0].image = {
        bytesBase64Encoded: cleanBase64Data(image.data),
        mimeType: image.mimeType || "image/jpeg"
      };
    }

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${VIDEO_MODEL}:predictLongRunning`, {
      method: "POST",
      headers: { "x-goog-api-key": API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: "Video generation request failed", details: data?.error?.message || JSON.stringify(data) });
    res.json({ ok: true, operation: data.name, model: VIDEO_MODEL, aspectRatio, resolution });
  } catch (error) {
    console.error("VIDEO GENERATE ERROR", error);
    res.status(500).json({ error: "Video generation error", details: error?.message || String(error) });
  }
});

app.get("/api/video/status", async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY is missing" });
    const name = String(req.query?.name || "");
    if (!name || !/^operations\//.test(name)) return res.status(400).json({ error: "Invalid operation name" });
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}`, { headers: { "x-goog-api-key": API_KEY } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: "Video status failed", details: data?.error?.message || JSON.stringify(data) });
    if (!data.done) return res.json({ done: false, operation: name });
    if (data.error) return res.status(502).json({ done: true, error: data.error.message || "Video generation failed" });
    const sample = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video;
    const uri = sample?.uri || null;
    if (!uri) return res.status(502).json({ done: true, error: "Video completed without a video URI" });
    res.json({ done: true, videoUrl: `/api/video/file?uri=${encodeURIComponent(uri)}` });
  } catch (error) {
    console.error("VIDEO STATUS ERROR", error);
    res.status(500).json({ error: "Video status error", details: error?.message || String(error) });
  }
});

app.get("/api/video/file", async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY is missing" });
    const uri = String(req.query?.uri || "");
    if (!uri.startsWith("https://generativelanguage.googleapis.com/")) return res.status(400).json({ error: "Invalid video URI" });
    const r = await fetch(uri, { headers: { "x-goog-api-key": API_KEY } });
    if (!r.ok) { const t = await r.text(); return res.status(r.status).send(t); }
    res.setHeader("Content-Type", r.headers.get("content-type") || "video/mp4");
    res.setHeader("Cache-Control", "private, max-age=3600");
    if (r.body) {
      for await (const chunk of r.body) res.write(chunk);
      return res.end();
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.end(buf);
  } catch (error) {
    console.error("VIDEO FILE ERROR", error);
    if (!res.headersSent) res.status(500).json({ error: "Video download error", details: error?.message || String(error) });
    else res.end();
  }
});

app.post("/api/code-agent", async (req, res) => {
  try {
    if (!API_KEY || !ai) return res.status(500).json({ error: "GEMINI_API_KEY is missing" });
    const instruction = String(req.body?.instruction || "").trim();
    const files = req.body?.files && typeof req.body.files === "object" ? req.body.files : {};
    const entries = Object.entries(files).filter(([name, code]) => typeof name === "string" && typeof code === "string");
    if (!instruction || !entries.length) return res.status(400).json({ error: "instruction and project files are required" });
    const total = entries.reduce((n,[,c]) => n + c.length, 0);
    if (total > 240000) return res.status(413).json({ error: "Project is too large. Keep combined source under 240 KB." });
    const project = entries.map(([name, code]) => `\n===== FILE: ${name} =====\n${code}`).join("\n");
    const prompt = `You are SUN SPY AI Project Code Agent.
User request:
${instruction}

Project files:${project}

Return ONLY valid JSON with this shape: {"summary":"...","files":{"filename":"complete file contents"},"tests":["..."]}. Include only files that must change. Preserve existing features. Fix related syntax/runtime issues. Do not add secrets, malware, credential theft, destructive behavior, or unauthorized access. Do not use markdown fences.`;
    const agentConfig = {
      responseMimeType: "application/json",
      systemInstruction: SYSTEM_INSTRUCTION + "\nYou are operating as a project code agent. Never claim files were written to production.",
      thinkingConfig: { thinkingLevel: "high" },
      maxOutputTokens: 65536
    };

    let response = await ai.models.generateContent({
      model: PRIMARY_MODEL, contents: prompt, config: agentConfig
    });
    let parsed;
    const rawText = String(response.text || "").trim();
    try {
      parsed = JSON.parse(rawText || "{}");
    } catch (firstError) {
      // Large source files can make a single JSON response hit an output limit.
      // Retry with a compact instruction rather than exposing a confusing parser error.
      const compactPrompt = `You are editing a web project.\nUser request: ${instruction}\n\nReturn ONLY one valid JSON object with this exact shape: {"summary":"...","files":{"filename":"complete file contents"},"tests":["..."]}.\nOnly include the minimum files that must change. Keep the complete contents of each changed file. Do not use markdown fences. If a file does not need changes, omit it.\nProject files:\n${project}`;
      try {
        response = await ai.models.generateContent({
          model: PRIMARY_MODEL, contents: compactPrompt,
          config: { ...agentConfig, thinkingConfig: { thinkingLevel: "low" }, maxOutputTokens: 65536 }
        });
        parsed = JSON.parse(String(response.text || "").trim() || "{}");
      } catch (secondError) {
        return res.status(502).json({
          error: "Code Agent response was incomplete. Please retry; large projects are processed in a smaller edit pass.",
          retryable: true
        });
      }
    }
    if (!parsed.files || typeof parsed.files !== "object") return res.status(502).json({ error: "Code Agent returned no files" });
    res.json({ ok: true, ...parsed });
  } catch (error) {
    console.error("CODE AGENT ERROR", error);
    res.status(500).json({ error: "AI Code Agent error", details: error?.message || String(error) });
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
  console.log("Primary model:", PRIMARY_MODEL);
  console.log("Fallback model:", FALLBACK_MODEL);
  console.log("Gemini configured:", Boolean(API_KEY));
  console.log("================================");
});
