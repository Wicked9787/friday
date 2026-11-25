/* Friday's brain: one place that talks to AI services.
   - 4.0: a central router sorts each request into a task and ranks every brain she can use
     (Groq models and your backup brains) by what it's good at, how it's been doing, and how much
     free allowance is left, then falls back automatically down that list.
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
    cloudflare: { label: "Cloudflare Workers AI (free daily)", name: "Cloudflare", base: "https://api.cloudflare.com/client/v4/accounts/{account}/ai/v1", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", style: "openai", keyUrl: "https://dash.cloudflare.com/profile/api-tokens", free: true, twoBox: true },
    cerebras:   { label: "Cerebras (needs a card)", name: "Cerebras", base: "https://api.cerebras.ai/v1", model: "gpt-oss-120b", style: "openai", keyUrl: "https://cloud.cerebras.ai" },
    mistral:    { label: "Mistral (needs a card)", name: "Mistral", base: "https://api.mistral.ai/v1", model: "mistral-small-latest", style: "openai", keyUrl: "https://console.mistral.ai/api-keys" },
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

  // 3.3: some AI sites block requests from inside apps (CORS). The installed app can send them
  // straight from the iPhone instead, so backup brains still work. Cloudflare always goes this way.
  function nativeHttp() {
    var C = root.Capacitor;
    try { return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.CapacitorHttp || null; } catch (e) { return null; }
  }
  function mustGoNative(url) { return /api\.cloudflare\.com/.test(url || ""); }
  async function http(url, init) {
    init = init || {};
    var H = nativeHttp();
    async function viaNative() {
      var data = init.body;
      if (typeof data === "string") { try { data = JSON.parse(data); } catch (e) {} }
      if (data && typeof data === "object") { delete data.stream; delete data.stream_options; }
      var r = await H.request({ url: url, method: init.method || "GET", headers: init.headers || {}, data: data, connectTimeout: 20000, readTimeout: 90000 });
      if (init.signal && init.signal.aborted) { var ab = new Error("aborted"); ab.name = "AbortError"; throw ab; }
      var d = r && r.data;
      var text = typeof d === "string" ? d : JSON.stringify(d == null ? "" : d);
      var st = +(r && r.status) || 0;
      return {
        ok: st >= 200 && st < 300, status: st, body: null, native: true,
        text: function () { return Promise.resolve(text); },
        json: function () { return Promise.resolve(typeof d === "string" ? JSON.parse(d) : d); }
      };
    }
    if (H && mustGoNative(url)) return viaNative();
    try { return await fetch(url, init); }
    catch (e) {
      if (e && e.name === "AbortError") throw e;
      if (H) return viaNative();
      throw e;
    }
  }

  async function callOpenAI(base, key, model, messages, opts) {
    base = String(base || "").trim().replace(/\/+$/, "");
    var url = /\/chat\/completions$/.test(base) ? base : base + "/chat/completions";
    var headers = { "Content-Type": "application/json", Authorization: "Bearer " + key };
    if (/openrouter\.ai/.test(base)) { headers["HTTP-Referer"] = "https://wicked9787.github.io/friday/"; headers["X-Title"] = "Friday"; }
    var body = openaiBody(model, messages, opts);
    var res;
    try {
      res = await http(url, { method: "POST", headers: headers, body: JSON.stringify(body), signal: opts.signal });
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
    if (opts.stream && opts.onDelta && !res.native && res.body) { var st = await readStream(res, opts.onDelta); return opts.raw ? { text: st, data: null } : st; }
    var data = await res.json();
    if (data && data.result && !data.choices && data.success !== undefined) data = data.result;
    var text = extractText(data);
    if (opts.onDelta && text) opts.onDelta(text);
    return opts.raw ? { text: text, data: data } : text;
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

  // ---------- 4.0: central intelligence router ----------
  /* Every request is sorted into a task, every brain she can use is a "route" with known strengths,
     and the routes are ranked for that task using what each is good at, how it has been doing,
     and how much of its free daily allowance is left. She tries them in that order and falls back
     automatically to the next compatible one. Adding a key in Settings adds a route; nothing else
     has to change. Her personality and memory are built on the phone and sent the same way to
     every brain, so switching brains never changes who she is. */

  // What each kind of model is good at (1 to 3). First match wins. Unknown models get the middle.
  var CAPS = [
    [/gpt-oss-120b/, { reason: 3, speed: 2, code: 3, write: 2, json: 3, web: true }],
    [/gpt-oss-20b/, { reason: 2, speed: 3, code: 2, write: 2, json: 2, web: true }],
    [/llama-4|scout|maverick|qwen3\.\d+-\d+b|-vl\b|vision/, { reason: 2, speed: 2, code: 1, write: 2, json: 2, vision: true }],
    [/llama-3\.3-70b/, { reason: 2, speed: 2, code: 2, write: 3, json: 2 }],
    [/qwen\/qwen3|qwen-?3/, { reason: 2, speed: 2, code: 3, write: 2, json: 2 }],
    [/8b-instant|llama-3\.1-8b/, { reason: 1, speed: 3, code: 1, write: 1, json: 1 }],
    [/gemini.*flash-lite/, { reason: 2, speed: 3, code: 2, write: 2, json: 2, vision: true, ground: true }],
    [/gemini/, { reason: 3, speed: 2, code: 3, write: 3, json: 3, vision: true, ground: true }],
    [/deepseek.*(r1|reason)/, { reason: 3, speed: 1, code: 3, write: 2, json: 2 }],
    [/deepseek/, { reason: 3, speed: 2, code: 3, write: 2, json: 2 }],
    [/coder|codestral|devstral/, { reason: 2, speed: 2, code: 3, write: 1, json: 2 }],
    [/claude|gpt-5|gpt-4\.1|grok-4/, { reason: 3, speed: 2, code: 3, write: 3, json: 3, vision: true }],
    [/mistral-(small|medium)|nemo/, { reason: 2, speed: 2, code: 2, write: 2, json: 2 }],
    [/gemma/, { reason: 2, speed: 2, code: 1, write: 2, json: 1 }]
  ];
  var CAPS_DEFAULT = { reason: 2, speed: 2, code: 2, write: 2, json: 2 };
  function capsFor(text) {
    text = String(text || "").toLowerCase();
    for (var i = 0; i < CAPS.length; i++) if (CAPS[i][0].test(text)) return Object.assign({}, CAPS_DEFAULT, CAPS[i][1]);
    return Object.assign({}, CAPS_DEFAULT);
  }
  // Rough free daily allowances (requests a day). Estimates: real limits change, errors still count most.
  var FREE_DAILY = [
    [/^groq:.*8b-instant/, 14400], [/^groq:/, 1000],
    [/gemini.*flash-lite/, 1000], [/gemini/, 250],
    [/openrouter|:free$/, 50], [/cloudflare/, 300], [/cerebras/, 1000], [/mistral/, 500]
  ];
  function dailyLimit(r) {
    if (!r.free) return 0;                                   // paid: no free allowance to protect
    var key = r.id + " " + (r.provider || "") + " " + (r.model || "");
    for (var i = 0; i < FREE_DAILY.length; i++) if (FREE_DAILY[i][0].test(key)) return FREE_DAILY[i][1];
    return 300;
  }

  // Tasks: what matters for each (weights on the strengths above).
  var TASKS = {
    chat:       { label: "Conversation", w: { speed: 1.2, write: 1, reason: 0.6 } },
    quick:      { label: "Quick sorting", w: { speed: 2, reason: 0.3, json: 0.3 }, background: true },
    reasoning:  { label: "Thinking things through", w: { reason: 2, write: 0.5, speed: 0.3 } },
    coding:     { label: "Code", w: { code: 2, reason: 1 } },
    writing:    { label: "Writing texts and messages", w: { write: 2, reason: 0.5, speed: 0.5 } },
    research:   { label: "Research (weighing sources)", w: { reason: 1.5, json: 1, speed: 0.3 } },
    web:        { label: "Searching the web", w: { reason: 1, speed: 1 }, need: "web" },
    vision:     { label: "Looking at photos", w: { reason: 1, speed: 1 }, need: "vision" },
    reflection: { label: "Her reflections", w: { reason: 2, json: 1.5 }, background: true },
    summary:    { label: "Summaries and memory", w: { speed: 1, write: 1, json: 0.5 }, background: true }
  };
  var CODE_RE = /\b(code|coding|javascript|typescript|python|swift|html|css|function|regex|bug|stack trace|compile|sql|json|api|script)\b/i;
  var THINK_RE = /\b(explain|why does|why do|why is|compare|pros and cons|plan|step by step|calculate|math|solve|figure out|analy[sz]e|strategy|decide|should i)\b/i;
  function lastUserText(messages) {
    for (var i = (messages || []).length - 1; i >= 0; i--) {
      var m = messages[i];
      if (m && m.role === "user") return typeof m.content === "string" ? m.content : (Array.isArray(m.content) ? m.content.map(function (p) { return p.text || ""; }).join(" ") : "");
    }
    return "";
  }
  function classifyTask(messages, opts) {
    opts = opts || {};
    if (opts.task && TASKS[opts.task]) return opts.task;
    if (opts.purpose === "vision") return "vision";
    if (opts.tools) return "web";
    if (opts.purpose === "small") return "quick";
    var t = lastUserText(messages);
    if (CODE_RE.test(t)) return "coding";
    if (THINK_RE.test(t) || t.split(/\s+/).length > 60) return "reasoning";
    return "chat";
  }

  // How each route has been doing: kept on the phone so it carries across restarts.
  var HEALTH_KEY = "brain.health", USE_KEY = "brain.usage";
  var healthCache = null, healthSaveT = 0;
  function healthAll() { if (!healthCache) healthCache = store().get(HEALTH_KEY, {}) || {}; return healthCache; }
  function healthOf(id) { var h = healthAll(); return h[id] || (h[id] = { ok: 0, fail: 0, fails: [], ms: 0, tasks: {}, dailyHits: [] }); }
  function saveHealth() { clearTimeout(healthSaveT); healthSaveT = setTimeout(function () { try { store().set(HEALTH_KEY, healthAll()); } catch (e) {} }, 400); }
  function todayKey() { return new Date().toDateString(); }
  function usageAll() { var u = store().get(USE_KEY, null); if (!u || u.date !== todayKey()) u = { date: todayKey(), counts: {} }; return u; }
  function usedToday(id) { return usageAll().counts[id] || 0; }
  function noteRoute(r, task, ok, kind, msTaken) {
    var h = healthOf(r.id), t = h.tasks[task] || (h.tasks[task] = { ok: 0, fail: 0 }), at = now();
    if (ok) {
      h.ok++; t.ok++;
      h.ms = h.ms ? Math.round(h.ms * 0.7 + msTaken * 0.3) : msTaken;
      var u = usageAll(); u.counts[r.id] = (u.counts[r.id] || 0) + 1; store().set(USE_KEY, u);
    } else {
      h.fail++; t.fail++;
      h.fails = (h.fails || []).filter(function (x) { return at - x < 30 * 60 * 1000; }).concat([at]).slice(-10);
      h.lastKind = kind; h.lastFailAt = at;
      if (kind === "daily") h.dailyHits = (h.dailyHits || []).filter(function (x) { return new Date(x).toDateString() === todayKey(); }).concat([at]);
    }
    saveHealth();
  }
  // How much of today's free allowance is left (0 to 1). Two "daily limit" errors today = none left.
  function quotaLeft(r) {
    var h = healthOf(r.id);
    if ((h.dailyHits || []).filter(function (x) { return new Date(x).toDateString() === todayKey(); }).length >= 2) return 0;
    var lim = dailyLimit(r);
    if (!lim) return 1;
    return Math.max(0, 1 - usedToday(r.id) / lim);
  }

  // Every brain she can use right now.
  function routes(forVision) {
    var out = [], seen = {}, key = groqKey();
    if (key) {
      var models = forVision ? GROQ_VISION_MODELS.slice() : GROQ_CHAT_MODELS.concat(GROQ_SMALL_MODELS);
      if (!forVision && cfg().MODEL) models.unshift(cfg().MODEL);
      models.forEach(function (m) {
        if (seen[m]) return; seen[m] = 1;
        var c = capsFor(m);
        if (forVision) c.vision = true;
        out.push({ id: "groq:" + m, kind: "groq", name: "Groq " + m.replace(/^.*\//, ""), provider: "groq", model: m, free: true, main: true, preferred: m === cfg().MODEL, caps: c });
      });
    }
    backupAgents().forEach(function (ag) {
      var pr = PRESETS[ag.provider] || {};
      var c = capsFor((ag.provider || "") + "/" + (ag.model || ""));
      if (ag.vision === false) c.vision = false;
      out.push({ id: "agent:" + ag.id, kind: "agent", agent: ag, name: ag.name, provider: ag.provider, model: ag.model,
        free: !!pr.free || /:free$/.test(ag.model || "") || ag.provider === "cloudflare", caps: c });
    });
    return out;
  }

  function scoreRoute(r, task) {
    var w = TASKS[task].w, c = r.caps, s = 0;
    Object.keys(w).forEach(function (k) { s += w[k] * (c[k] || 0); });
    var lim = dailyLimit(r), left = quotaLeft(r), h = healthOf(r.id);
    if (r.free) s += lim >= 1000 ? 0.5 : lim <= 60 ? -0.5 : 0;   // spend plentiful free allowances before scarce ones
    if (left < 0.15) s -= 3; else if (left < 0.35) s -= 1;
    s -= Math.min(3, ((h.fails || []).filter(function (x) { return now() - x < 30 * 60 * 1000; }).length) * 0.8);
    var t = h.tasks && h.tasks[task];
    if (t && t.ok + t.fail >= 5) s += (t.ok / (t.ok + t.fail) - 0.8) * 2;   // learned: how it actually does at this task
    if (h.ms > 9000) s -= 0.5;
    if (r.main) s += 0.4;          // her main brain: fastest and free
    if (r.preferred && task === "chat") s += 0.3;
    if (!r.free) s -= 1.5;         // paid brains only when clearly better or the free ones are out
    return Math.round(s * 100) / 100;
  }

  // The order she'll try brains in for this request.
  function plan(messages, opts) {
    opts = opts || {};
    var task = classifyTask(messages, opts), T = TASKS[task];
    var list = routes(T.need === "vision").filter(function (r) { return !missing[r.id]; });
    if (T.need === "vision") list = list.filter(function (r) { return r.caps.vision; });
    if (T.need === "web") list = list.filter(function (r) { return r.caps.web && r.kind === "groq"; });   // the web tool is Groq's
    if (opts.noBackup) list = list.filter(function (r) { return r.kind === "groq"; });
    if (T.background || opts.priority === "background") {
      // Background work (reflections, learning, summaries, sorting) never spends a paid brain or the last
      // 30% of a free allowance. If no free brain has that much left, the work waits for another time.
      list = list.filter(function (r) { return r.free && quotaLeft(r) > 0.3; });
    }
    list.forEach(function (r) { r.score = scoreRoute(r, task); });
    list.sort(function (a, b) { return b.score - a.score; });
    var ready = list.filter(function (r) { return available(r.id); });
    if (!ready.length && list.length) {
      // everything is resting: try the one whose rest ends first instead of refusing
      var rest = list.slice().sort(function (a, b) { return (cooldown[a.id] || 0) - (cooldown[b.id] || 0); });
      delete cooldown[rest[0].id];
      ready = [rest[0]];
    }
    return { task: task, label: T.label, order: ready, all: list };
  }

  function friendly(kindCounts) {
    if (kindCounts.auth && !kindCounts.busy && !kindCounts.daily) return groqKey() ? "My brain rejected its key. Check it in Settings." : "Add a Groq key in Settings first.";
    if (kindCounts.daily || kindCounts.busy) {
      return backupAgents().length
        ? "Every brain I have is busy right now. Give me a minute and try again."
        : "Groq is at its limit right now. Try again in a bit, or add a free backup brain in Settings, Connections.";
    }
    if (kindCounts.offline) return "I can't reach the internet right now. Check your connection and try again.";
    if (kindCounts.down) return "My brain is having a hiccup. Try again in a few seconds.";
    return "Something went wrong talking to my brain. Try again.";
  }

  /* opts: { task, purpose: "chat"|"small"|"vision", priority: "background", temperature, max_tokens, tools,
             reasoning_effort, stream, onDelta, signal, noBackup, raw }
     Returns { text, data, route, task }. */
  async function askDetailed(messages, opts) {
    opts = opts || {};
    var p = plan(messages, opts), counts = {}, tried = 0;
    var started = false;
    var wrapDelta = opts.onDelta ? function (t) { started = true; opts.onDelta(t); } : null;
    for (var i = 0; i < p.order.length; i++) {
      var r = p.order[i];
      if (!available(r.id) && i > 0) continue;
      tried++;
      var t0 = now();
      try {
        var res;
        if (r.kind === "groq") {
          res = await callOpenAI(GROQ_BASE, groqKey(), r.model, messages, Object.assign({}, opts, { groq: true, onDelta: wrapDelta, tools: p.task === "web" ? opts.tools : null, raw: true }));
        } else {
          var o = Object.assign({}, opts, { groq: /groq\.com/.test(r.agent.baseUrl || ""), tools: null, onDelta: wrapDelta });
          res = { text: await callAgent(r.agent, messages, o), data: null };
        }
        var out = res && typeof res === "object" ? res.text : res;
        if (!out && !started) { counts.other = (counts.other || 0) + 1; noteRoute(r, p.task, false, "empty", 0); continue; }
        noteRoute(r, p.task, true, null, now() - t0);
        lastUsed = r.name;
        noteUse(r.kind === "groq" ? r.model : r.name);
        if (p.task !== "quick" && !(TASKS[p.task].background)) {
          activity(r.kind === "groq" ? "thinking" : "agents", (tried > 1 ? "Switched brains · " : "") + TASKS[p.task].label + " · " + r.name, { brain: r.name, quiet: opts.quietLog });
        }
        return { text: out, data: res && res.data, route: { id: r.id, name: r.name }, task: p.task };
      } catch (e) {
        if (e && e.name === "AbortError") throw e;
        if (started) throw e;
        var kind = e.kind || "other";
        counts[kind] = (counts[kind] || 0) + 1;
        noteRoute(r, p.task, false, kind, 0);
        if (kind === "offline") break;
        if (kind === "auth") {
          // a rejected key is the provider's key, not one model: rest every route that uses it
          p.order.forEach(function (x) { if (x.kind === r.kind && (r.kind === "groq" || x.id === r.id)) markCooldown(x.id, "daily"); });
          continue;
        }
        if (kind === "model") missing[r.id] = true;
        // a failed web search is usually the search tool, not the model: only rest it for real limits
        else if (kind !== "toolong" && !(p.task === "web" && kind !== "busy" && kind !== "daily")) markCooldown(r.id, kind);
      }
    }
    if (!groqKey() && !backupAgents().length) throw BrainError("Add a Groq API key in Settings first.", "auth");
    if (!p.order.length && p.task === "web") return { text: "", data: null, route: null, task: p.task };
    if (!p.order.length && (TASKS[p.task].background || opts.priority === "background")) {
      activity("thinking", "Saved " + TASKS[p.task].label.toLowerCase() + " for later: every free brain is low today", { quiet: true });
      throw BrainError("Saved for later to protect the free allowance.", "deferred");
    }
    throw BrainError(friendly(counts), "exhausted");
  }
  async function ask(messages, opts) {
    var r = await askDetailed(messages, opts);
    return r.text;
  }

  // Gemini with Google Search: answers grounded in pages it actually found (free tier, if a Gemini key is set up).
  async function groundedSearch(question, opts) {
    opts = opts || {};
    var gem = connections().filter(function (c) { return c.provider === "gemini" || /generativelanguage/.test(c.baseUrl || ""); })
      .filter(function (c) { return keyFor(c) && available("ground:" + c.id); })[0];
    if (!gem) return null;
    var key = keyFor(gem), model = /flash/.test(gem.model || "") ? gem.model : "gemini-flash-latest";
    var url = geminiBase(gem.baseUrl) + "/models/" + encodeURIComponent(String(model).replace(/^models\//, "")) + ":generateContent";
    var body = { contents: [{ role: "user", parts: [{ text: question }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.2 } };
    var r = { id: "ground:" + gem.id, name: gem.name + " + Google Search", free: true, provider: "gemini", model: model };
    var t0 = now();
    try {
      var res = await http(url, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body), signal: opts.signal });
      if (!res.ok) { var et = ""; try { et = await res.text(); } catch (e0) {} throw BrainError(et.slice(0, 200), classifyError(res.status, et)); }
      var data = await res.json();
      var cand = (data.candidates || [])[0] || {};
      var text = ((cand.content && cand.content.parts) || []).filter(function (p) { return p && p.text && !p.thought; }).map(function (p) { return p.text; }).join("").trim();
      var gm = cand.groundingMetadata || {};
      var chunks = (gm.groundingChunks || []).map(function (c) { return c && c.web ? { title: c.web.title || "", url: c.web.uri || "" } : null; });
      var supports = (gm.groundingSupports || []).map(function (s) { return { text: (s.segment && s.segment.text) || "", chunks: s.groundingChunkIndices || [] }; });
      noteRoute(r, "web", true, null, now() - t0);
      noteUse(r.name);
      return { text: text, chunks: chunks, supports: supports, via: "Google Search" };
    } catch (e) {
      if (e && e.name === "AbortError") throw e;
      noteRoute(r, "web", false, e.kind || "other", 0);
      if (e.kind && e.kind !== "offline") markCooldown(r.id, e.kind === "bad" ? "daily" : e.kind);
      return null;
    }
  }

  // What she'd pick for each task right now (for Settings and the neural map).
  function explain() {
    return Object.keys(TASKS).map(function (task) {
      var p = plan([{ role: "user", content: "" }], { task: task });
      return { task: task, label: TASKS[task].label, order: p.all.slice(0, 4).map(function (r) { return { name: r.name, score: r.score, resting: !available(r.id), left: Math.round(quotaLeft(r) * 100), free: r.free }; }) };
    });
  }
  function routeReport() {
    return routes(false).concat(routes(true).filter(function (r) { return r.kind === "groq"; })).filter(function (r, i, a) { return a.findIndex(function (x) { return x.id === r.id; }) === i; })
      .map(function (r) { var h = healthOf(r.id), lim = dailyLimit(r); return { id: r.id, name: r.name, free: r.free, used: usedToday(r.id), limit: lim, left: Math.round(quotaLeft(r) * 100), ok: h.ok, fail: h.fail, resting: !available(r.id), missing: !!missing[r.id], caps: r.caps }; });
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
      res = await http(base + "/models", { headers: key ? { Authorization: "Bearer " + key } : {} });
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
    mistral: [/^mistral-small-latest$/, /^mistral-medium-latest$/, /^open-mistral-nemo/, /^mistral-small/]
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

  // Cloudflare Workers AI: free every day (no card). Needs your Account ID and an API token.
  var CF_MODELS = ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/openai/gpt-oss-120b", "@cf/meta/llama-3.1-8b-instruct-fast"];
  async function addCloudflare(account, token, onStep) {
    account = String(account || "").trim().toLowerCase();
    token = String(token || "").trim().replace(/^Bearer\s+/i, "").replace(/\s+/g, "");
    var step = typeof onStep === "function" ? onStep : function () {};
    if (!/^[a-f0-9]{32}$/.test(account)) return { ok: false, reason: "account" };
    if (token.length < 20) return { ok: false, reason: "short" };
    var st = store();
    var base = "https://api.cloudflare.com/client/v4/accounts/" + account + "/ai/v1";
    var all = st.get("connections", []) || [];
    var same = all.filter(function (c) { return c && c.type === "agent" && c.provider === "cloudflare" && c.baseUrl === base && st.getAgentKey(c.id) === token; })[0];
    if (same) { same.backup = true; st.set("connections", all); return { ok: true, already: true, name: same.name, model: same.model }; }
    var lastReason = "";
    for (var j = 0; j < CF_MODELS.length; j++) {
      var agent = { id: "a" + Math.random().toString(36).slice(2, 9), name: "Cloudflare", type: "agent", provider: "cloudflare", style: "openai", baseUrl: base, model: CF_MODELS[j], kind: "chat" };
      st.setAgentKey(agent.id, token);
      step("Testing Cloudflare (" + CF_MODELS[j].split("/").pop() + ")…");
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
        agent.name = uniqueName("Cloudflare", all);
        agent.backup = true;
        all.push(agent);
        st.set("connections", all);
        return { ok: true, provider: "cloudflare", name: agent.name, model: agent.model, limited: limited };
      }
      st.setAgentKey(agent.id, "");
      if (lastReason === "auth" || lastReason === "offline") break;
    }
    return { ok: false, reason: lastReason || "unknown" };
  }

  root.FridayBrain = {
    addKey: addKey,
    addCloudflare: addCloudflare,
    http: http,
    guessProviders: guessProviders,
    pickModels: pickModels,
    noteUse: noteUse,
    activity: activity,
    ask: ask,
    askDetailed: askDetailed,
    plan: plan,
    classifyTask: classifyTask,
    explain: explain,
    routeReport: routeReport,
    groundedSearch: groundedSearch,
    TASKS: TASKS,
    capsFor: capsFor,
    askAgent: askAgent,
    listModels: listModels,
    test: test,
    PRESETS: PRESETS,
    GROQ_BASE: GROQ_BASE,
    lastUsed: function () { return lastUsed; },
    status: function () {
      var busy = Object.keys(cooldown).filter(function (k) { return cooldown[k] > now(); });
      return { busy: busy, missing: Object.keys(missing), backups: backupAgents().map(function (a) { return a.name; }), routes: routeReport() };
    }
  };
})(window);
