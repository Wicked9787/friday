/* Groq chat, persona, rolling memory, and multi-agent helpers. */
(function (root) {
  "use strict";

  var HISTORY_LIMIT = 24;

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
    { re: /\b(tv|television)\b/i, name: "tv" },
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
      "Style: dry wit, loyal, polished, light teasing, never rude. You can just chat naturally, like a friend.",
      "Address " + profile.ownerName + " as " + (terms || "nothing special") + " about " + perTen + " times in every 10 lines of dialogue. The rest of the time, use no honorific at all — just talk plainly.",
      "Do not overuse the address terms. Mix them in naturally. Never stack them in the same sentence.",
      "Keep answers concise unless you are asked for more.",
      "If you need the phone to do something you cannot do yourself (alarms, lights, Do Not Disturb, sending a real text, cameras), say clearly that you will hand it to the " + (profile.shortcutName || "Friday") + " shortcut.",
      mem ? ("Long-term memory, written by " + profile.ownerName + ":\n" + mem) : "You have no long-term memory notes yet.",
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
      model: root.FRIDAY_CONFIG.MODEL,
      messages: messages,
      temperature: opts.temperature == null ? 0.7 : opts.temperature,
      include_reasoning: false
    };
    if (opts.max_tokens) body.max_tokens = opts.max_tokens;
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

    var kind = await this.classify(text);
    this.onHelper(kind === "chat" ? "thinking" : kind);

    var helperText = "";
    if (HELPERS[kind]) {
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

    var reply = await groqChat(messages);
    this.history.push({ role: "assistant", content: reply, at: new Date().toISOString() });
    this.save();
    this.onHelper(null);
    return { text: reply, kind: kind, command: (kind === "messages" || phone === "messages") ? text : null };
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
  root.FridayGroq = { chat: groqChat, detectPhoneIntent: detectPhoneIntent, detectInAppTimer: detectInAppTimer };
})(window);
