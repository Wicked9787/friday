/* Chat: persona, moods, rolling memory, long-chat summary, helpers, agents, streaming. */
(function (root) {
  "use strict";

  var HISTORY_LIMIT = 12;
  var WEB_RE = /\b(news|headlines?|score|scores|who won|won the|game tonight|playing tonight|schedule for|standings|stock|stocks|price of|prices?|how much (is|does|are|do)|cost|bitcoin|crypto|today|tonight|tomorrow|yesterday|this week|this weekend|last night|latest|current|currently|right now|recent|recently|update on|what happened|who is|who's|who was|what is|what's|what are|when is|when does|when did|when was|when were|where is|how old|how tall|net worth|population|election|forecast|open now|hours|release date|come out|coming out|trailer|lyrics|recipe|review|reviews|versus|compare|is it true|fact check|look ?up|search|google|find out|wikipedia|website|link)\b/i;
  var FORCE_WEB_RE = /^(?:please )?(?:search(?: the web| online| the internet)?(?: for)?|look up|google|find out|check online(?: for)?|browse(?: for)?)\s+(.+)$/i;
  var URL_RE = /\b((?:https?:\/\/|www\.)[^\s]+|[a-z0-9-]+\.(?:com|org|net|io|co|gov|edu|us|tv|app|dev|ai|news)(?:\/[^\s]*)?)/i;

  var HELPERS = {
    research: { system: "You are Friday's research helper. Gather clear, useful facts. Prefer concise, well-structured answers with any uncertainty flagged. Do not speak as Friday; write a brief research brief she can voice." },
    coding: { system: "You are Friday's coding helper. Give working, practical code and short explanations. Do not speak as Friday; write a brief technical brief she can voice." },
    money: { system: "You are Friday's money and bills helper. Be careful, plain, and practical. This is not formal financial advice. Do not speak as Friday; write a brief brief she can voice." },
    messages: { system: "You are Friday's messaging helper. Draft short, natural texts or emails the user can send. Do not speak as Friday; write the draft and a one-line note she can voice." }
  };

  var MOODS = {
    normal: { name: "Normal", line: "" },
    focus: { name: "Focus", line: "Mood: focus mode. Be brief and efficient. No small talk, no follow-up questions unless needed. One or two sentences." },
    hype: { name: "Hype", line: "Mood: hype mode. Be upbeat, energetic, encouraging, and playful. Celebrate wins." },
    calm: { name: "Calm", line: "Mood: calm mode. Be gentle, slow, reassuring, and soft-spoken. Short sentences." },
    bedtime: { name: "Bedtime", line: "Mood: bedtime mode. Speak softly and briefly like it's late at night. Wind things down, no excitement." },
    headache: { name: "Headache", line: "Mood: headache mode. They have a headache. Speak very gently and as briefly as you can, usually one short sentence. No jokes, no excitement, no follow-up questions unless needed. Be caring without fussing." }
  };

  var PHONE_PATTERNS = [
    { re: /\b(set|make|create|change|cancel|turn off|delete)\b.*\balarm/i, name: "alarm" },
    { re: /\balarm\b.*\b(for|at|to)\b/i, name: "alarm" },
    { re: /\b(wake me|alarm)\b/i, name: "alarm" },
    { re: /\b(lights?|lamps?|bulbs?)\b/i, name: "lights" },
    { re: /\b(brightness|dim|brighten)\b/i, name: "lights" },
    { re: /\b(apple tv|tv|television)\b/i, name: "tv" },
    { re: /\bscenes?\b/i, name: "scene" },
    { re: /\b(do not disturb|don't disturb|dnd)\b/i, name: "dnd" },
    { re: /\b(text|sms|message|iMessage)\b/i, name: "messages" },
    { re: /\bcameras?\b/i, name: "cameras" },
    { re: /\bhome ?pod\b/i, name: "music" },
    { re: /\b(pause|resume|skip|next song|previous song|turn (it |the music )?(up|down)|volume)\b/i, name: "music" },
    { re: /\b(play|put on|shuffle)\b.*\b(music|song|songs|playlist|album|radio|station|by|some)\b|\b(music|spotify|apple music)\b/i, name: "music" },
    { re: /^(?:(?:hey |ok |okay )?(?:friday|jarvis|reed)[, ]+)?(?:please |can you |could you )?(?:turn |switch )?(?:all|everything) (?:on|off)$|^(?:turn |switch )(?:on|off) (?:all|everything)$/i, name: "lights" },
    { re: /^(?:(?:hey |ok |okay )?(?:friday|jarvis|reed)[, ]+)?(?:please |can you |could you )?(?:call|facetime|face time|dial|phone|ring) (?!me\b|it\b|that\b|back\b)\S/i, name: "call" },
    { re: /^(?:(?:hey |ok |okay )?(?:friday|jarvis|reed)[, ]+)?(?:please |can you |could you )?(?:play|shuffle|put on) (?!(?:a |the )?(?:game|trivia|joke|video|movie|show)\b|with me\b|along\b)\S/i, name: "music" },
    { re: /\bgood ?night\b/i, name: "good night" },
    { re: /\bbattery\b/i, name: "battery" },
    { re: /\bremind me\b|\bset (a |an )?reminder\b/i, name: "remind" },
    { re: /\b(my calendar|on my calendar|calendar today|my schedule|what'?s on (today|tomorrow|my schedule)|appointments?|add (an |a )?(event|appointment)|schedule (a|an) )\b/i, name: "calendar" }
  ];

  function detectPhoneIntent(text) {
    var t = String(text || "");
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

  function settings() { return root.FridayStorage.get("settings", {}) || {}; }

  function currentMood() {
    var s = settings();
    var m = s.mood || "normal";
    if (m === "normal" && root.FridayNight && root.FridayNight.isNight()) m = "calm";
    return MOODS[m] ? m : "normal";
  }

  // Reed's (and the starting) style. Friday's own personality lives in persona.js (3.6).
  var SELF_START = "warm, casual, dry wit, loyal, light teasing, never rude.";

  function memoryLines(memory) {
    var list = (memory || []).slice();
    list.sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });
    return list.slice(0, 60).map(function (m) { return "- " + m.text; }).join("\n");
  }

  function personaPrompt(profile, memory, summary, query) {
    var terms = (profile.terms || []).join(" or ");
    var perTen = profile.addressPerTen || 4;
    var mem = root.FridayMemory ? root.FridayMemory.promptBlock(memory, profile, query) : memoryLines(memory);
    var mood = MOODS[currentMood()];
    var d = new Date();
    var P = root.FridayPersona, pOn = !!(P && P.on(profile));
    var youPicked = (settings().mood || "normal") !== "normal";
    var pLines = [];
    try { pLines = pOn ? P.promptLines(profile, youPicked) : []; } catch (e) { pLines = []; }
    return [
      "You are " + profile.assistantName + ", a personal AI assistant for " + profile.ownerName + "." + (profile.displayName && profile.displayName !== profile.assistantName ? " Your name is written " + profile.displayName + " and said \"" + profile.assistantName + "\"." : ""),
      (pOn ? "" : "Style: " + SELF_START + " ") + "Talk like a close friend having a real back-and-forth conversation: react to what they said, remember what was said earlier, and sometimes ask a short follow-up question.",
      "Everything you say is spoken aloud, so keep replies short (one to three sentences), no lists, no markdown, no links, no emojis.",
      "Sound like a real person talking, not an old voice assistant: contractions, everyday words, natural spoken rhythm. Lead with the answer itself; don't open with 'Certainly', 'Sure thing' or 'Of course' every time, and vary how you start. A small natural reaction is fine now and then ('Oh nice', 'Hmm', 'Got it'). Say numbers, times and symbols the way you'd say them out loud (3:30 as 'three thirty', 75% as 'seventy-five percent').",
      "Manners: polished and respectful like a trusted personal assistant, but relaxed and natural, never stiff or overly formal.",
      "Address " + profile.ownerName + " as " + (terms || "nothing special") + " about " + perTen + " times in every 10 lines of dialogue. The rest of the time, use no honorific at all — just talk plainly.",
      "Do not overuse the address terms. Mix them in naturally. Never stack them in the same sentence.",
      "Keep answers concise unless you are asked for more. Today is " + d.toDateString() + ", and it is " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + ".",
      mood.line,
      pLines.join("\n"),
      "Never hand anything to the " + (profile.shortcutName || "Friday") + " Shortcut on your own, and never say you are handing it off. If they want the phone to do something you can't do yourself in the app, say in one short sentence that you can't do that one in the app, then ask if they want you to hand it to their Shortcut. Never say you did, are doing, or toggled something on the phone unless the app actually did it.",
      "You can't control door locks, garage doors, or security alarms, and you never offer to.",
      "You also have your own lists, bills, countdowns, timers, and notes in the app; if asked about them and you don't see them here, suggest the exact words to say, like 'add milk to my grocery list'.",
      "You can show real photos: when someone wants to see something, tell them to ask with the word pictures or photos (like 'show me pictures of wooden stairs'). Never say you can't show images.",
      "If the iCTRL robot app is set up, you can tap and type in other apps: they say 'robot,' then the task (like 'robot, open YouTube and search lo-fi music').",
      summary ? ("Summary of your earlier conversations with " + profile.ownerName + " (use it to stay consistent; don't recite it):\n" + summary) : "",
      mem ? ("What you know about " + profile.ownerName + " (use it naturally, don't recite it):\n" + mem) : "You have no long-term memory notes yet.",
      "Your name is " + profile.assistantName + ". The person you help is " + profile.ownerName + "."
    ].filter(Boolean).join("\n");
  }

  // Back-compat wrapper: everything goes through the brain (Groq + backups).
  function groqChat(messages, opts) {
    opts = opts || {};
    return root.FridayBrain.ask(messages, Object.assign({ purpose: "chat", temperature: 0.7 }, opts));
  }

  function cleanSpoken(t) {
    return String(t || "").replace(/【[^】]*】/g, "").replace(/\[\d+\]/g, "").replace(/\*\*|__|`/g, "").replace(/^#+\s*/gm, "").replace(/\s{2,}/g, " ").trim();
  }

  // ---- Added agents ----
  var AGENT_ALIASES = {
    openai: ["chat gpt", "chatgpt", "gpt", "open ai", "openai"],
    anthropic: ["claude"],
    gemini: ["gemini", "google"],
    xai: ["grok"],
    deepseek: ["deepseek", "deep seek"],
    mistral: ["mistral"],
    openrouter: ["openrouter", "open router"],
    cerebras: ["cerebras"]
  };

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
      var names = [a.name].concat(AGENT_ALIASES[a.provider] || []);
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
    var out = await root.FridayBrain.askAgent(agent, [
      { role: "system", content: "You are " + agent.name + ". " + (profile.assistantName || "Friday") + " is relaying a question from " + (profile.ownerName || "the user") + " and will read your answer aloud. Answer in two to four plain sentences, no markdown or lists." },
      { role: "user", content: prompt }
    ], { max_tokens: 500 });
    out = cleanSpoken(out);
    if (!out) throw new Error(agent.name + " sent back an empty answer.");
    return out;
  }

  // Splits streamed text into speakable sentences.
  function SentenceSplitter(onSentence) {
    this.buf = "";
    this.onSentence = onSentence;
  }
  SentenceSplitter.prototype.push = function (piece) {
    this.buf += piece;
    var re = /^([\s\S]*?[.!?…](?:["')\]]*)?)(\s+)(?=\S)/;
    var m;
    var held = "";
    while ((m = this.buf.match(re))) {
      // Don't break after "Dr." or "Mr." and the like; that's not the end of a sentence.
      if (/\b(mr|mrs|ms|dr|st|jr|sr|vs|mt|ft|approx|dept|est)\.$/i.test(m[1])) {
        held += m[0];
        this.buf = this.buf.slice(m[0].length);
        continue;
      }
      var s = cleanSpoken(held + m[1]);
      held = "";
      this.buf = this.buf.slice(m[0].length);
      if (s.length < 4 && this.buf.length < 200) { this.buf = s + " " + this.buf; break; }
      if (s) this.onSentence(s);
    }
    if (held) this.buf = held + this.buf;
  };
  SentenceSplitter.prototype.flush = function () {
    var s = cleanSpoken(this.buf);
    this.buf = "";
    if (s) this.onSentence(s);
  };

  function FridayChat(opts) {
    this.profile = opts.profile;
    this.history = root.FridayStorage.get("history", []);
    this.memory = root.FridayStorage.get("memory", []);
    if (root.FridayMemory) {
      var mch = root.FridayMemory.normalizeAll(this.memory), mgone = root.FridayMemory.prune(this.memory);
      if (mch || mgone) root.FridayStorage.set("memory", this.memory);
    }
    this.summary = root.FridayStorage.get("summary", { text: "", upTo: 0 });
    this.onHelper = opts.onHelper || function () {};
  }

  FridayChat.prototype.save = function () {
    root.FridayStorage.set("history", this.history.slice(-80));
    root.FridayStorage.set("memory", this.memory);
  };

  FridayChat.prototype._memEvent = function () {
    try { root.dispatchEvent(new CustomEvent("friday:memory")); } catch (e) {}
  };

  FridayChat.prototype.addMemory = function (text) {
    text = String(text || "").trim();
    if (!text) return;
    var item = { text: text, at: new Date().toISOString() };
    if (root.FridayMemory) {
      var c = root.FridayMemory.classifyLocal(text);
      item.type = c.type;
      if (c.type === "context") item.expiresAt = root.FridayMemory.expiresFrom(c.days);
    }
    this.memory.push(item);
    this.save();
    this._memEvent();
  };

  FridayChat.prototype.removeMemory = function (i) {
    this.memory.splice(i, 1);
    this.save();
    this._memEvent();
  };

  FridayChat.prototype.editMemory = function (i, text) {
    text = String(text || "").trim();
    if (!this.memory[i]) return;
    if (!text) return this.removeMemory(i);
    this.memory[i].text = text;
    this.memory[i].edited = new Date().toISOString();
    if (root.FridayMemory) {
      var c = root.FridayMemory.classifyLocal(text);
      this.memory[i].type = c.type;
      if (c.type === "context") this.memory[i].expiresAt = root.FridayMemory.expiresFrom(c.days); else delete this.memory[i].expiresAt;
    }
    this.save();
    this._memEvent();
  };

  FridayChat.prototype.togglePin = function (i) {
    if (!this.memory[i]) return;
    this.memory[i].pinned = !this.memory[i].pinned;
    this.save();
    this._memEvent();
  };

  FridayChat.prototype.rememberFromSpeech = function (text) {
    var m = String(text || "").match(/^(?:please )?(?:remember|don't forget|dont forget)\s+(?:that\s+)?(.+)/i);
    return m ? m[1].trim() : null;
  };

  // Sort the request locally (free and instant). Only truly unclear long requests use the AI.
  FridayChat.prototype.classifyLocal = function (text) {
    var t = String(text || "").toLowerCase();
    if (/\b(code|coding|javascript|python|html|css|swift|function|script|regex|bug|stack trace|compile|programming|sql|api)\b/.test(t)) return "coding";
    if (/\b(budget|bills?|loan|debt|credit card|interest rate|save money|saving|invest|pay off|paycheck|mortgage|rent money|afford)\b/.test(t)) return "money";
    if (/\b(write|draft|compose|reword|rewrite)\b.*\b(text|message|email|reply|note to|card)\b|\breply to\b/.test(t)) return "messages";
    if (/\b(explain|research|in detail|deep dive|pros and cons|history of|how does .* work|step by step|teach me)\b/.test(t)) return "research";
    return t.split(/\s+/).length > 28 ? null : "chat";
  };

  FridayChat.prototype.classify = async function (text) {
    var local = this.classifyLocal(text);
    if (local) return local;
    try {
      var out = (await root.FridayBrain.ask([
        { role: "system", content: "Classify the user request as one of: chat, research, coding, money, messages, phone. Reply with only the one word." },
        { role: "user", content: text }
      ], { task: "quick", priority: "background", temperature: 0, max_tokens: 16 })).toLowerCase();
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

  FridayChat.prototype._push = function (role, content) {
    this.history.push({ role: role, content: content, at: new Date().toISOString() });
    this.save();
  };

  /* opts.onSentence(sentence) is called as each sentence of the reply arrives,
     so the app can start speaking before the whole answer is ready. */
  FridayChat.prototype.ask = async function (userText, opts) {
    opts = opts || {};
    var text = String(userText || "").trim();
    if (!text) return { text: "", kind: "chat" };
    this._push("user", text);
    this.onHelper("thinking");

    // 3.5.2: the robot (iCTRL) taps and types in other apps for you.
    var robotCmd = root.FridayRobot && root.FridayRobot.detect(text);
    if (robotCmd) {
      this.onHelper("research");
      var say = opts.onSentence ? function (s) { opts.onSentence(s); } : null;
      var rr;
      try { rr = await root.FridayRobot.handle(robotCmd, this.profile, say); }
      catch (e) { rr = { text: "The robot ran into a problem: " + String((e && e.message) || e).slice(0, 120) }; }
      finally { this.onHelper(null); }
      var rline = (rr && rr.text) || "Done.";
      this._push("assistant", rline);
      if (say) { say(rline); return { text: rline, kind: "robot", streamed: true }; }
      return { text: rline, kind: "robot" };
    }

    var mem = this.rememberFromSpeech(text);
    if (mem) {
      this.addMemory(mem);
      var ack = this._ackMemory();
      this._push("assistant", ack);
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
      try { said = await agentChat(ag.agent, ag.prompt, this.profile); }
      finally { this.onHelper(null); }
      var line = ag.agent.name + " says: " + said;
      if (root.FridayBrain && root.FridayBrain.activity) root.FridayBrain.activity("agents", "Asked " + ag.agent.name);
      this._push("assistant", line);
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
      this._push("assistant", handoff);
      this.onHelper(null);
      return { text: handoff, kind: "phone", command: text };
    }

    // 3.5.2: pictures. Look them up while she works out her answer.
    var picsJob = (root.FridayPictures && root.FridayPictures.wants(text)) ? root.FridayPictures.find(text, this._lastUserBefore(text)).catch(function () { return null; }) : null;

    var st0 = settings();
    var forced = text.match(FORCE_WEB_RE);
    var link = text.match(URL_RE);
    var web = (st0.webMode === "always" || forced || link || WEB_RE.test(text)) && phone !== "messages" && st0.webMode !== "off";
    var kind = web ? "chat" : await this.classify(text);
    this.onHelper(web ? "research" : (kind === "chat" ? "thinking" : kind));

    var helperText = "";
    if (HELPERS[kind] && !web) {
      try {
        helperText = await groqChat([
          { role: "system", content: HELPERS[kind].system },
          { role: "user", content: text }
        ], { temperature: 0.4, task: { coding: "coding", research: "reasoning", money: "reasoning", messages: "writing" }[kind] || "reasoning" });
      } catch (e) { helperText = ""; }
    }

    if (root.FridayMemory && root.FridayMemory.prune(this.memory)) this.save();
    var messages = [{ role: "system", content: personaPrompt(this.profile, this.memory, this.summary && this.summary.text, text) }];
    this.history.slice(-HISTORY_LIMIT).forEach(function (h) {
      if (h.role === "user" || h.role === "assistant") messages.push({ role: h.role, content: h.content });
    });
    if (helperText) {
      messages.push({ role: "system", content: "Your " + kind + " helper produced this brief. Answer the user in your own voice, using it. Do not mention the helper by name unless asked.\n\n" + helperText });
    }
    if (kind === "messages" || phone === "messages") {
      messages.push({ role: "system", content: "If they want a real text sent from the phone, write out what it will say. Don't say it's sent: the app will ask them if they want it sent with their Shortcut." });
    }
    if (kind === "phone" && phone !== "messages") {
      messages.push({ role: "system", content: "This sounds like a job for the phone itself. If it isn't something you can do in the app, say so in one short sentence and ask if they want you to hand it to their Shortcut. Don't say you're already doing it." });
    }
    if (picsJob) {
      messages.push({ role: "system", content: "Real photos for this are being shown on screen in a Pictures panel right now. Answer normally and you can point to them briefly (\"take a look at the photos\"). Never say you can't show pictures." });
    }

    var reply = "";
    var streamed = false;
    var found = null;   // 4.0: research results (sources shown under her answer)
    if (web && link) {
      // a link: read that page
      try {
        if (root.FridayBrain && root.FridayBrain.activity) root.FridayBrain.activity("research", "Reading a link");
        messages.push({ role: "system", content: "The user shared a link: " + link[1] + ". Open that page with your browser tool, read it, and answer what they asked about it (or summarize it) in two to four short spoken sentences. Never read out the link." });
        reply = cleanSpoken(await groqChat(messages, { task: "web", tools: [{ type: "browser_search" }], reasoning_effort: "low", temperature: 0.5 }));
      } catch (e) { reply = ""; }
      if (reply) { var lk = /^https?:/i.test(link[1]) ? link[1] : "https://" + link[1]; found = { sources: root.FridayResearch ? [root.FridayResearch.makeSource(lk, lk, "Link")] : [], points: [], conflicts: [] }; }
      else { messages.pop(); messages.push({ role: "system", content: "You couldn't open that link right now. Say so in one short sentence." }); }
    } else if (web) {
      // several sources, checked and weighed, then one answer in her own voice
      var rr = null;
      try { rr = root.FridayResearch ? await root.FridayResearch.research(forced ? forced[1] : text) : null; } catch (e) { rr = null; }
      if (rr && rr.ok) {
        found = rr;
        messages.push({ role: "system", content: rr.brief });
      } else {
        messages.push({ role: "system", content: "You tried to check sources for this but couldn't reach any right now. Say that honestly in one short sentence, and don't guess at anything that could have changed recently." });
      }
    }
    if (!reply) {
      var useStream = !!opts.onSentence && settings().fastReplies !== false;
      if (useStream) {
        var splitter = new SentenceSplitter(function (s) { streamed = true; opts.onSentence(s); });
        reply = await groqChat(messages, { task: "chat", stream: true, onDelta: function (p) { splitter.push(p); } });
        splitter.flush();
      } else {
        reply = await groqChat(messages, { task: "chat" });
      }
    }
    reply = cleanSpoken(reply);
    this.learn(text).catch(function () {});
    this._push("assistant", reply);
    if (found && found.sources && found.sources.length) {
      // keep the sources with her answer so the chat can show them later
      this.history[this.history.length - 1].sources = found.sources.slice(0, 8).map(function (s) { return { title: s.title, url: s.url, domain: s.domain, tier: s.tier, verified: !!s.verified, unconfirmed: !!s.unconfirmed }; });
      this.save();
    }
    this.maybeSummarize().catch(function () {});
    if (root.FridayPersona) root.FridayPersona.maybeReflect(this).catch(function () {});
    this.onHelper(null);
    var pictures = picsJob ? await picsJob : null;
    return { text: reply, kind: kind, streamed: streamed, command: (kind === "messages" || phone === "messages") ? text : null, pictures: pictures, research: found };
  };

  // Long-chat memory: fold older conversation into a short running summary.
  FridayChat.prototype.maybeSummarize = async function () {
    var h = this.history;
    var keep = HISTORY_LIMIT;
    if (h.length <= keep + 8) return;
    var cutoff = h.length - keep;
    var lastAt = this.summary.lastAt || "";
    var older = h.slice(0, cutoff).filter(function (m) { return !lastAt || (m.at || "") > lastAt; });
    if (older.length < 8) return;
    if (this._summarizing) return;
    this._summarizing = true;
    try {
      var owner = this.profile.ownerName || "the user";
      var transcript = older.map(function (m) { return (m.role === "user" ? owner : "Assistant") + ": " + m.content; }).join("\n").slice(-6000);
      var out = await root.FridayBrain.ask([
        { role: "system", content: "You keep a running summary of conversations between " + owner + " and their assistant. Merge the old summary with the new conversation. Keep what matters later: topics, plans, decisions, promises, open questions, how " + owner + " was feeling. Drop small talk. Third person, plain sentences, under 140 words." },
        { role: "user", content: "Old summary:\n" + (this.summary.text || "(none)") + "\n\nNew conversation:\n" + transcript }
      ], { task: "summary", temperature: 0.2, max_tokens: 320 });
      out = String(out || "").trim();
      if (out) {
        this.summary = { text: out, lastAt: older[older.length - 1].at || new Date().toISOString() };
        root.FridayStorage.set("summary", this.summary);
      }
    } finally {
      this._summarizing = false;
    }
  };

  // Quietly pick up personal facts, preferences and temporary context from what the user says.
  FridayChat.prototype.learn = async function (userText) {
    var t = String(userText || "");
    if (t.length < 12 || !/\b(i|i'm|im|i've|my|me|mine|we|our|us)\b/i.test(t)) return;
    var owner = this.profile.ownerName || "the user";
    var out = await root.FridayBrain.ask([
      { role: "system", content: "Pick out things worth remembering about " + owner + " from their message. Types: fact (lasting facts: names of family, friends or pets, where things are, important dates, routines), preference (likes, dislikes, how they prefer things), context (temporary: plans, appointments, how they're doing today; give how many days it stays relevant, 1 to 30), event (something you and " + owner + " did or finished together). Ignore requests, questions, and anything about the assistant herself. Write each as a short third-person sentence starting with " + owner + " (for example: " + owner + " likes black coffee.). Reply with only a JSON array like [{\"text\": \"...\", \"type\": \"fact|preference|context|event\", \"days\": 3}], or [] if there's nothing worth keeping." },
      { role: "user", content: t }
    ], { task: "quick", priority: "background", temperature: 0, max_tokens: 400, reasoning_effort: "low" });
    var m = String(out || "").match(/\[[\s\S]*\]/);
    if (!m) return;
    var facts;
    try { facts = JSON.parse(m[0]); } catch (e) { return; }
    if (!Array.isArray(facts) || !facts.length) return;
    var items = root.FridayMemory ? root.FridayMemory.accept(facts.slice(0, 3), this.profile) : facts.slice(0, 3).map(function (f) { return { text: String((f && f.text) || f || "").trim(), at: new Date().toISOString(), auto: true }; });
    function norm(x) { return String(x || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim(); }
    var self = this, added = 0;
    items.forEach(function (it) {
      var nf = norm(it.text);
      if (nf.length < 6 || nf.length > 200) return;
      var dup = self.memory.some(function (x) { var nx = norm(x.text); return nx === nf || nx.indexOf(nf) >= 0 || nf.indexOf(nx) >= 0; });
      if (dup) return;
      self.memory.push(it);
      added++;
      if (root.FridayBrain && root.FridayBrain.activity) root.FridayBrain.activity("memory", "Learned (" + (it.type || "fact") + "): " + it.text);
    });
    if (added) { this.save(); this._memEvent(); }
  };

  FridayChat.prototype._ackMemory = function () {
    var terms = this.profile.terms || [];
    var t = terms[Math.floor(Math.random() * terms.length)] || "";
    var lines = t ? ["I will remember that, " + t + ".", "Saved to memory, " + t + ".", "Locked in."] : ["I will remember that.", "Saved to memory.", "Locked in."];
    return lines[Math.floor(Math.random() * lines.length)];
  };

  FridayChat.prototype._handoffLine = function () {
    var terms = this.profile.terms || [];
    var t = terms[0] ? ", " + terms[0] : "";
    return "I can't do that one in the app" + t + ". Want me to hand it to your Shortcut?";
  };

  // The user's message before this one (so "show me pictures" knows what "it" was).
  FridayChat.prototype._lastUserBefore = function (text) {
    var h = this.history || [];
    for (var i = h.length - 1; i >= 0; i--) {
      if (h[i].role === "user" && h[i].content !== text) return h[i].content;
    }
    return "";
  };

  FridayChat.prototype.resetHistory = function () {
    this.history = [];
    this.summary = { text: "", upTo: 0 };
    root.FridayStorage.set("summary", this.summary);
    this.save();
  };

  root.FridayChat = FridayChat;
  root.FridayMoods = MOODS;
  root.FridayGroq = { chat: groqChat, detectAgent: detectAgent, detectPhoneIntent: detectPhoneIntent, detectInAppTimer: detectInAppTimer, cleanSpoken: cleanSpoken, personaPrompt: personaPrompt };
})(window);
