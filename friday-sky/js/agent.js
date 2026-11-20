/* Multi-step tasks, saved routines, and habit learning.
   Everything here stays on the phone (localStorage). The only network call
   is the Groq planner, used when Friday can't work out the steps herself.

   Safety rules built in:
   - Friday can only use the actions in ACTIONS. Anything else is refused.
     Texting, money, and opening other apps are deliberately NOT on the list.
   - At most MAX_STEPS steps per request; numbers are clamped.
   - She says the plan out loud before anything runs, and phone steps still
     need your tap on "Run in Shortcuts" (iOS requires it anyway).
   - Habits she notices are only ever suggested as a question. She never acts
     on a habit by herself.
   - You can ask "what do you know about me", "forget ...", or turn learning
     off in Settings. */
(function (root) {
  "use strict";

  var MAX_STEPS = 6;
  var MAX_ROUTINES = 20;
  var MAX_HABITS = 400;
  var HABIT_DAYS = 14;
  var HABIT_MIN_DAYS = 3;
  var HABIT_WINDOW_MIN = 45;
  var PENDING_MS = 2 * 60 * 1000;

  function clean(s, max) {
    return String(s == null ? "" : s).replace(/[;\n\r]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max || 200);
  }

  function clamp(n, lo, hi) {
    n = parseInt(n, 10);
    if (isNaN(n)) return null;
    return Math.max(lo, Math.min(hi, n));
  }

  /* The whitelist. phone: text handed to the shortcut. app: done inside Friday. */
  var ACTIONS = {
    lights_percent: {
      label: function (s) { return "lights to " + s.value + "%"; },
      phone: function (s) { return "lights to " + s.value + " percent"; },
      fix: function (s) { var v = clamp(s.value, 0, 100); return v == null ? null : { action: s.action, value: v }; },
      habit: true
    },
    lights_on: { label: function () { return "lights on"; }, phone: function () { return "lights on"; }, habit: true },
    lights_off: { label: function () { return "lights off"; }, phone: function () { return "lights off"; }, habit: true },
    tv_on: { label: function () { return "TV on"; }, phone: function () { return "tv on"; }, habit: true },
    tv_off: { label: function () { return "TV off"; }, phone: function () { return "tv off"; }, habit: true },
    dnd_on: { label: function () { return "Do Not Disturb on"; }, phone: function () { return "do not disturb on"; }, habit: true },
    dnd_off: { label: function () { return "Do Not Disturb off"; }, phone: function () { return "do not disturb off"; }, habit: true },
    music: { label: function () { return "play your music"; }, phone: function () { return "music"; }, habit: true },
    cameras: { label: function () { return "open the cameras"; }, phone: function () { return "cameras"; } },
    good_night: { label: function () { return "good night (lights and TV off)"; }, phone: function () { return "good night"; }, habit: true },
    alarm: {
      label: function (s) { return "an alarm " + s.text; },
      phone: function (s) { return "set an alarm " + s.text; },
      fix: function (s) { var t = clean(s.text, 60); return t ? { action: s.action, text: t } : null; }
    },
    remind: {
      label: function (s) { return "a reminder to " + s.text; },
      phone: function (s) { return "remind me to " + s.text; },
      fix: function (s) { var t = clean(s.text, 160); return t ? { action: s.action, text: t } : null; }
    },
    weather: { label: function () { return "the weather"; }, app: true, habit: true },
    timer: {
      label: function (s) { return s.seconds < 60 ? ("a " + s.seconds + "-second timer") : ("a " + Math.round(s.seconds / 60) + "-minute timer"); },
      app: true,
      fix: function (s) { var v = clamp(s.seconds, 1, 24 * 3600); return v == null ? null : { action: s.action, seconds: v }; }
    },
    note: {
      label: function (s) { return "a note: " + s.text; },
      app: true,
      fix: function (s) { var t = clean(s.text, 300); return t ? { action: s.action, text: t } : null; }
    },
    remember: {
      label: function (s) { return "remember: " + s.text; },
      app: true,
      fix: function (s) { var t = clean(s.text, 300); return t ? { action: s.action, text: t } : null; }
    },
    say: {
      label: function (s) { return "say: " + s.text; },
      app: true,
      fix: function (s) { var t = clean(s.text, 300); return t ? { action: s.action, text: t } : null; }
    }
  };

  /* Turn raw steps into safe ones. Unknown actions are dropped and reported. */
  function sanitizeSteps(steps) {
    var out = [], refused = [];
    (Array.isArray(steps) ? steps : []).forEach(function (s) {
      if (!s || typeof s !== "object") return;
      var a = ACTIONS[s.action];
      if (!a) {
        refused.push(clean(s.what || s.action || "something", 60));
        return;
      }
      var fixed = a.fix ? a.fix(s) : { action: s.action };
      if (fixed) out.push(fixed);
    });
    var trimmed = out.length > MAX_STEPS;
    return { steps: out.slice(0, MAX_STEPS), refused: refused, trimmed: trimmed };
  }

  function stepLabel(s) { return ACTIONS[s.action].label(s); }
  function stepKey(s) {
    return s.action + (s.value != null ? ":" + s.value : "");
  }

  function listPhrase(items) {
    if (items.length <= 1) return items.join("");
    return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }

  /* ---------- Local parser (free, no internet) ---------- */

  function parseStep(seg) {
    var t = String(seg || "").toLowerCase().trim().replace(/[.!?]+$/, "");
    if (!t) return null;
    var m;
    if ((m = t.match(/^(?:please\s+)?remind me to\s+(.+)/))) return { action: "remind", text: m[1] };
    if ((m = t.match(/^(?:please\s+)?(?:take|make|add|write)?\s*(?:a\s+)?note(?: that|:)?\s+(.+)/))) return { action: "note", text: m[1] };
    if ((m = t.match(/(\d{1,3})\s*(?:%|percent)/)) && (/light|dim|bright/.test(t) || !/\b(tv|volume|battery)\b/.test(t))) {
      return { action: "lights_percent", value: m[1] };
    }
    if (/\bgood ?night\b/.test(t)) return { action: "good_night" };
    var timer = root.FridayGroq && root.FridayGroq.detectInAppTimer(t);
    if (timer) return { action: "timer", seconds: timer };
    if (/\balarm\b|\bwake me\b/.test(t)) {
      m = t.match(/\b((?:for|at)\s+.+)$/);
      return m ? { action: "alarm", text: m[1] } : null;
    }
    var on = /\b(on|start|up)\b/.test(t) && !/\boff\b/.test(t);
    var off = /\b(off|out|kill|shut)\b/.test(t);
    if (/\blights?\b/.test(t)) {
      if (off) return { action: "lights_off" };
      if (on) return { action: "lights_on" };
      return null;
    }
    if (/\b(tv|television)\b/.test(t)) {
      if (off) return { action: "tv_off" };
      if (on) return { action: "tv_on" };
      return null;
    }
    if (/\b(do not disturb|don't disturb|dnd)\b/.test(t)) {
      if (off) return { action: "dnd_off" };
      if (on) return { action: "dnd_on" };
      return null;
    }
    if (/\b(play|put on)\b.*\bmusic\b|^music$|^play (my )?music/.test(t)) return { action: "music" };
    if (/\bcameras?\b/.test(t)) return { action: "cameras" };
    if (/\bweather\b/.test(t)) return { action: "weather" };
    return null;
  }

  function splitRequest(text) {
    return String(text || "")
      .split(/\s*(?:,\s*(?:and\s+)?(?:then\s+)?|\band then\b|\bthen\b|\band also\b|\balso\b|\band\b|;)\s*/i)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  /* Returns steps if every part of the request is understood locally. */
  function parseLocal(text) {
    var parts = splitRequest(text);
    if (!parts.length) return null;
    var steps = [];
    for (var i = 0; i < parts.length; i++) {
      var s = parseStep(parts[i]);
      if (!s) return null;
      steps.push(s);
    }
    return steps;
  }

  /* Looks like more than one job in one sentence? */
  function looksMulti(text) {
    // A text message, reminder, or note can contain "and" — keep those whole.
    if (/^(?:please\s+)?(?:text|message|send|tell|remind me|note|take a note|remember|don't forget)\b/i.test(String(text || "").trim())) return false;
    var parts = splitRequest(text);
    if (parts.length < 2) return false;
    var hits = 0;
    parts.forEach(function (p) {
      var intent = root.FridayGroq && root.FridayGroq.detectPhoneIntent(p);
      if (parseStep(p) || (intent && intent !== "messages")) hits++;
    });
    return hits >= 2;
  }

  /* ---------- Planner (Groq) ---------- */

  var PLANNER_SYSTEM = [
    "You turn a spoken request into a short list of steps for a phone assistant.",
    "Reply with JSON only, in this shape: {\"steps\":[...],\"note\":\"\"}.",
    "Allowed steps (use only these, exactly as written):",
    "{\"action\":\"lights_percent\",\"value\":0-100}",
    "{\"action\":\"lights_on\"} {\"action\":\"lights_off\"}",
    "{\"action\":\"tv_on\"} {\"action\":\"tv_off\"}",
    "{\"action\":\"dnd_on\"} {\"action\":\"dnd_off\"}",
    "{\"action\":\"music\"} {\"action\":\"cameras\"} {\"action\":\"weather\"} {\"action\":\"good_night\"}",
    "{\"action\":\"alarm\",\"text\":\"for 7 am\"}",
    "{\"action\":\"remind\",\"text\":\"what to be reminded of\"}",
    "{\"action\":\"timer\",\"seconds\":number}",
    "{\"action\":\"note\",\"text\":\"...\"} {\"action\":\"remember\",\"text\":\"...\"} {\"action\":\"say\",\"text\":\"...\"}",
    "If part of the request needs something not on this list (for example sending a text, paying or moving money, buying, opening another app, calling someone, deleting things), do NOT invent an action. Add {\"action\":\"unsupported\",\"what\":\"short description\"} instead.",
    "Use the person's saved preferences when they fit (for example their usual light level). Never more than " + MAX_STEPS + " steps.",
    "If the request is just conversation and needs no steps, reply {\"steps\":[]}."
  ].join("\n");

  function extractJson(text) {
    var s = String(text || "");
    var a = s.indexOf("{"), b = s.lastIndexOf("}");
    if (a < 0 || b <= a) return null;
    try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
  }

  async function planWithGroq(text, memory) {
    var prefs = (memory || []).slice(-30).map(function (m) { return "- " + m.text; }).join("\n");
    var messages = [
      { role: "system", content: PLANNER_SYSTEM + (prefs ? "\n\nSaved preferences:\n" + prefs : "") },
      { role: "user", content: String(text) }
    ];
    var out = await root.FridayGroq.chat(messages, { temperature: 0, max_tokens: 600 });
    var data = extractJson(out);
    if (!data || !Array.isArray(data.steps)) throw new Error("I couldn't work out the steps for that.");
    return data.steps;
  }

  /* ---------- Agent ---------- */

  function FridayAgent(opts) {
    this.profile = opts.profile;
    this.chat = opts.chat;
    this.tools = opts.tools;
    this.weather = opts.weather || function () { return Promise.resolve(""); };
    this.settings = opts.settings || function () { return {}; };
    this.pending = null;
  }

  FridayAgent.prototype.term = function () {
    var t = (this.profile.terms || [])[0];
    return t ? ", " + t : "";
  };

  FridayAgent.prototype.learning = function () {
    return this.settings().learnHabits !== false;
  };

  /* Storage */
  FridayAgent.prototype.routines = function () { return root.FridayStorage.get("routines", []); };
  FridayAgent.prototype.saveRoutines = function (list) { root.FridayStorage.set("routines", list.slice(0, MAX_ROUTINES)); };
  FridayAgent.prototype.habits = function () { return root.FridayStorage.get("habits", []); };
  FridayAgent.prototype.habitPrefs = function () { return root.FridayStorage.get("habitPrefs", {}); };

  /* ---------- Habit learning ---------- */

  FridayAgent.prototype.logSteps = function (steps, when) {
    if (!this.learning()) return;
    var list = this.habits();
    var now = when || new Date();
    steps.forEach(function (s) {
      if (!ACTIONS[s.action] || !ACTIONS[s.action].habit) return;
      list.push({ k: stepKey(s), step: s, t: now.toISOString() });
    });
    var cutoff = now.getTime() - 30 * 86400000;
    list = list.filter(function (h) { return new Date(h.t).getTime() >= cutoff; }).slice(-MAX_HABITS);
    root.FridayStorage.set("habits", list);
  };

  /* Called for single commands that went straight to the shortcut. */
  FridayAgent.prototype.logCommand = function (text) {
    var s = parseStep(text);
    if (!s) return;
    var fixed = sanitizeSteps([s]).steps;
    if (fixed.length) this.logSteps(fixed);
  };

  function dayKey(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function minutesOfDay(d) { return d.getHours() * 60 + d.getMinutes(); }
  function minuteGap(a, b) { var g = Math.abs(a - b); return Math.min(g, 1440 - g); }
  function clockText(min) {
    var h = Math.floor(min / 60) % 24, m = min % 60;
    var ap = h >= 12 ? "PM" : "AM";
    var hr = h % 12 || 12;
    return hr + ":" + (m < 10 ? "0" + m : m) + " " + ap;
  }

  /* Patterns: things done on HABIT_MIN_DAYS+ different days near the same time. */
  FridayAgent.prototype.patterns = function (now) {
    now = now || new Date();
    var cutoff = now.getTime() - HABIT_DAYS * 86400000;
    var groups = {};
    this.habits().forEach(function (h) {
      var d = new Date(h.t);
      if (d.getTime() < cutoff) return;
      (groups[h.k] = groups[h.k] || { k: h.k, step: h.step, items: [] }).items.push(d);
    });
    var out = [];
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      // Cluster by time of day: for each entry, gather others within the window.
      var best = null;
      g.items.forEach(function (d) {
        var m0 = minutesOfDay(d);
        var near = g.items.filter(function (x) { return minuteGap(minutesOfDay(x), m0) <= HABIT_WINDOW_MIN; });
        var days = {};
        near.forEach(function (x) { days[dayKey(x)] = 1; });
        var n = Object.keys(days).length;
        if (!best || n > best.days) {
          var mins = near.map(minutesOfDay).sort(function (a, b) { return a - b; });
          best = { days: n, minute: mins[Math.floor(mins.length / 2)], dates: days };
        }
      });
      if (best && best.days >= HABIT_MIN_DAYS) {
        out.push({ k: k, step: g.step, days: best.days, minute: best.minute, dates: best.dates });
      }
    });
    out.sort(function (a, b) { return b.days - a.days; });
    return out;
  };

  FridayAgent.prototype.suggestion = function (now) {
    if (!this.learning()) return null;
    now = now || new Date();
    var prefs = this.habitPrefs();
    var today = dayKey(now);
    var nowMin = minutesOfDay(now);
    var lastAsk = root.FridayStorage.get("habitLastAsk", 0);
    if (now.getTime() - lastAsk < 3 * 3600000) return null;
    var list = this.patterns(now).filter(function (p) {
      var pref = prefs[p.k];
      if (pref && (pref.never || pref.skip === today)) return false;
      if (p.dates[today]) return false; // already done today
      return minuteGap(p.minute, nowMin) <= HABIT_WINDOW_MIN;
    });
    return list[0] || null;
  };

  /* Returns a line to speak, or "" if nothing to suggest. Sets a pending question. */
  FridayAgent.prototype.offerSuggestion = function (now) {
    var p = this.suggestion(now);
    if (!p) return "";
    root.FridayStorage.set("habitLastAsk", (now || new Date()).getTime());
    this.pending = { type: "suggest", pattern: p, at: Date.now() };
    return "It's about that time" + this.term() + ". Want " + stepLabel(p.step) + " like usual?";
  };

  FridayAgent.prototype.forgetPattern = function (k) {
    var list = this.habits().filter(function (h) { return h.k !== k; });
    root.FridayStorage.set("habits", list);
    var prefs = this.habitPrefs();
    prefs[k] = { never: true };
    root.FridayStorage.set("habitPrefs", prefs);
  };

  FridayAgent.prototype.clearHabits = function () {
    root.FridayStorage.set("habits", []);
    root.FridayStorage.set("habitPrefs", {});
  };

  FridayAgent.prototype.patternLines = function () {
    return this.patterns().map(function (p) {
      return { k: p.k, text: stepLabel(p.step) + " · usually around " + clockText(p.minute) + " · seen on " + p.days + " days" };
    });
  };

  /* ---------- Running steps ---------- */

  /* Runs in-app steps now and returns { say, phone } for the app to finish. */
  FridayAgent.prototype.execute = async function (steps, intro) {
    var self = this;
    var phone = [];
    var extra = [];
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      var a = ACTIONS[s.action];
      if (a.phone) { phone.push(a.phone(s)); continue; }
      if (s.action === "timer" && self.tools) self.tools.startTimer(s.seconds);
      else if (s.action === "note" && self.tools) self.tools.addNote(s.text);
      else if (s.action === "remember" && self.chat) self.chat.addMemory(s.text);
      else if (s.action === "say") extra.push(s.text);
      else if (s.action === "weather") {
        try { extra.push(await self.weather()); } catch (e) {}
      }
    }
    this.logSteps(steps);
    var say = intro || ("On it" + this.term() + ": " + listPhrase(steps.map(stepLabel)) + ".");
    if (extra.length) say += " " + extra.join(" ");
    if (phone.length) say += phone.length > 1 ? " Tap Run and your shortcut will do the home steps in order." : " Tap Run to finish.";
    return { say: say, phone: phone.length ? phone.join(" ; ") : null, steps: steps };
  };

  FridayAgent.prototype.refusalLine = function (refused) {
    if (!refused.length) return "";
    return " I left out " + listPhrase(refused) + " — I'm not allowed to do that on my own, so that part's yours.";
  };

  /* Plan (locally if possible, otherwise with Groq), then run. */
  FridayAgent.prototype.runTask = async function (text) {
    var raw = parseLocal(text);
    if (!raw) raw = await planWithGroq(text, this.chat && this.chat.memory);
    var safe = sanitizeSteps(raw);
    if (!safe.steps.length) {
      if (safe.refused.length) return { say: "That's outside what I'm allowed to do" + this.term() + "." + this.refusalLine(safe.refused) };
      return null; // nothing to do — let normal chat answer
    }
    var res = await this.execute(safe.steps);
    res.say += this.refusalLine(safe.refused);
    if (safe.trimmed) res.say += " I stopped at " + MAX_STEPS + " steps to be safe.";
    return res;
  };

  /* ---------- Routines ---------- */

  function norm(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9%' ]+/g, " ").replace(/\s+/g, " ").trim();
  }

  FridayAgent.prototype.findRoutine = function (text) {
    var t = norm(text).replace(/^(hey |ok |okay )?(friday|jarvis)\s*/, "").replace(/^(it's|its|it is|time for|start|run|do)\s+/, "");
    var list = this.routines();
    for (var i = 0; i < list.length; i++) {
      var n = norm(list[i].name);
      if (!n) continue;
      if (t === n || (t.indexOf(n) === 0 && t.length <= n.length + 12)) return list[i];
    }
    return null;
  };

  FridayAgent.prototype.defineRoutine = async function (name, what) {
    name = clean(name, 40).replace(/^["'“]|["'”]$/g, "");
    if (!name) return { say: "What should I call that routine?" };
    var raw = parseLocal(what);
    if (!raw) raw = await planWithGroq(what, this.chat && this.chat.memory);
    var safe = sanitizeSteps(raw);
    if (!safe.steps.length) {
      if (!safe.refused.length) return null; // probably just conversation ("if I say something wrong…")
      return { say: "I couldn't turn that into steps I'm allowed to do." + this.refusalLine(safe.refused) };
    }
    var list = this.routines().filter(function (r) { return norm(r.name) !== norm(name); });
    if (list.length >= MAX_ROUTINES) return { say: "You already have " + MAX_ROUTINES + " routines. Delete one first." };
    list.push({ name: name, steps: safe.steps, at: new Date().toISOString() });
    this.saveRoutines(list);
    var say = "Saved. When you say \"" + name + "\", I'll do " + listPhrase(safe.steps.map(stepLabel)) + ".";
    say += this.refusalLine(safe.refused);
    if (safe.trimmed) say += " I kept the first " + MAX_STEPS + " steps.";
    return { say: say, panel: "memory" };
  };

  FridayAgent.prototype.deleteRoutine = function (name) {
    var n = norm(name);
    var list = this.routines();
    var keep = list.filter(function (r) { return norm(r.name) !== n; });
    if (keep.length === list.length) return false;
    this.saveRoutines(keep);
    return true;
  };

  FridayAgent.prototype.routineLines = function () {
    return this.routines().map(function (r) {
      return { text: "\"" + r.name + "\" → " + listPhrase(r.steps.map(stepLabel)), at: r.at };
    });
  };

  /* ---------- Memory: what do you know / forget ---------- */

  function words(s) {
    return norm(s).split(" ").map(function (w) { return w.replace(/'s$/, "").replace(/'/g, ""); })
      .filter(function (w) { return w.length > 2 && ["the", "that", "about", "and", "you", "my", "im"].indexOf(w) < 0; });
  }

  FridayAgent.prototype.forget = function (what) {
    var mem = (this.chat && this.chat.memory) || [];
    var want = words(what);
    if (!want.length) return null;
    var bestI = -1, bestScore = 0;
    mem.forEach(function (m, i) {
      var have = words(m.text);
      var hit = want.filter(function (w) {
        return have.some(function (h) { return h === w || h.indexOf(w) === 0 || w.indexOf(h) === 0; });
      }).length;
      var score = hit / want.length;
      if (score > bestScore) { bestScore = score; bestI = i; }
    });
    if (bestI < 0 || bestScore < 0.5) return null;
    var removed = mem[bestI].text;
    this.chat.removeMemory(bestI);
    return removed;
  };

  FridayAgent.prototype.whatDoYouKnow = function () {
    var mem = (this.chat && this.chat.memory) || [];
    var parts = [];
    if (mem.length) {
      var some = mem.slice(-4).map(function (m) { return m.text; });
      parts.push("You've told me " + mem.length + (mem.length === 1 ? " thing" : " things") + ", like: " + listPhrase(some) + ".");
    } else {
      parts.push("You haven't asked me to remember anything yet.");
    }
    var r = this.routines();
    if (r.length) parts.push("Your routines: " + listPhrase(r.map(function (x) { return "\"" + x.name + "\""; })) + ".");
    if (this.learning()) {
      var p = this.patterns().slice(0, 3);
      if (p.length) parts.push("I've noticed you usually " + listPhrase(p.map(function (x) { return stepLabel(x.step) + " around " + clockText(x.minute); })) + ".");
    } else {
      parts.push("Habit learning is off.");
    }
    parts.push("It's all in Memory, and you can delete anything there.");
    return parts.join(" ");
  };

  FridayAgent.prototype.wipe = function () {
    if (this.chat) {
      this.chat.memory = [];
      this.chat.save();
    }
    this.saveRoutines([]);
    this.clearHabits();
  };

  /* ---------- Entry point ---------- */

  var YES = /^(yes|yeah|yep|yup|sure|ok|okay|do it|go ahead|please|sounds good|absolutely|y)\b/i;
  var NEVER = /\b(stop asking|don't ask|dont ask|never|stop suggesting|don't suggest)\b/i;
  var NO = /^(no|nope|nah|not now|not tonight|don't|dont|cancel|skip|never mind|nevermind)\b/i;

  /* Returns null when the text isn't for the agent, else { say, phone?, panel? }. */
  FridayAgent.prototype.handle = async function (text) {
    var t = String(text || "").trim();
    if (!t) return null;
    var m;

    // A yes/no answer to something Friday just asked.
    var p = this.pending;
    if (p && Date.now() - p.at < PENDING_MS) {
      if (p.type === "suggest") {
        if (NEVER.test(t)) {
          this.pending = null;
          var prefs = this.habitPrefs();
          prefs[p.pattern.k] = { never: true };
          root.FridayStorage.set("habitPrefs", prefs);
          return { say: "Understood. I won't suggest that again." };
        }
        if (YES.test(t)) {
          this.pending = null;
          return this.execute([p.pattern.step]);
        }
        if (NO.test(t)) {
          this.pending = null;
          var prefs2 = this.habitPrefs();
          prefs2[p.pattern.k] = { skip: dayKey(new Date()) };
          root.FridayStorage.set("habitPrefs", prefs2);
          return { say: "No problem. I'll leave it for tonight." };
        }
      } else if (p.type === "wipe") {
        this.pending = null;
        if (YES.test(t)) {
          this.wipe();
          return { say: "Done. I've cleared your memory, routines, and habits.", panel: "memory" };
        }
        return { say: "Okay, I kept everything." };
      }
    }
    this.pending = null;

    if (/^(?:what do you (?:know|remember) about me|what do you remember|what have you learned(?: about me)?)\??$/i.test(t)) {
      return { say: this.whatDoYouKnow(), panel: "memory" };
    }
    if (/^(?:please )?forget everything(?: about me)?\.?$/i.test(t)) {
      this.pending = { type: "wipe", at: Date.now() };
      return { say: "Are you sure" + this.term() + "? That clears everything you've told me, your routines, and the habits I've noticed. Say yes to confirm." };
    }
    if (/^(?:what|which|list)(?: are)? (?:my )?routines|^what routines do i have/i.test(t)) {
      var r = this.routines();
      if (!r.length) return { say: "You don't have any routines yet. Try: when I say movie night, dim the lights to 20 percent and turn on the TV." };
      return { say: "You have " + listPhrase(r.map(function (x) { return "\"" + x.name + "\""; })) + ".", panel: "memory" };
    }
    if ((m = t.match(/^(?:please )?(?:delete|remove|forget) (?:the |my )?["“]?(.+?)["”]? routine\.?$/i))) {
      return { say: this.deleteRoutine(m[1]) ? "Deleted the " + m[1] + " routine." : "I don't have a routine called " + m[1] + "." };
    }
    if ((m = t.match(/^(?:please )?forget (?:that |about )?(.+?)\.?$/i)) && !/^(it|that|this)$/i.test(m[1])) {
      var gone = this.forget(m[1]);
      return { say: gone ? "Forgotten: " + gone + "." : "I don't have anything like that saved. You can check the Memory panel." };
    }
    if ((m = t.match(/^(?:from now on,?\s*)?(?:when(?:ever)?|if) i say\s+["“]?([^,"”:]+?)["”]?\s*(?:,|:|\bthen\b|\byou should\b|\bplease\b|\bdo\b)\s*(.+)$/i))) {
      return this.defineRoutine(m[1], m[2]);
    }

    var routine = this.findRoutine(t);
    if (routine) {
      var safe = sanitizeSteps(routine.steps).steps;
      return this.execute(safe, "Running " + routine.name + this.term() + ": " + listPhrase(safe.map(stepLabel)) + ".");
    }

    if (looksMulti(t)) return this.runTask(t);
    return null;
  };

  root.FridayAgent = FridayAgent;
  root.FridayAgentTest = {
    parseStep: parseStep, parseLocal: parseLocal, splitRequest: splitRequest, looksMulti: looksMulti,
    sanitizeSteps: sanitizeSteps, extractJson: extractJson, ACTIONS: ACTIONS
  };
})(window);
