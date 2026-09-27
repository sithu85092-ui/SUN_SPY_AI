// @ts-nocheck
"use strict";

document.addEventListener("DOMContentLoaded", function () {
  const BACKEND_URL = "https://sun-spy-ai.onrender.com";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const sidebar = $("#sidebar");
  const menuButton = $("#menuButton");
  const headerTitle = $("#headerTitle");
  const newChatButton = $("#newChat");
  const messageInput = $("#messageInput");
  const sendButton = $("#sendButton");
  const messages = $("#messages");
  const settingsButton = $("#settingsButton");
  const modeButtons = $$(".mode-button");
  const composerStatus = $("#composerStatus");
  const imageInput = $("#imageInput");
  const attachButton = $("#attachButton");

  const pageTitles = {
    chat: "Chat", writer: "Writer", coder: "Coder", translate: "Translate",
    image: "Image", voice: "Voice", video: "Video", recap: "Video Recap",
    settings: "Appearance"
  };

  let currentMode = localStorage.getItem("sunspy_mode") || "fast";
  let conversation = [];
  let uiHistory = [];

  function openPage(name) {
    $$(".page").forEach(p => p.classList.remove("active"));
    $$(".nav-item").forEach(n => n.classList.remove("active"));
    const page = $("#page-" + name);
    const nav = document.querySelector('.nav-item[data-page="' + name + '"]');
    if (page) page.classList.add("active");
    if (nav) nav.classList.add("active");
    if (headerTitle && pageTitles[name]) headerTitle.textContent = pageTitles[name];
    sidebar?.classList.remove("open");
  }

  $$(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      const name = item.getAttribute("data-page");
      if (name) openPage(name);
    });
  });

  menuButton?.addEventListener("click", () => sidebar?.classList.toggle("open"));
  settingsButton?.addEventListener("click", () => openPage("settings"));

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, c => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[c]));
  }

  function formatAIText(value) {
    // Safe lightweight markdown-ish rendering.
    let html = escapeHTML(value);
    html = html.replace(/```([\s\S]*?)```/g, (_, code) =>
      '<pre class="code-block"><code>' + code.trim() + '</code></pre>'
    );
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    return html;
  }

  function scrollChat() {
    requestAnimationFrame(() => {
      messages?.scrollTo({ top: messages.scrollHeight, behavior: "smooth" });
    });
  }

  function addUserMessage(text) {
    const el = document.createElement("div");
    el.className = "message user";
    el.innerHTML = `
      <div class="message-body">
        <div class="message-text"></div>
      </div>`;
    el.querySelector(".message-text").textContent = text;
    messages.appendChild(el);
    scrollChat();
    return el;
  }

  function addAIMessage(text = "") {
    const el = document.createElement("div");
    el.className = "message ai";
    el.innerHTML = `
      <div class="message-avatar">SS</div>
      <div class="message-body">
        <div class="message-name">SUN SPY AI</div>
        <div class="message-text"></div>
      </div>`;
    messages.appendChild(el);
    const textEl = el.querySelector(".message-text");
    textEl.innerHTML = formatAIText(text);
    scrollChat();
    return { el, textEl };
  }

  function addTypingIndicator() {
    const el = document.createElement("div");
    el.className = "message ai loading-message";
    el.innerHTML = `
      <div class="message-avatar">SS</div>
      <div class="message-body">
        <div class="message-name">SUN SPY AI</div>
        <div class="message-text">
          <span class="typing-dots"><i></i><i></i><i></i></span>
        </div>
      </div>`;
    messages.appendChild(el);
    scrollChat();
    return el;
  }

  function typeNaturally(textEl, text, mode) {
    return new Promise(resolve => {
      const chars = Array.from(text);
      let i = 0;
      textEl.classList.add("typing-caret");

      function step() {
        if (i >= chars.length) {
          textEl.classList.remove("typing-caret");
          textEl.innerHTML = formatAIText(text);
          scrollChat();
          resolve();
          return;
        }

        // Natural rhythm: slightly faster for spaces/punctuation.
        const ch = chars[i++];
        const existing = textEl.textContent || "";
        textEl.textContent = existing + ch;

        let delay = mode === "smart" ? 15 : 9;
        if (ch === " " || ch === "\n") delay = 3;
        if (/[,.!?၊။]/.test(ch)) delay += 22;

        if (i % 18 === 0) scrollChat();
        setTimeout(step, delay);
      }
      step();
    });
  }

  function setMode(mode) {
    currentMode = mode === "smart" ? "smart" : "fast";
    localStorage.setItem("sunspy_mode", currentMode);
    modeButtons.forEach(b => b.classList.toggle("active", b.dataset.mode === currentMode));
    if (composerStatus) {
      composerStatus.textContent = currentMode === "smart"
        ? "Smart reasoning"
        : "Fast response";
    }
  }
  modeButtons.forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  setMode(currentMode);

  async function sendToBackend(text) {
    const response = await fetch(BACKEND_URL + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        mode: currentMode,
        history: conversation.slice(-12)
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "HTTP " + response.status);
    }
    if (!data.reply) throw new Error("Invalid backend response");
    return data;
  }

  async function sendMessage() {
    const text = messageInput?.value.trim();
    if (!text || !sendButton) return;

    addUserMessage(text);
    conversation.push({ role: "user", text });

    messageInput.value = "";
    messageInput.style.height = "auto";
    sendButton.disabled = true;
    sendButton.textContent = "…";
    if (composerStatus) composerStatus.textContent = "Thinking…";

    const loading = addTypingIndicator();

    try {
      const data = await sendToBackend(text);
      loading.remove();

      // Optional UI command emitted by the backend.
      if (data.uiCommand) applyUICommand(data.uiCommand, true);

      const ai = addAIMessage("");
      await typeNaturally(ai.textEl, data.reply, currentMode);
      conversation.push({ role: "model", text: data.reply });
      if (composerStatus) {
        composerStatus.textContent = currentMode === "smart" ? "Smart reasoning" : "Fast response";
      }
    } catch (err) {
      loading.remove();
      addAIMessage("Sorry — " + (err?.message || "Something went wrong."));
      if (composerStatus) composerStatus.textContent = "Connection error";
    } finally {
      sendButton.disabled = false;
      sendButton.textContent = "↑";
      messageInput.focus();
    }
  }

  sendButton?.addEventListener("click", sendMessage);

  messageInput?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  messageInput?.addEventListener("input", () => {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + "px";
  });

  // Suggestions
  $$(".suggestions button").forEach(btn => {
    btn.addEventListener("click", () => {
      messageInput.value = btn.dataset.prompt || "";
      messageInput.focus();
      messageInput.dispatchEvent(new Event("input"));
    });
  });

  // New chat
  newChatButton?.addEventListener("click", () => {
    conversation = [];
    if (messages) messages.innerHTML = "";
    messageInput.value = "";
    openPage("chat");
    messageInput.focus();
  });

  // ---------------------------------------------------------
  // UI CONTROL ENGINE
  // ---------------------------------------------------------
  const defaultAppearance = {
    theme: "dark",
    accent: "#7c5cff",
    fontSize: 14,
    density: "comfortable"
  };

  function readAppearance() {
    try {
      return JSON.parse(localStorage.getItem("sunspy_appearance")) || { ...defaultAppearance };
    } catch {
      return { ...defaultAppearance };
    }
  }

  function saveAppearance(state) {
    localStorage.setItem("sunspy_appearance", JSON.stringify(state));
  }

  function showToast(text) {
    document.querySelector(".ui-change-toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "ui-change-toast";
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2400);
  }

  function applyAppearance(state, announce = false) {
    const root = document.documentElement;
    document.body.classList.remove("light-theme", "midnight-theme");
    if (state.theme === "light") document.body.classList.add("light-theme");
    if (state.theme === "midnight") document.body.classList.add("midnight-theme");

    root.style.setProperty("--accent", state.accent || defaultAppearance.accent);
    root.style.setProperty("--ui-font-size", (state.fontSize || 14) + "px");

    document.body.classList.remove("density-compact", "density-spacious");
    if (state.density === "compact") document.body.classList.add("density-compact");
    if (state.density === "spacious") document.body.classList.add("density-spacious");

    const themeSelect = $("#themeSelect");
    const accentColor = $("#accentColor");
    const fontRange = $("#fontSizeRange");
    const densitySelect = $("#densitySelect");
    if (themeSelect) themeSelect.value = state.theme;
    if (accentColor) accentColor.value = state.accent;
    if (fontRange) fontRange.value = state.fontSize;
    if (densitySelect) densitySelect.value = state.density;

    saveAppearance(state);
    if (announce) showToast("Appearance updated");
  }

  function updateAppearance(patch) {
    const next = { ...readAppearance(), ...patch };
    uiHistory.push(readAppearance());
    if (uiHistory.length > 20) uiHistory.shift();
    applyAppearance(next, true);
  }

  function applyUICommand(command, announce = false) {
    if (!command || typeof command !== "object") return;
    if (command.action === "theme") updateAppearance({ theme: command.value });
    if (command.action === "accent") updateAppearance({ accent: command.value });
    if (command.action === "font_size") updateAppearance({ fontSize: Number(command.value) });
    if (command.action === "density") updateAppearance({ density: command.value });
    if (command.action === "sidebar") {
      sidebar?.classList.toggle("open", command.value === "open");
      if (announce) showToast("Sidebar updated");
    }
  }

  $("#themeSelect")?.addEventListener("change", e => updateAppearance({ theme: e.target.value }));
  $("#accentColor")?.addEventListener("input", e => updateAppearance({ accent: e.target.value }));
  $("#fontSizeRange")?.addEventListener("input", e => updateAppearance({ fontSize: Number(e.target.value) }));
  $("#densitySelect")?.addEventListener("change", e => updateAppearance({ density: e.target.value }));

  $("#resetAppearance")?.addEventListener("click", () => {
    uiHistory.push(readAppearance());
    applyAppearance({ ...defaultAppearance }, true);
  });

  // Basic natural-language UI controls. These are deliberately allow-listed.
  function interpretLocalUICommand(text) {
    const t = text.toLowerCase();

    if (/(light mode|light theme|အလင်း|အဖြူရောင်).*(လုပ်|ပြောင်း|ထား)|change.*light/.test(t))
      return { action: "theme", value: "light" };

    if (/(dark mode|dark theme|အမှောင်).*(လုပ်|ပြောင်း|ထား)|change.*dark/.test(t))
      return { action: "theme", value: "dark" };

    if (/midnight|နက်ပြာ|အပြာနက်/.test(t))
      return { action: "theme", value: "midnight" };

    if (/purple|ခရမ်း|ခရမ်းရောင်/.test(t))
      return { action: "accent", value: "#7c5cff" };

    if (/blue|အပြာရောင်/.test(t))
      return { action: "accent", value: "#3b82f6" };

    if (/green|အစိမ်းရောင်/.test(t))
      return { action: "accent", value: "#22c55e" };

    if (/compact|သေးသေး|ကျစ်ကျစ်/.test(t))
      return { action: "density", value: "compact" };

    if (/spacious|ပိုကျယ်|အကွာအဝေးများ/.test(t))
      return { action: "density", value: "spacious" };

    if (/normal|ပုံမှန်/.test(t) && /(spacing|density|အကွာ)/.test(t))
      return { action: "density", value: "comfortable" };

    if (/sidebar.*(open|ဖွင့်)|sidebar.*(ဖွင့်)/.test(t))
      return { action: "sidebar", value: "open" };

    if (/sidebar.*(close|hide|ဖျောက်)|sidebar.*(ပိတ်|ဖျောက်)/.test(t))
      return { action: "sidebar", value: "closed" };

    return null;
  }

  // If the user asks for an obvious UI change, apply it before sending too.
  // The AI still receives the request and can explain what changed.
  const originalSendMessage = sendMessage;
  window.sunSpyApplyUI = applyUICommand;
  window.sunSpyUndoUI = function () {
    const previous = uiHistory.pop();
    if (previous) {
      applyAppearance(previous, true);
      showToast("Previous appearance restored");
    } else {
      showToast("Nothing to undo");
    }
  };

  // Attach image button — stores the chosen image locally and makes it available
  // as a background/logo choice in a future image-aware control flow.
  attachButton?.addEventListener("click", () => imageInput?.click());
  imageInput?.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Image must be 5 MB or smaller");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      localStorage.setItem("sunspy_custom_image", reader.result);
      showToast("Image saved for SUN SPY customization");
    };
    reader.readAsDataURL(file);
  });

  // Apply local UI command when a message is sent, then continue normally.
  const sendRef = sendMessage;
  window.sendSunSpyMessage = async function () {
    const text = messageInput?.value.trim();
    const command = text ? interpretLocalUICommand(text) : null;
    if (command) {
      uiHistory.push(readAppearance());
      applyUICommand(command, false);
      showToast("SUN SPY AI changed the interface");
    }
    return sendRef();
  };

  // Replace click/enter handlers with command-aware wrapper.
  sendButton?.removeEventListener("click", sendMessage);
  sendButton?.addEventListener("click", window.sendSunSpyMessage);
  messageInput?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      window.sendSunSpyMessage();
    }
  });

  // Appearance defaults.
  applyAppearance(readAppearance());

  // Tool buttons: keep existing pages functional as UI placeholders.
  $$(".primary-button").forEach(button => {
    if (button.id === "resetAppearance") return;
    button.addEventListener("click", () => {
      const tool = button.closest(".tool");
      const input = tool?.querySelector(".tool-input");
      if (input && !input.value.trim()) {
        input.focus();
        return;
      }
      const old = button.textContent;
      button.textContent = "Processing...";
      button.disabled = true;
      setTimeout(() => {
        button.textContent = old;
        button.disabled = false;
      }, 800);
    });
  });

  $("#videoInput")?.addEventListener("change", e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const title = e.target.closest(".upload")?.querySelector("strong");
    if (title) title.textContent = file.name;
  });

  async function checkBackend() {
    try {
      const r = await fetch(BACKEND_URL + "/", { method: "GET" });
      return r.ok;
    } catch {
      return false;
    }
  }

  openPage("chat");
  checkBackend();
});
