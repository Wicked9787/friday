/* Groq chat, persona, rolling memory, and multi-agent helpers. */
(function (root) {
  "use strict";

  var HISTORY_LIMIT = 12;
  var WEB_RE = /\b(news|headlines?|score|scores|who won|won the|game tonight|stock|stocks|price of|prices?|how much (is|does|are)|bitcoin|today|tonight|tomorrow|this week|latest|current|currently|right now|recent|who is|who's|what is|what's|when is|when does|where is|how old|population|election|forecast|open now|hours)\b/i;

  var HELPERS = {
    research: {
      name: "research",
      system: "You are Friday's research helper. Gather clear, useful facts. Prefer concise, well-structured answers with any uncertainty flagged. Do not speak as Friday; write a brief research brief she can voice."
    },
    coding: {
      name: "coding",
      system: "You are Friday's coding helper. Give working, practical code and short explanations. Do not speak as Friday; write a brief technical brief she can voice."
    },
    money: {
      name: "money",
      system: "You are Friday's money and bills helper. Be careful, plain, and practical. This is not formal financial advice. Do not speak as Friday; write a brief brief she can voice."
    },
    messages: {
      name: "messages",
      system: "You are Friday's messaging helper. Draft short, natural texts or emails the user can send. Do not speak as Friday; write the draft and a one-line note she can voice."
    }
  };

  var PHONE_PATTERNS = [
    { re: /\b(set|make|create|change|cancel|turn off|delete)\b.*\balarm/i, name: "alarm" },
    { re: /\balarm\b.*\b(for|at|to)\b/i, name: "alarm" },
    { re: /\b(wake me|alarm)\b/i, name: "alarm" },
    { re: /\blights?\b/i, name: "lights" },
    { re: /\b(brightness|dim|brighten)\b/i, name: "lights" },
    { re: /\b(apple tv|tv|television)\b/i, name: "tv" },
    { re: /\b(un)?lock\b.*\b(door|doors|house)\b|\b(door|doors)\b.*\b(un)?lock|\block (it|up)\b/i, name: "lock" },
    { re: /\bscenes?\b/i, name: "scene" },
    { re: /\b(do not disturb|don't disturb|dnd)\b/i, name: "dnd" },
    { re: /\b(text|sms|message|iMessage)\b/i, name: "messages" },
    { re: /\bcameras?\b/i, name: "cameras" },
    { re: /\b(play|pause|skip|music|spotify|apple music)\b/i, name: "music" },
    { re: /\bweather\b/i, name: "weather" },
    { re: /\bgood ?night\b/i, name: "good night" },
    { re: /\bfind my (iphone|phone)\b/i, name: "find my phone" },
    { re: /\bbattery\b/i, name: "battery" },
    { re: /\bremind me\b/i, name: "remind" },
    { re: /\bmorning briefing\b/i, name: "morning briefing" }
  ];

  function detectPhoneIntent(text) {
    var t = String(text || "");
    // In-app timer is handled before this in app.js, but keep the rest.
    for (var i = 0; i < PHONE_PATTERNS.length; i++) {
      if (PHONE_PATTERNS[i].re.test(t)) return PHONE_PATTERNS[i].name;
    }
    return null;
  }

  function detectInAppTimer(text) {
    var m = String(text || "").match(/\b(?:set |start |a )?timer (?:for )?(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)?\b/i);
    if (!m) m = String(text || "").match(/\b(\d+)\s*(second|sec|minute|min|hour|hr)s? timer\b/i);
    if (!m) return null;
    var n = parseInt(m[1], 10);
    var unit = (m[2] || "minutes").toLowerCase();
    var sec = n * 60;
    if (/^sec/.test(unit)) sec = n;
    if (/^hour|^hr/.test(unit)) sec = n * 3600;
    return sec;
  }

  function personaPrompt(profile, memory) {
    var terms = (profile.terms || []).join(" or ");
    var perTen = profile.addressPerTen || 4;
    var mem = (memory || []).map(function (m, i) { return "- " + m.text; }).join("\n");
    return [
      "You are " + profile.assistantName + ", a personal AI assistant for " + profile.ownerName + ".",
      "Style: warm, casual, dry wit, loyal, light teasing, never rude. Talk like a close friend having a real back-and-forth conversation: react to what they said, remember what was said earlier in this chat, and sometimes ask a short follow-up question.",
      "Everything you say is spoken aloud, so keep replies short (one to three sentences), no lists, no markdown, no links, no emojis.",
      "Address " + profile.ownerName + " as " + (terms || "nothing special") + " about " + perTen + " times in every 10 lines of dialogue. The rest of the time, use no honorific at all — just talk plainly.",
      "Do not overuse the address terms. Mix them in naturally. Never stack them in the same sentence.",
      "Keep answers concise unless you are asked for more. Today is " + new Date().toDateString() + ".",
      "If you need the phone to do something you cannot do yourself (alarms, lights, the Apple TV, locks, scenes, Do Not Disturb, sending a real text, cameras), say clearly that you will hand it to the " + (profile.shortcutName || "Friday") + " shortcut.",
      mem ? ("Things you know about " + profile.ownerName + " (use them naturally, don't recite them):\n" + mem) : "You have no long-term memory notes yet.",
      "Your name is " + profile.assistantName + ". The person you help is " + profile.ownerName + "."
    ].join("\n");
  }

  function helperPrompt(kind, profile) {
    return (HELPERS[kind] && HELPERS[kind].system) || HELPERS.research.system;
  }

  async function groqChat(messages, opts) {
    opts = opts || {};
    var key = root.FridayStorage.getApiKey();
    if (!key) throw new Error("Add a Groq API key in Settings first.");
    var body = {
      model: opts.model || root.FRIDAY_CONFIG.MODEL,
      messages: messages,
      temperature: opts.temperature == null ? 0.7 : opts.temperature,
      include_reasoning: false
    };
    if (opts.max_tokens) body.max_tokens = opts.max_tokens;
    if (opts.tools) body.tools = opts.tools;
    if (opts.reasoning_effort) body.reasoning_effort = opts.reasoning_effort;
    var res = await fetch(root.FRIDAY_CONFIG.CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      var errText = "";
      try { errText = await res.text(); } catch (e) {}
      if (res.status === 401) throw new Error("That Groq key was rejected. Check it in Settings.");
      if (res.status === 429) throw new Error("Groq is rate-limiting us. Wait a moment and try again.");
      throw new Error("Groq request failed (" + res.status + ").");
    }
    var data = await res.json();
    var choice = (data.choices && (data.choices[0] || data.choices[1])) || {};
    var msg = choice.message || {};
    var text = msg.content || msg.reasoning || "";
    if (Array.isArray(text)) {
      text = text.map(function (p) { return p.text || p.content || ""; }).join("\n");
    }
    return String(text || "").trim();
  }

  // Web answers come back with citation marks like 【2†L6-L10】; strip them so they read well aloud.
  function cleanSpoken(t) {
    return String(t || "").replace(/【[^】]*】/g, "").replace(/\[\d+\]/g, "").replace(/\*\*/g, "").replace(/\s{2,}/g, " ").trim();
  }

  // ---- Added agents (ChatGPT, Groq, any OpenAI-compatible endpoint) ----
  function listAgents() {
    var list = root.FridayStorage.get("connections", []) || [];
    return Array.isArray(list) ? list.filter(function (c) { return c && c.type === "agent"; }) : [];
  }

  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function detectAgent(text) {
    var t = String(text || "").trim().replace(/[.!?]+$/, "");
    var agents = listAgents();
    for (var i = 0; i < agents.length; i++) {
      var a = agents[i];
      var names = [a.name];
      if (a.provider === "openai") names.push("chat gpt", "chatgpt", "gpt", "open ai", "openai");
      for (var j = 0; j < names.length; j++) {
        if (!names[j]) continue;
        var n = escRe(String(names[j]).trim()).replace(/\s+/g, "\\s*");
        var re = new RegExp("^(?:hey \\w+[, ]+)?(?:please |can you |could you )?(?:ask|have|tell|let|use|get|check with) " + n + "\\b[\\s,:]*(?:to |if |whether )?(.*)$", "i");
        var m = t.match(re);
        if (m) return { agent: a, prompt: (m[1] || "").trim() };
      }
    }
    return null;
  }

  async function agentChat(agent, prompt, profile) {
    var key = root.FridayStorage.getAgentKey(agent.id);
    if (!key && agent.provider === "groq") key = root.FridayStorage.getApiKey();
    if (!key) throw new Error("I don't have a key for " + agent.name + ". Add one in Settings, Connections.");
    var base = String(agent.baseUrl || "").trim().replace(/\/+$/, "");
    if (!base) throw new Error(agent.name + " is missing its web address. Check it in Settings, Connections.");
    var url = /\/chat\/completions$/.test(base) ? base : base + "/chat/completions";
    var res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: JSON.stringify({
          model: agent.model || "gpt-5-mini",
          messages: [
            { role: "system", content: "You are " + agent.name + ". " + (profile.assistantName || "Friday") + " is relaying a question from " + (profile.ownerName || "the user") + " and will read your answer aloud. Answer in two to four plain sentences, no markdown or lists." },
            { role: "user", content: prompt }
          ]
        })
      });
    } catch (e) {
      throw new Error("I couldn't reach " + agent.name + ". Check the internet or its web address.");
    }
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error(agent.name + " rejected the key. Check it in Settings, Connections.");
      if (res.status === 404) throw new Error(agent.name + " didn't recognize that model or address. Check it in Settings, Connections.");
      if (res.status === 429) throw new Error(agent.name + " is busy or out of credit right now. Try again in a bit.");
      throw new Error(agent.name + " had a problem (" + res.status + "). Try again in a bit.");
    }
    var data = await res.json();
    var msg = ((data.choices && data.choices[0]) || {}).message || {};
    var out = msg.content || "";
    if (Array.isArray(out)) out = out.map(function (p) { return p.text || ""; }).join(" ");
    out = cleanSpoken(out);
    if (!out) throw new Error(agent.name + " sent back an empty answer.");
    return out;
  }

  function FridayChat(opts) {
    this.profile = opts.profile;
    this.history = root.FridayStorage.get("history", []);
    this.memory = root.FridayStorage.get("memory", []);
    this.onHelper = opts.onHelper || function () {};
  }

  FridayChat.prototype.save = function () {
    root.FridayStorage.set("history", this.history.slice(-80));
    root.FridayStorage.set("memory", this.memory);
  };

  FridayChat.prototype.addMemory = function (text) {
    text = String(text || "").trim();
    if (!text) return;
    this.memory.push({ text: text, at: new Date().toISOString() });
    this.save();
    try { root.dispatchEvent(new CustomEvent("friday:memory")); } catch (e) {}
  };

  FridayChat.prototype.removeMemory = function (i) {
    this.memory.splice(i, 1);
    this.save();
    try { root.dispatchEvent(new CustomEvent("friday:memory")); } catch (e) {}
  };

  FridayChat.prototype.rememberFromSpeech = function (text) {
    var m = String(text || "").match(/^(?:please )?(?:remember|don't forget|dont forget)\s+(?:that\s+)?(.+)/i);
    return m ? m[1].trim() : null;
  };

  FridayChat.prototype.classify = async function (text) {
    var prompt = [
      { role: "system", content: "Classify the user request as one of: chat, research, coding, money, messages, phone. Reply with only the one word." },
      { role: "user", content: text }
    ];
    try {
      var out = (await groqChat(prompt, { temperature: 0, max_tokens: 16 })).toLowerCase();
      if (/research/.test(out)) return "research";
      if (/cod/.test(out)) return "coding";
      if (/money|bill|budget/.test(out)) return "money";
      if (/message|sms|email/.test(out)) return "messages";
      if (/phone/.test(out)) return "phone";
      return "chat";
    } catch (e) {
      return "chat";
    }
  };

  FridayChat.prototype.ask = async function (userText) {
    var text = String(userText || "").trim();
    if (!text) return { text: "", kind: "chat" };
    this.history.push({ role: "user", content: text, at: new Date().toISOString() });
    this.save();
    this.onHelper("thinking");

    var mem = this.rememberFromSpeech(text);
    if (mem) {
      this.addMemory(mem);
      var ack = this._ackMemory();
      this.history.push({ role: "assistant", content: ack, at: new Date().toISOString() });
      this.save();
      this.onHelper(null);
      return { text: ack, kind: "memory" };
    }

    var ag = detectAgent(text);
    if (ag) {
      if (!ag.prompt) {
        this.onHelper(null);
        return { text: "What should I ask " + ag.agent.name + "?", kind: "agent" };
      }
      this.onHelper("research");
      var said;
      try {
        said = await agentChat(ag.agent, ag.prompt, this.profile);
      } finally {
        this.onHelper(null);
      }
      var line = ag.agent.name + " says: " + said;
      this.history.push({ role: "assistant", content: line, at: new Date().toISOString() });
      this.save();
      return { text: line, kind: "agent" };
    }

    var phone = detectPhoneIntent(text);
    var timer = detectInAppTimer(text);
    if (timer) {
      this.onHelper(null);
      return { text: "", kind: "timer", seconds: timer, raw: text };
    }
    if (phone && phone !== "messages") {
      var handoff = this._handoffLine(text);
      this.history.push({ role: "assistant", content: handoff, at: new Date().toISOString() });
      this.save();
      this.onHelper(null);
      return { text: handoff, kind: "phone", command: text };
    }

    var web = WEB_RE.test(text) && phone !== "messages";
    var kind = web ? "chat" : await this.classify(text);
    this.onHelper(web ? "research" : (kind === "chat" ? "thinking" : kind));

    var helperText = "";
    if (HELPERS[kind] && !web) {
      helperText = await groqChat([
        { role: "system", content: helperPrompt(kind, this.profile) },
        { role: "user", content: text }
      ], { temperature: 0.4 });
    }

    var messages = [{ role: "system", content: personaPrompt(this.profile, this.memory) }];
    this.history.slice(-HISTORY_LIMIT).forEach(function (h) {
      if (h.role === "user" || h.role === "assistant") {
        messages.push({ role: h.role, content: h.content });
      }
    });
    if (helperText) {
      messages.push({
        role: "system",
        content: "Your " + kind + " helper produced this brief. Answer the user in your own voice, using it. Do not mention the helper by name unless asked.\n\n" + helperText
      });
    }
    if (kind === "messages" || phone === "messages") {
      messages.push({
        role: "system",
        content: "If they want a real text sent from the phone, include a short confirmation and know the app may open Messages or the shortcut."
      });
    }

    var reply = "";
    if (web) {
      // Groq's built-in browser search (groq/compound was retired in Sept 2026).
      try {
        messages.push({ role: "system", content: "Search the web if it helps, then answer in one to three short spoken sentences. No links or citations." });
        reply = cleanSpoken(await groqChat(messages, { tools: [{ type: "browser_search" }], reasoning_effort: "low", temperature: 0.6 }));
      } catch (e) { reply = ""; }
      if (!reply) {
        messages.pop();
        reply = await groqChat(messages);
      }
    } else {
      reply = await groqChat(messages);
    }
    this.learn(text).catch(function () {});
    this.history.push({ role: "assistant", content: reply, at: new Date().toISOString() });
    this.save();
    this.onHelper(null);
    return { text: reply, kind: kind, command: (kind === "messages" || phone === "messages") ? text : null };
  };

  // Quietly pick up lasting personal facts from what the user says.
  FridayChat.prototype.learn = async function (userText) {
    var t = String(userText || "");
    if (t.length < 12 || !/\b(i|i'm|im|i've|my|me|mine|we|our|us)\b/i.test(t)) return;
    var owner = this.profile.ownerName || "the user";
    var out = await groqChat([
      { role: "system", content: "Extract lasting personal facts about " + owner + " from their message: preferences, likes and dislikes, names of family, friends or pets, routines, important dates, where things are. Ignore one-off requests, questions, and anything temporary. Write each fact as a short third-person sentence starting with " + owner + " (for example: " + owner + " likes black coffee.). Reply with only a JSON array of strings, or [] if there is nothing lasting." },
      { role: "user", content: t }
    ], { temperature: 0, max_tokens: 400, reasoning_effort: "low" });
    var m = String(out || "").match(/\[[\s\S]*\]/);
    if (!m) return;
    var facts;
    try { facts = JSON.parse(m[0]); } catch (e) { return; }
    if (!Array.isArray(facts) || !facts.length) return;
    function norm(x) { return String(x || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim(); }
    var self = this, added = 0;
    facts.slice(0, 3).forEach(function (f) {
      f = String(f || "").trim();
      var nf = norm(f);
      if (nf.length < 6 || nf.length > 200) return;
      var dup = self.memory.some(function (x) {
        var nx = norm(x.text);
        return nx === nf || nx.indexOf(nf) >= 0 || nf.indexOf(nx) >= 0;
      });
      if (dup) return;
      self.memory.push({ text: f, at: new Date().toISOString(), auto: true });
      added++;
    });
    if (added) {
      this.save();
      try { root.dispatchEvent(new CustomEvent("friday:memory")); } catch (e) {}
    }
  };

  FridayChat.prototype._ackMemory = function () {
    var terms = this.profile.terms || [];
    var t = terms[Math.floor(Math.random() * terms.length)] || "";
    var lines = t ? [
      "I will remember that, " + t + ".",
      "Saved to memory, " + t + ".",
      "Locked in."
    ] : ["I will remember that.", "Saved to memory.", "Locked in."];
    return lines[Math.floor(Math.random() * lines.length)];
  };

  FridayChat.prototype._handoffLine = function (cmd) {
    var terms = this.profile.terms || [];
    var t = terms[0] ? ", " + terms[0] : "";
    return "On it" + t + ". I'll hand that to your shortcut.";
  };

  FridayChat.prototype.resetHistory = function () {
    this.history = [];
    this.save();
  };

  root.FridayChat = FridayChat;
  root.FridayGroq = { chat: groqChat, detectAgent: detectAgent, detectPhoneIntent: detectPhoneIntent, detectInAppTimer: detectInAppTimer };
})(window);
