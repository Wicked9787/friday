/* Friday's brain: one place that talks to AI services.
   - Tries Groq models in order (each model has its own free limit).
   - If all Groq models are busy, falls back to any connection marked "Backup brain".
   - Speaks OpenAI-style APIs (Groq, OpenAI, Gemini, OpenRouter, Cerebras, Mistral, xAI, DeepSeek...)
     and Anthropic's Claude API.
   - Can stream replies sentence by sentence so she starts talking sooner. */
(function (root) {
  "use strict";

  var GROQ_BASE = "https://api.groq.com/openai/v1";

  // Each Groq model has its own free daily allowance, so moving down this list is free.
  var GROQ_CHAT_MODELS = [
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "llama-3.3-70b-versatile",
    "qwen/qwen3-32b",
    "llama-3.1-8b-instant"
  ];
  var GROQ_SMALL_MODELS = [
    "llama-3.1-8b-instant",
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b"
  ];
  // Vision model names change often on Groq; try these in order and remember what works.
  var GROQ_VISION_MODELS = [
    "qwen/qwen3.8-27b",
    "qwen/qwen3.6-27b",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "meta-llama/llama-4-maverick-17b-128e-instruct"
  ];

  var PRESETS = {
    groq:       { label: "Groq (free)", name: "Groq", base: GROQ_BASE, model: "openai/gpt-oss-120b", style: "openai", keyUrl: "https://console.groq.com/keys", free: true },
    gemini:     { label: "Google Gemini (free tier)", name: "Gemini", base: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-flash-latest", style: "gemini", keyUrl: "https://aistudio.google.com/apikey", free: true },
    openrouter: { label: "OpenRouter (free models)", name: "OpenRouter", base: "https://openrouter.ai/api/v1", model: "openai/gpt-oss-20b:free", style: "openai", keyUrl: "https://openrouter.ai/keys", free: true },
    cerebras:   { label: "Cerebras (free tier)", name: "Cerebras", base: "https://api.cerebras.ai/v1", model: "gpt-oss-120b", style: "openai", keyUrl: "https://cloud.cerebras.ai", free: true },
    mistral:    { label: "Mistral (free tier)", name: "Mistral", base: "https://api.mistral.ai/v1", model: "mistral-small-latest", style: "openai", keyUrl: "https://console.mistral.ai/api-keys", free: true },
    github:     { label: "GitHub Models (free)", name: "GitHub", base: "https://models.github.ai/inference", model: "openai/gpt-4.1-mini", style: "openai", keyUrl: "https://github.com/settings/tokens", free: true },
    openai:     { label: "ChatGPT / OpenAI (paid)", name: "ChatGPT", base: "https://api.openai.com/v1", model: "gpt-5-mini", style: "openai", keyUrl: "https://platform.openai.com/api-keys" },
    xai:        { label: "Grok / xAI (paid)", name: "Grok", base: "https://api.x.ai/v1", model: "grok-4-fast", style: "openai", keyUrl: "https://console.x.ai" },
    deepseek:   { label: "DeepSeek (paid, cheap)", name: "DeepSeek", base: "https://api.deepseek.com/v1", model: "deepseek-chat", style: "openai", keyUrl: "https://platform.deepseek.com/api_keys" },
    anthropic:  { label: "Claude / Anthropic (paid)", name: "Claude", base: "https://api.anthropic.com/v1", model: "claude-haiku-5-5", style: "anthropic", keyUrl: "https://console.anthropic.com" },
    custom:     { label: "Any other (OpenAI-compatible)", name: "", base: "", model: "", style: "openai" }
  };

  // Models that are down or rate-limited are skipped until this time (ms).
  var cooldown = {};
  var missing = {};
  var lastUsed = "";

  function now() { return Date.now(); }

  // Daily usage, so she (and you) can see how close each free limit is.
  function noteUse(label, kind) {
    try {
      var S = root.FridayStorage, today = new Date().toDateString();
      var u = S.get("usage.brain", null);
      if (!u || u.date !== today) u = { date: today, total: 0, tts: 0, models: {} };
      if (kind === "tts") u.tts = (u.tts || 0) + 1;
      else { u.total = (u.total || 0) + 1; u.models[label] = (u.models[label] || 0) + 1; }
      S.set("usage.brain", u);
    } catch (e) {}
  }
  function activity(node, text, extra) {
    try { root.dispatchEvent(new CustomEvent("friday:activity", { detail: Object.assign({ node: node, text: text }, extra || {}) })); } catch (e) {}
  }
  function cfg() { return root.FRIDAY_CONFIG || {}; }
  function store() { return root.FridayStorage; }

  function groqKey() { return store().getApiKey(); }

  function connections() {
    var list = store().get("connections", []) || [];
    return Array.isArray(list) ? list.filter(function (c) { return c && c.type === "agent"; }) : [];
  }

  function backupAgents() {
    return connections().filter(function (c) { return c.backup; });
  }

  function styleOf(agent) {
    // Google's new Gemini keys (AQ.…) only work on Google's own endpoint, not the OpenAI-style one.
    if (agent.provider === "gemini" && /^AQ\./.test(keyFor(agent) || "")) return "gemini";
    if (agent.style) return agent.style;
    if (agent.provider === "anthropic" || /anthropic\.com/i.test(agent.baseUrl || "")) return "anthropic";
    return "openai";
  }

  function keyFor(agent) {
    var k = store().getAgentKey(agent.id);
    if (!k && (agent.provider === "groq" || /groq\.com/i.test(agent.baseUrl || ""))) k = groqKey();
    return k;
  }

  function isReasoningModel(model) {
    return /gpt-oss|qwen3|deepseek-r1|o\d|reason/i.test(model || "");
  }

  function classifyError(status, text) {
    var t = String(text || "").toLowerCase();
    if (status === 401 || status === 403) return "auth";
    if (status === 404 || /model.*(not found|does not exist|decommission|not supported|unknown)|no such model|invalid model/.test(t)) return "model";
    if (status === 429 || /rate.?limit|quota|exceeded|too many/.test(t)) return /per day|daily|tpd|rpd/.test(t) ? "daily" : "busy";
    if (status === 413 || /too large|context length|maximum context/.test(t)) return "toolong";
    if (status >= 500) return "down";
    if (status === 400) return "bad";
    return "other";
  }

  function markCooldown(id, kind) {
    var ms = kind === "daily" ? 20 * 60 * 1000 : kind === "down" ? 30 * 1000 : 45 * 1000;
    cooldown[id] = now() + ms;
  }

  function available(id) {
    return !missing[id] && !(cooldown[id] && cooldown[id] > now());
  }

  function BrainError(message, kind) {
    var e = new Error(message);
    e.kind = kind;
    return e;
  }

  // ---------- low level calls ----------

  function openaiBody(model, messages, opts) {
    var body = { model: model, messages: messages };
    if (opts.temperature != null) body.temperature = opts.temperature;
    if (opts.max_tokens) body.max_tokens = opts.max_tokens;
    if (opts.stream) body.stream = true;
    if (opts.groq) {
      if (isReasoningModel(model)) {
        if (/gpt-oss/.test(model)) {
          body.include_reasoning = false;
          if (opts.reasoning_effort) body.reasoning_effort = opts.reasoning_effort;
        } else if (/qwen3/.test(model)) {
          body.reasoning_effort = "none";
        }
      }
      if (opts.tools && /gpt-oss/.test(model)) body.tools = opts.tools;
    }
    return body;
  }

  function extractText(data) {
    var choice = (data && data.choices && data.choices[0]) || {};
    var msg = choice.message || {};
    var text = msg.content || "";
    if (Array.isArray(text)) text = text.map(function (p) { return p.text || p.content || ""; }).join("\n");
    if (!text && msg.reasoning && !/gpt-oss/.test(data.model || "")) text = msg.reasoning;
    text = String(text || "");
    // Some models wrap private thinking in <think> tags.
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
    return text.trim();
  }

  async function readStream(res, onDelta) {
    // Some services ignore "stream" and send one normal reply; read that the normal way.
    var ctype = (res.headers && res.headers.get && res.headers.get("content-type")) || "";
    var plainJson = /json/i.test(ctype) && !/event-stream/i.test(ctype);
    var reader = !plainJson && res.body && res.body.getReader ? res.body.getReader() : null;
    if (!reader) {
      var data = await res.json();
      var t = extractText(data);
      if (t) onDelta(t);
      return t;
    }
    var dec = new TextDecoder();
    var buf = "", full = "", inThink = false, pending = "";
    while (true) {
      var r = await reader.read();
      if (r.done) break;
      buf += dec.decode(r.value, { stream: true });
      var lines = buf.split("\n");
      buf = lines.pop();
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || line.indexOf("data:") !== 0) continue;
        var payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        var j;
        try { j = JSON.parse(payload); } catch (e) { continue; }
        var d = j.choices && j.choices[0] && j.choices[0].delta;
        var piece = d && d.content;
        if (!piece) continue;
        pending += piece;
        var out = "";
        while (pending) {
          if (inThink) {
            var end = pending.indexOf("</think>");
            if (end < 0) { pending = pending.slice(-8); break; }
            inThink = false;
            pending = pending.slice(end + 8);
            continue;
          }
          var st = pending.indexOf("<think>");
          if (st >= 0) { out += pending.slice(0, st); pending = pending.slice(st + 7); inThink = true; continue; }
          // Hold back a possible partial "<think>" at the very end.
          var lt = pending.lastIndexOf("<");
          if (lt >= 0 && lt > pending.length - 8 && "<think>".indexOf(pending.slice(lt)) === 0) { out += pending.slice(0, lt); pending = pending.slice(lt); break; }
          out += pending; pending = "";
        }
        if (!out) continue;
        full += out;
        onDelta(out);
      }
    }
    if (pending && !inThink) { full += pending; onDelta(pending); }
    return full.trim();
  }

  async function callOpenAI(base, key, model, messages, opts) {
    base = String(base || "").trim().replace(/\/+$/, "");
    var url = /\/chat\/completions$/.test(base) ? base : base + "/chat/completions";
    var headers = { "Content-Type": "application/json", Authorization: "Bearer " + key };
    if (/openrouter\.ai/.test(base)) { headers["HTTP-Referer"] = "https://wicked9787.github.io/friday/"; headers["X-Title"] = "Friday"; }
    var body = openaiBody(model, messages, opts);
    var res;
    try {
      res = await fetch(url, { method: "POST", headers: headers, body: JSON.stringify(body), signal: opts.signal });
    } catch (e) {
      if (e && e.name === "AbortError") throw e;
      throw BrainError("network", "offline");
    }
    if (!res.ok) {
      var errText = "";
      try { errText = await res.text(); } catch (e2) {}
      var kind = classifyError(res.status, errText);
      // Some providers reject optional settings; retry once without them.
      if (kind === "bad" && !opts._plain) {
        var o2 = Object.assign({}, opts, { _plain: true, groq: false, tools: null, reasoning_effort: null });
        return callOpenAI(base, key, model, messages, o2);
      }
      throw BrainError(errText.slice(0, 200) || ("HTTP " + res.status), kind);
    }
    if (opts.stream && opts.onDelta) return readStream(res, opts.onDelta);
    var data = await res.json();
    var text = extractText(data);
    if (opts.onDelta && text) opts.onDelta(text);
    return text;
  }

  // Google's own Gemini API (works with both the old AIza… keys and the new AQ.… keys).
  function geminiBase(base) {
    base = String(base || "").trim().replace(/\/+$/, "").replace(/\/openai$/, "");
    return /generativelanguage\.googleapis\.com/.test(base) ? base : "https://generativelanguage.googleapis.com/v1beta";
  }
  function geminiParts(content) {
    if (typeof content === "string") return [{ text: content }];
    if (!Array.isArray(content)) return [{ text: String(content || "") }];
    var out = [];
    content.forEach(function (p) {
      if (!p) return;
      if (p.type === "image_url" && p.image_url && /^data:/.test(p.image_url.url)) {
        var m = p.image_url.url.match(/^data:([^;]+);base64,(.*)$/);
        if (m) out.push({ inline_data: { mime_type: m[1], data: m[2] } });
      } else if (p.text || p.content) out.push({ text: p.text || p.content });
    });
    return out.length ? out : [{ text: "" }];
  }
  async function callGemini(base, key, model, messages, opts) {
    base = geminiBase(base);
    model = String(model || "gemini-flash-latest").replace(/^models\//, "");
    var system = [], contents = [];
    messages.forEach(function (m) {
      if (m.role === "system") { system.push(typeof m.content === "string" ? m.content : geminiParts(m.content).map(function (p) { return p.text || ""; }).join("\n")); return; }
      var role = m.role === "assistant" ? "model" : "user";
      var parts = geminiParts(m.content);
      var last = contents[contents.length - 1];
      if (last && last.role === role) last.parts = last.parts.concat(parts);
      else contents.push({ role: role, parts: parts });
    });
    if (!contents.length) contents.push({ role: "user", parts: [{ text: "Hello" }] });
    var body = { contents: contents };
    if (system.length) body.systemInstruction = { parts: [{ text: system.join("\n\n") }] };
    var gc = {};
    if (opts.temperature != null) gc.temperature = opts.temperature;
    // Newer Gemini models think first, and thinking counts toward the limit, so small limits are left off.
    if (opts.max_tokens && opts.max_tokens >= 512) gc.maxOutputTokens = opts.max_tokens;
    if (Object.keys(gc).length) body.generationConfig = gc;
    var url = base + "/models/" + encodeURIComponent(model) + ":generateContent";
    async function send(useBearer) {
      var headers = { "Content-Type": "application/json" };
      if (useBearer) headers.Authorization = "Bearer " + key; else headers["x-goog-api-key"] = key;
      try { return await fetch(url, { method: "POST", headers: headers, body: JSON.stringify(body), signal: opts.signal }); }
      catch (e) { if (e && e.name === "AbortError") throw e; throw BrainError("network", "offline"); }
    }
    var res = await send(false);
    if (res.status === 401 && /^AQ\./.test(key)) res = await send(true);
    if (!res.ok) {
      var errText = "";
      try { errText = await res.text(); } catch (e2) {}
      throw BrainError(errText.slice(0, 200) || ("HTTP " + res.status), classifyError(res.status, errText));
    }
    var data = await res.json();
    var cand = (data.candidates || [])[0] || {};
    var text = ((cand.content && cand.content.parts) || []).filter(function (p) { return p && p.text && !p.thought; }).map(function (p) { return p.text; }).join("").trim();
    if (!text && data.promptFeedback && data.promptFeedback.blockReason) text = "I can't help with that one.";
    if (opts.onDelta && text) opts.onDelta(text);
    return text;
  }

  async function callAnthropic(base, key, model, messages, opts) {
    base = String(base || "https://api.anthropic.com/v1").trim().replace(/\/+$/, "");
    var system = [];
    var msgs = [];
    messages.forEach(function (m) {
      if (m.role === "system") { system.push(typeof m.content === "string" ? m.content : ""); return; }
      var content = m.content;
      if (Array.isArray(content)) {
        content = content.map(function (p) {
          if (p.type === "image_url" && p.image_url && /^data:/.test(p.image_url.url)) {
            var mm = p.image_url.url.match(/^data:([^;]+);base64,(.*)$/);
            return { type: "image", source: { type: "base64", media_type: mm ? mm[1] : "image/jpeg", data: mm ? mm[2] : "" } };
          }
          return { type: "text", text: p.text || "" };
        });
      }
      var last = msgs[msgs.length - 1];
      if (last && last.role === m.role && typeof last.content === "string" && typeof content === "string") last.content += "\n" + content;
      else msgs.push({ role: m.role === "assistant" ? "assistant" : "user", content: content });
    });
    if (!msgs.length || msgs[0].role !== "user") msgs.unshift({ role: "user", content: "(conversation start)" });
    var res;
    try {
      res = await fetch(base + "/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({ model: model, max_tokens: opts.max_tokens || 600, system: system.join("\n\n"), messages: msgs, temperature: opts.temperature == null ? 0.7 : opts.temperature }),
        signal: opts.signal
      });
    } catch (e) {
      if (e && e.name === "AbortError") throw e;
      throw BrainError("network", "offline");
    }
    if (!res.ok) {
      var errText = "";
      try { errText = await res.text(); } catch (e2) {}
      throw BrainError(errText.slice(0, 200) || ("HTTP " + res.status), classifyError(res.status, errText));
    }
    var data = await res.json();
    var text = (data.content || []).map(function (b) { return b.text || ""; }).join("").trim();
    if (opts.onDelta && text) opts.onDelta(text);
    return text;
  }

  function callAgent(agent, messages, opts) {
    var key = keyFor(agent);
    if (!key) return Promise.reject(BrainError("no key for " + agent.name, "auth"));
    if (styleOf(agent) === "anthropic") return callAnthropic(agent.baseUrl, key, agent.model, messages, opts);
    if (styleOf(agent) === "gemini") return callGemini(agent.baseUrl, key, agent.model, messages, opts);
    return callOpenAI(agent.baseUrl, key, agent.model, messages, opts);
  }

  // ---------- the fallback chain ----------

  function friendly(kindCounts) {
    if (kindCounts.auth && !kindCounts.busy && !kindCounts.daily) return "My Groq key was rejected. Check it in Settings.";
    if (kindCounts.daily || kindCounts.busy) {
      return backupAgents().length
        ? "Every brain I have is busy right now. Give me a minute and try again."
        : "Groq is at its limit right now. Try again in a bit, or add a free backup brain in Settings, Connections.";
    }
    if (kindCounts.offline) return "I can't reach the internet right now. Check your connection and try again.";
    if (kindCounts.down) return "My brain is having a hiccup. Try again in a few seconds.";
    return "Something went wrong talking to my brain. Try again.";
  }

  /* opts: { purpose: "chat"|"small"|"vision", temperature, max_tokens, tools, reasoning_effort,
             stream, onDelta, signal, noBackup } */
  async function ask(messages, opts) {
    opts = opts || {};
    var key = groqKey();
    var counts = {};
    var list = opts.purpose === "small" ? GROQ_SMALL_MODELS : opts.purpose === "vision" ? GROQ_VISION_MODELS : GROQ_CHAT_MODELS;
    if (opts.purpose === "chat" && cfg().MODEL && list.indexOf(cfg().MODEL) < 0) list = [cfg().MODEL].concat(list);
    // Web search only works on the gpt-oss models. If they can't search right now,
    // return nothing so the caller can use the free Wikipedia backup instead of a guess.
    if (opts.tools) list = list.filter(function (m) { return /gpt-oss/.test(m); });
    var started = false;
    var wrapDelta = opts.onDelta ? function (t) { started = true; opts.onDelta(t); } : null;

    if (key) {
      var tried = 0;
      var order = list.filter(function (m) { return !missing["groq:" + m]; });
      if (order.length && !order.some(function (m) { return available("groq:" + m); })) {
        // Every model is resting. Try the one whose rest ends first instead of refusing.
        order.sort(function (a, b) { return (cooldown["groq:" + a] || 0) - (cooldown["groq:" + b] || 0); });
        delete cooldown["groq:" + order[0]];
      }
      for (var i = 0; i < list.length; i++) {
        var model = list[i];
        var id = "groq:" + model;
        if (!available(id)) continue;
        tried++;
        try {
          var out = await callOpenAI(GROQ_BASE, key, model, messages, Object.assign({}, opts, { groq: true, onDelta: wrapDelta }));
          if (!out && !started) { counts.other = (counts.other || 0) + 1; continue; }
          lastUsed = "Groq " + model.replace(/^.*\//, "");
          if (opts.purpose !== "small") { noteUse(model); activity("thinking", (tried > 1 ? "Switched brains · " : "") + "Answered by " + lastUsed, { brain: lastUsed, quiet: opts.quietLog }); }
          return out;
        } catch (e) {
          if (e && e.name === "AbortError") throw e;
          if (started) throw e;
          var kind = e.kind || "other";
          counts[kind] = (counts[kind] || 0) + 1;
          if (kind === "auth" || kind === "offline") break;
          if (kind === "model") missing[id] = true;
          // A failed web search is usually the search tool, not the model: only rest it for real limits.
          else if (kind !== "toolong" && !(opts.tools && kind !== "busy" && kind !== "daily")) markCooldown(id, kind);
        }
      }
    } else {
      counts.auth = 1;
    }

    if (!opts.noBackup) {
      var backups = backupAgents();
      for (var b = 0; b < backups.length; b++) {
        var ag = backups[b];
        var aid = "agent:" + ag.id;
        if (!available(aid)) continue;
        try {
          var o = Object.assign({}, opts, { groq: /groq\.com/.test(ag.baseUrl || ""), tools: null, onDelta: wrapDelta });
          if (opts.purpose === "vision" && ag.vision === false) continue;
          var txt = await callAgent(ag, messages, o);
          if (!txt && !started) continue;
          lastUsed = ag.name;
          noteUse(ag.name);
          activity("agents", "Groq was busy · backup brain " + ag.name + " answered", { brain: ag.name });
          return txt;
        } catch (e3) {
          if (e3 && e3.name === "AbortError") throw e3;
          if (started) throw e3;
          var k3 = e3.kind || "other";
          counts[k3] = (counts[k3] || 0) + 1;
          if (k3 === "offline") break;
          if (k3 !== "auth" && k3 !== "model") markCooldown(aid, k3);
        }
      }
    }
    if (!key && !backupAgents().length) throw BrainError("Add a Groq API key in Settings first.", "auth");
    throw BrainError(friendly(counts), "exhausted");
  }

  // Ask one named connection directly ("ask Gemini ...").
  function askAgent(agent, messages, opts) {
    return callAgent(agent, messages, opts || {}).catch(function (e) {
      var k = e && e.kind;
      if (k === "auth") throw new Error(agent.name + " rejected the key. Check it in Settings, Connections.");
      if (k === "model") throw new Error(agent.name + " didn't recognize that model. Tap Find models in Settings, Connections.");
      if (k === "busy" || k === "daily") throw new Error(agent.name + " is busy or out of free credit right now. Try again in a bit.");
      if (k === "down" || k === "offline") throw new Error("I couldn't reach " + agent.name + ". Check the internet or its web address.");
      throw new Error(agent.name + " had a problem. Try again in a bit.");
    });
  }

  // List models a provider offers (for the "Find models" button).
  async function listModels(style, base, key) {
    base = String(base || "").trim().replace(/\/+$/, "");
    var res;
    if (style === "anthropic") {
      res = await fetch(base + "/models", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" } });
    } else if (style === "gemini" || (/generativelanguage\.googleapis\.com/.test(base) && /^AQ\./.test(key || ""))) {
      res = await fetch(geminiBase(base) + "/models?pageSize=200", { headers: { "x-goog-api-key": key } });
      if (res.status === 401 && /^AQ\./.test(key || "")) res = await fetch(geminiBase(base) + "/models?pageSize=200", { headers: { Authorization: "Bearer " + key } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var gd = await res.json();
      return (gd.models || []).filter(function (m) { return !m.supportedGenerationMethods || m.supportedGenerationMethods.indexOf("generateContent") >= 0; })
        .map(function (m) { return String(m.name || "").replace(/^models\//, ""); }).filter(Boolean)
        .filter(function (id) { return !/embed|tts|image|aqa|imagen|veo|live|audio|robotics|computer-use/i.test(id); })
        .sort();
    } else {
      res = await fetch(base + "/models", { headers: key ? { Authorization: "Bearer " + key } : {} });
    }
    if (!res.ok) throw new Error("HTTP " + res.status);
    var data = await res.json();
    var arr = data.data || data.models || data || [];
    if (!Array.isArray(arr)) arr = [];
    return arr.map(function (m) { return String(m.id || m.name || "").replace(/^models\//, ""); })
      .filter(Boolean)
      .filter(function (id) { return !/embed|whisper|tts|speech|moderation|guard|image|dall-e|audio|transcri/i.test(id); })
      .sort();
  }

  async function test(agent) {
    var out = await askAgent(agent, [{ role: "user", content: "Reply with the single word: ready" }], { max_tokens: 20, temperature: 0 });
    return out;
  }

  // ---------- "Paste a key": figure out whose key it is, pick a free model, test it, add it ----------
  var KEY_SHAPES = [
    [/^AIza[0-9A-Za-z_\-]{20,}$/, ["gemini"]],
    [/^AQ\.[0-9A-Za-z_\-.]{10,}$/, ["gemini"]],
    [/^sk-or-/, ["openrouter"]],
    [/^gsk_/, ["groq"]],
    [/^csk-/, ["cerebras"]],
    [/^sk-ant-/, ["anthropic"]],
    [/^xai-/, ["xai"]],
    [/^(github_pat_|ghp_|gho_)/, ["github"]],
    [/^sk-(proj|svcacct|admin)-/, ["openai"]],
    [/^sk-[a-f0-9]{32}$/, ["deepseek", "openai"]],
    [/^sk-/, ["openai", "deepseek"]],
    [/^[A-Za-z0-9]{32}$/, ["mistral", "cerebras", "openrouter"]]
  ];
  function guessProviders(key) {
    key = String(key || "").trim();
    for (var i = 0; i < KEY_SHAPES.length; i++) if (KEY_SHAPES[i][0].test(key)) return KEY_SHAPES[i][1].slice();
    return ["mistral", "openrouter", "cerebras", "gemini"];
  }
  // Best free models first, matched against what the provider actually lists today.
  var FREE_PICKS = {
    gemini: [/^gemini-flash-latest$/, /^gemini-2\.5-flash$/, /^gemini-[\d.]+-flash$/, /^gemini-[\d.]+-flash(?!.*(image|tts|live|audio|thinking|exp))/, /^gemini-flash-lite-latest$/],
    openrouter: [/gpt-oss-120b:free$/, /gpt-oss-20b:free$/, /llama-3\.3-70b.*:free$/, /deepseek.*:free$/, /qwen.*:free$/, /gemma.*:free$/, /mistral.*:free$/, /:free$/],
    cerebras: [/^gpt-oss-120b$/, /llama-3\.3-70b/, /qwen-3/, /llama/],
    groq: [/^openai\/gpt-oss-120b$/, /^openai\/gpt-oss-20b$/, /^llama-3\.3-70b-versatile$/],
    mistral: [/^mistral-small-latest$/, /^mistral-medium-latest$/, /^open-mistral-nemo/, /^mistral-small/],
    github: [/gpt-4\.1-mini$/, /gpt-4o-mini$/]
  };
  function pickModels(provider, ids) {
    var out = [], pr = PRESETS[provider] || {};
    (FREE_PICKS[provider] || []).forEach(function (re) {
      ids.forEach(function (id) { if (re.test(id) && out.indexOf(id) < 0) out.push(id); });
    });
    if (provider === "openrouter") out = out.filter(function (id) { return /:free$/.test(id); });
    if (!out.length && pr.model) out.push(pr.model);
    return out.slice(0, 3);
  }
  function uniqueName(base, list) {
    var names = list.map(function (c) { return String(c.name || "").toLowerCase(); });
    if (names.indexOf(base.toLowerCase()) < 0) return base;
    for (var n = 2; n < 20; n++) if (names.indexOf((base + " " + n).toLowerCase()) < 0) return base + " " + n;
    return base + " " + Date.now() % 1000;
  }
  async function addKey(rawKey, onStep) {
    var key = String(rawKey || "").trim().replace(/^Bearer\s+/i, "").replace(/\s+/g, "");
    if (key.length < 16) return { ok: false, reason: "short" };
    var st = store();
    var step = typeof onStep === "function" ? onStep : function () {};
    var all = st.get("connections", []) || [];
    var same = all.filter(function (c) { return c && c.type === "agent" && st.getAgentKey(c.id) === key; })[0];
    if (same) {
      same.backup = true;
      st.set("connections", all);
      return { ok: true, already: true, provider: same.provider, name: same.name, model: same.model };
    }
    if (key === groqKey()) return { ok: true, already: true, provider: "groq", name: "Groq", main: true };
    var cands = guessProviders(key), lastReason = "";
    for (var i = 0; i < cands.length; i++) {
      var pid = cands[i], pr = PRESETS[pid];
      if (!pr) continue;
      step("Checking " + pr.name + "…");
      var ids = null;
      try { ids = await listModels(pr.style, pr.base, key); }
      catch (e) {
        if (/HTTP (401|403)/.test(String(e && e.message || e))) { lastReason = "auth"; continue; }
        ids = null; // this provider doesn't list models from here; test its usual model
      }
      var models = ids && ids.length ? pickModels(pid, ids) : [pr.model];
      // A Groq key with no main key yet becomes the main key.
      if (pid === "groq" && !groqKey()) {
        st.setApiKey(key);
        return { ok: true, provider: "groq", name: "Groq", main: true, model: models[0] || pr.model };
      }
      for (var j = 0; j < models.length; j++) {
        var agent = { id: "a" + Math.random().toString(36).slice(2, 9), name: pr.name, type: "agent", provider: pid, style: pr.style, baseUrl: pr.base, model: models[j], kind: "chat" };
        st.setAgentKey(agent.id, key);
        step("Testing " + pr.name + " (" + models[j] + ")…");
        var works = false, limited = false;
        try {
          var out = await callAgent(agent, [{ role: "user", content: "Reply with the single word: ready" }], { max_tokens: 20, temperature: 0 });
          works = !!String(out || "").trim();
        } catch (e) {
          lastReason = (e && e.kind) || "other";
          if (lastReason === "busy" || lastReason === "daily") { works = true; limited = true; }
        }
        if (works) {
          all = st.get("connections", []) || [];
          agent.name = uniqueName(pr.name, all);
          agent.backup = true;
          all.push(agent);
          st.set("connections", all);
          return { ok: true, provider: pid, name: agent.name, model: agent.model, paid: !pr.free, limited: limited };
        }
        st.setAgentKey(agent.id, "");
        if (lastReason === "auth" || lastReason === "offline") break;
      }
      if (lastReason === "offline") break;
    }
    return { ok: false, reason: lastReason || "unknown" };
  }

  root.FridayBrain = {
    addKey: addKey,
    guessProviders: guessProviders,
    pickModels: pickModels,
    noteUse: noteUse,
    activity: activity,
    ask: ask,
    askAgent: askAgent,
    listModels: listModels,
    test: test,
    PRESETS: PRESETS,
    GROQ_BASE: GROQ_BASE,
    lastUsed: function () { return lastUsed; },
    status: function () {
      var busy = Object.keys(cooldown).filter(function (k) { return cooldown[k] > now(); });
      return { busy: busy, missing: Object.keys(missing), backups: backupAgents().map(function (a) { return a.name; }) };
    }
  };
})(window);
