/* Neural map v2: a live 3D map of her mind.
   - Nodes for every part of her (thinking, memory, voice, vision, helpers, lists, bills,
     timers, countdowns, notes, weather, Shortcut, AI connections) on slowly turning shells.
   - Pulses travel along the links when something actually happens (listening, thinking,
     web search, speaking, learning a memory, handing off to the Shortcut...).
   - Live badges (memory count, open list items, bills due, running timers, which brain answered).
   - Drag to turn it, tap a node for details, and an activity log of what she just did.
   Same API as before: new FridayNeural(canvas), start(), stop(), setActive(kind). */
(function (root) {
  "use strict";

  var TAU = Math.PI * 2;
  var GOLD = [255, 208, 115], GOLD_SOFT = [232, 200, 114], SILVER = [214, 222, 234], CORE = [255, 224, 160];

  var DEFS = [
    { id: "core", label: "", ring: 0, kind: "core" },
    { id: "thinking", label: "Thinking", ring: 1, kind: "mind", tip: "Her brain. Shows which AI answered last and which ones are resting." },
    { id: "memory", label: "Memory", ring: 1, kind: "mind", tip: "Things she knows about you, plus a summary of older chats.", panel: "memory" },
    { id: "voice", label: "Voice", ring: 1, kind: "mind", tip: "Listening and speaking." },
    { id: "vision", label: "Vision", ring: 1, kind: "mind", tip: "Photos you show her.", panel: "photo-take" },
    { id: "research", label: "Research", ring: 2, kind: "helper", tip: "Web search and research helper." },
    { id: "coding", label: "Coding", ring: 2, kind: "helper", tip: "Coding helper." },
    { id: "money", label: "Money", ring: 2, kind: "helper", tip: "Money helper and your bills.", panel: "money" },
    { id: "messages", label: "Messages", ring: 2, kind: "helper", tip: "Drafting texts and emails." },
    { id: "agents", label: "Connections", ring: 2, kind: "helper", tip: "Other AIs you added (backup brains and “ask …”)." },
    { id: "translate", label: "Translator", ring: 2, kind: "helper", tip: "Says things in other languages with a matching iPhone voice." },
    { id: "lists", label: "Lists", ring: 3, kind: "life", tip: "Grocery, to-do and your own lists.", panel: "lists" },
    { id: "bills", label: "Bills", ring: 3, kind: "life", tip: "Bills and due dates.", panel: "money" },
    { id: "timers", label: "Timers", ring: 3, kind: "life", tip: "Running timers.", panel: "timer" },
    { id: "countdowns", label: "Countdowns", ring: 3, kind: "life", tip: "Days until the things you're waiting for.", panel: "countdowns" },
    { id: "notes", label: "Notes", ring: 3, kind: "life", tip: "Quick notes.", panel: "notes" },
    { id: "weather", label: "Weather", ring: 3, kind: "life", tip: "Weather, the morning briefing and the nightly recap." },
    { id: "routines", label: "Routines", ring: 3, kind: "life", tip: "Phrases that do several things, like “movie time” or “I'm home”." },
    { id: "habits", label: "Habits", ring: 3, kind: "life", tip: "Water and the habits you track, with streaks.", panel: "habits" },
    { id: "spending", label: "Spending", ring: 3, kind: "life", tip: "Your spending log.", panel: "money" },
    { id: "calendar", label: "Calendar", ring: 3, kind: "life", tip: "Reminders and calendar events, added right in the app when the iPhone allows it." },
    { id: "shortcut", label: "Shortcut", ring: 4, kind: "phone", tip: "Jobs only your Shortcut can do: Apple TV, HomePod, texts, calls, alarms, Do Not Disturb." },
    { id: "home", label: "Home", ring: 4, kind: "phone", tip: "Lights and scenes. Right in the app if iOS allows it, otherwise through your Shortcut." },
    { id: "partner", label: "Partner", ring: 4, kind: "phone", tip: "Messages between Friday and Jarvis, read out loud." },
    { id: "contacts", label: "Contacts", ring: 4, kind: "phone", tip: "Contact names synced on this phone, so texts and calls find the right person." }
  ];
  var LINKS = [
    ["core", "thinking"], ["core", "memory"], ["core", "voice"], ["core", "vision"],
    ["thinking", "research"], ["thinking", "coding"], ["thinking", "money"], ["thinking", "messages"], ["thinking", "agents"],
    ["memory", "thinking"], ["vision", "thinking"],
    ["voice", "shortcut"], ["memory", "lists"], ["memory", "notes"], ["vision", "timers"],
    ["money", "bills"], ["memory", "countdowns"], ["research", "weather"], ["core", "shortcut"],
    ["lists", "notes"], ["timers", "countdowns"], ["bills", "countdowns"], ["weather", "shortcut"], ["lists", "timers"],
    ["thinking", "translate"], ["core", "routines"], ["routines", "shortcut"], ["memory", "habits"], ["money", "spending"],
    ["core", "calendar"], ["calendar", "countdowns"], ["voice", "partner"], ["partner", "contacts"], ["shortcut", "home"], ["core", "home"], ["shortcut", "contacts"]
  ];
  // What lights up for each kind of activity: a path of nodes the pulses travel along.
  var PATHS = {
    listening: ["voice", "core"],
    thinking: ["core", "thinking"],
    research: ["core", "thinking", "research"],
    coding: ["core", "thinking", "coding"],
    money: ["core", "thinking", "money"],
    messages: ["core", "thinking", "messages"],
    speaking: ["core", "voice"],
    memory: ["thinking", "memory"],
    vision: ["vision", "thinking"],
    agents: ["thinking", "agents"],
    shortcut: ["core", "shortcut"],
    lists: ["core", "memory", "lists"],
    bills: ["core", "thinking", "money", "bills"],
    timers: ["core", "vision", "timers"],
    countdowns: ["core", "memory", "countdowns"],
    notes: ["core", "memory", "notes"],
    weather: ["core", "thinking", "research", "weather"],
    translate: ["core", "thinking", "translate"],
    routines: ["core", "routines"],
    habits: ["core", "memory", "habits"],
    spending: ["core", "thinking", "money", "spending"],
    calendar: ["core", "calendar"],
    home: ["core", "home"],
    partner: ["core", "voice", "partner"],
    contacts: ["core", "shortcut", "contacts"]
  };

  function fib(n, i, offset) {
    var y = 1 - (i + 0.5) / n * 2;
    var r = Math.sqrt(Math.max(0, 1 - y * y));
    var phi = i * 2.399963 + (offset || 0);
    return [Math.cos(phi) * r, y * 0.78, Math.sin(phi) * r];
  }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.max(0, Math.min(1, a)).toFixed(3) + ")"; }
  function store() { return root.FridayStorage; }
  function nowStr() { return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

  function FridayNeural(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.active = null;
    this.running = false;
    this.dpr = 1;
    this.rotY = 0.4; this.rotX = -0.22; this.velY = 0.06; this.dragging = false;
    this.packets = [];
    this.flash = {};
    this.log = (store() && store().get("neuralLog", [])) || [];
    this.selected = null;
    this.lastBrain = "";
    var rings = { 1: [], 2: [], 3: [], 4: [] };
    DEFS.forEach(function (d) { if (d.ring) rings[d.ring].push(d); });
    var shape = { 1: { r: 0.40, y: 0.02, off: 0.4 }, 2: { r: 0.74, y: -0.52, off: 0.0 }, 3: { r: 0.92, y: 0.5, off: 0.25 }, 4: { r: 0.5, y: -0.98, off: 0.6 } };
    var self = this;
    this.nodes = {};
    DEFS.forEach(function (d) {
      var p = [0, 0, 0];
      if (d.ring) {
        var arr = rings[d.ring], i = arr.indexOf(d), sh = shape[d.ring];
        var ang = sh.off + i / arr.length * TAU;
        var yj = d.ring === 1 ? (i % 2 ? 0.16 : -0.16) : (i % 2 ? 0.06 : -0.06);
        p = [Math.cos(ang) * sh.r, sh.y + yj, Math.sin(ang) * sh.r];
      }
      self.nodes[d.id] = { def: d, p: p, sx: 0, sy: 0, sz: 0, scale: 1, glow: 0, seed: Math.random() * 100 };
    });
    var name = (root.FRIDAY_CONFIG && root.FRIDAY_CONFIG.getProfile && root.FRIDAY_CONFIG.getProfile().assistantName) || "Friday";
    try {
      var pcfg = root.FridayExtras && root.FridayExtras.partnerCfg ? root.FridayExtras.partnerCfg(root.FRIDAY_CONFIG.getProfile()) : null;
      if (pcfg && pcfg.display) this.nodes.partner.def = Object.assign({}, this.nodes.partner.def, { label: pcfg.display });
    } catch (e) {}
    // 3.1: the map grows. Every memory, routine, habit, list, countdown and connection
    // becomes a small bubble around the part of her it belongs to.
    this.leaves = {};
    this._seen = null;
    this.nodes.core.def = Object.assign({}, this.nodes.core.def, { label: name, tip: "This is " + name + ". Everything she does flows through here." });
    // background synapse dust
    this.dust = [];
    for (var k = 0; k < 260; k++) {
      var u = Math.random() * 2 - 1, th = Math.random() * TAU, rr = Math.pow(Math.random(), 0.5) * 1.15;
      var sq = Math.sqrt(1 - u * u);
      this.dust.push({ p: [Math.cos(th) * sq * rr, u * rr * 0.8, Math.sin(th) * sq * rr], tw: Math.random() * TAU, s: Math.random() });
    }
    this._bind();
  }

  FridayNeural.prototype._bind = function () {
    var self = this, c = this.canvas;
    this._onResize = function () { if (self.running) self.resize(); };
    window.addEventListener("resize", this._onResize);
    var x0 = 0, y0 = 0, lx = 0, moved = false, t0 = 0;
    function pt(e) { var t = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e); return t; }
    function down(e) { var p = pt(e); x0 = lx = p.clientX; y0 = p.clientY; moved = false; t0 = Date.now(); self.dragging = true; }
    function move(e) {
      if (!self.dragging) return;
      var p = pt(e);
      var dx = p.clientX - lx; lx = p.clientX;
      if (Math.abs(p.clientX - x0) + Math.abs(p.clientY - y0) > 8) moved = true;
      self.rotY += dx * 0.008;
      self.velY = dx * 0.008;
      self.rotX = Math.max(-0.7, Math.min(0.5, self.rotX + (p.clientY - y0) * 0.00025));
      if (e.cancelable) e.preventDefault();
    }
    function up(e) {
      if (!self.dragging) return;
      self.dragging = false;
      if (!moved && Date.now() - t0 < 500) {
        var p = pt(e), r = c.getBoundingClientRect();
        self._tap((p.clientX - r.left) * self.dpr, (p.clientY - r.top) * self.dpr);
      }
    }
    c.addEventListener("touchstart", down, { passive: true });
    c.addEventListener("touchmove", move, { passive: false });
    c.addEventListener("touchend", up);
    c.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    // live activity from the rest of the app
    var map = {
      "friday:lists": ["lists", "List updated"], "friday:bills": ["bills", "Bills updated"],
      "friday:countdowns": ["countdowns", "Countdown updated"], "friday:notes": ["notes", "Note saved"],
      "friday:timers": ["timers", "Timers changed"], "friday:memory": ["memory", "Memory updated"],
      "friday:habits": ["habits", "Habits updated"], "friday:spending": ["spending", "Spending logged"],
      "friday:routines": ["routines", "Routines changed"], "friday:contacts": ["contacts", "Contacts synced"]
    };
    Object.keys(map).forEach(function (ev) {
      root.addEventListener(ev, function () { self.pulse(map[ev][0], map[ev][1]); if (self.running) self._syncLeaves(); });
    });
    root.addEventListener("friday:activity", function (e) {
      var d = e.detail || {};
      if (d.brain) self.lastBrain = d.brain;
      if (d.node) self.pulse(d.node, d.text, d.quiet);
    });
  };

  FridayNeural.prototype.resize = function () {
    var c = this.canvas;
    var dpr = Math.min(2.5, window.devicePixelRatio || 1);
    var w = c.clientWidth || (c.parentElement && c.parentElement.clientWidth) || window.innerWidth;
    var h = c.clientHeight || (c.parentElement && c.parentElement.clientHeight) || (window.innerHeight - 80);
    this._cw = w; this._ch = h;
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    this.dpr = dpr;
  };

  // Old API: "thinking", "research", "coding", "money", "messages", or null.
  FridayNeural.prototype.setActive = function (kind) {
    this.active = kind || null;
    if (kind) this.pulse(kind === "thinking" ? "thinking" : kind, null, true);
  };

  // Light up a path and log what happened.
  FridayNeural.prototype.pulse = function (kind, text, quiet) {
    var path = PATHS[kind] || (this.nodes[kind] ? ["core", kind] : null);
    if (this.packets.length > 160) this.packets.splice(0, this.packets.length - 160);
    if (!path) return;
    for (var i = 0; i < path.length - 1; i++) {
      for (var k = 0; k < 3; k++) this.packets.push({ a: path[i], b: path[i + 1], t: -k * 0.12 - i * 0.35, speed: 0.9 + Math.random() * 0.4, silver: kind === "listening" || Math.random() < 0.25 });
    }
    var self = this;
    path.forEach(function (id) { self.flash[id] = 1; });
    if (text && !quiet) {
      this.log.unshift({ t: nowStr(), node: kind, text: String(text).slice(0, 80) });
      this.log = this.log.slice(0, 30);
      try { store().set("neuralLog", this.log); } catch (e) {}
      this._renderLog();
    }
  };

  FridayNeural.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.resize();
    this._renderLog();
    this._renderStats();
    var self = this;
    this._syncLeaves();
    this._statsTimer = setInterval(function () { self._renderStats(); if (self.selected) self._renderCard(); if (++self._lt % 3 === 0) self._syncLeaves(); }, 1000);
    this._lt = 0;
    var loop = function (ts) {
      if (!self.running) return;
      self._raf = requestAnimationFrame(loop);
      self._draw(ts);
    };
    this._raf = requestAnimationFrame(loop);
  };

  FridayNeural.prototype.stop = function () {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    clearInterval(this._statsTimer);
  };

  // ---------- growth: one small bubble per thing she knows ----------
  function hashStr(t) { var h = 2166136261; t = String(t || ""); for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function shortLabel(t) { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > 26 ? t.slice(0, 24) + "…" : t; }
  FridayNeural.prototype._wantLeaves = function () {
    var S = store(), out = [];
    if (!S) return out;
    function add(parent, key, label, tip) { out.push({ id: parent + ":" + hashStr(key), parent: parent, label: shortLabel(label), tip: tip || label }); }
    try {
      (S.get("memory", []) || []).slice(-60).forEach(function (m) { var t = (m && m.text) || m; if (t) add("memory", t, t, (m.auto ? "She learned this on her own: " : "You told her: ") + t); });
      (S.get("connections", []) || []).filter(function (x) { return x.type === "agent"; }).forEach(function (a) { add("agents", a.id || a.name, a.name, a.name + (a.backup ? " · backup brain" : " · say “ask " + a.name + " …”")); });
      var X = root.FridayExtras;
      if (X) {
        X.routines().forEach(function (r) { add("routines", r.id || r.phrase, r.phrase, "“" + r.phrase + "” · " + ((r.steps || []).length ? (r.steps || []).join(", ") : "greeting only")); });
        X.habits().list.forEach(function (h) { add("habits", h.id, h.name, h.name + (h.goal > 1 ? " · goal " + h.goal + " a day" : " · once a day")); });
      }
      var l = S.get("lists", null);
      if (l && l.items) Object.keys(l.items).forEach(function (k) { var n = l.items[k].filter(function (x) { return !x.done; }).length; add("lists", "list:" + k, k.charAt(0).toUpperCase() + k.slice(1), (k === "to-do" ? "To-do" : k) + " list · " + n + " open"); });
      (S.get("countdowns", []) || []).forEach(function (c) { add("countdowns", c.id || c.name, c.name, c.name); });
      (S.get("bills", []) || []).forEach(function (b) { add("bills", b.id || b.name, b.name, b.name + (b.amount ? " · $" + b.amount : "")); });
    } catch (e) {}
    return out;
  };
  FridayNeural.prototype._syncLeaves = function () {
    var S = store(), self = this, want = this._wantLeaves(), keep = {};
    if (!this._seen) this._seen = {};
    var seenList = (S && S.get("neuralSeen", null)) || null;
    var firstTime = !seenList;
    if (seenList && !this._seenLoaded) { seenList.forEach(function (k) { self._seen[k] = 1; }); this._seenLoaded = true; }
    var byParent = {};
    want.forEach(function (w) { (byParent[w.parent] = byParent[w.parent] || []).push(w); });
    Object.keys(byParent).forEach(function (pid) {
      var arr = byParent[pid], parent = self.nodes[pid];
      if (!parent) return;
      var n = arr.length, rad = Math.min(0.22, 0.09 + 0.014 * Math.sqrt(n));
      arr.forEach(function (w, k) {
        keep[w.id] = 1;
        var d = fib(Math.max(n, 6), k, parent.seed);
        var pos = [parent.p[0] + d[0] * rad, parent.p[1] + d[1] * rad * 1.1, parent.p[2] + d[2] * rad];
        var lf = self.leaves[w.id];
        if (!lf) {
          var isNew = !firstTime && !self._seen[w.id];
          lf = self.leaves[w.id] = { id: w.id, parent: pid, p: pos, born: isNew ? performance.now() : -1, seed: Math.random() * 100 };
          if (isNew) { self.pulse(pid, "New: " + w.label, false); }
        }
        lf.p = pos; lf.label = w.label; lf.tip = w.tip;
      });
    });
    Object.keys(this.leaves).forEach(function (id) { if (!keep[id]) delete self.leaves[id]; });
    Object.keys(keep).forEach(function (k) { self._seen[k] = 1; });
    try { if (S) S.set("neuralSeen", Object.keys(keep)); } catch (e) {}
  };

  // ---------- live numbers ----------
  FridayNeural.prototype._info = function (id) {
    var S = store();
    if (!S) return "";
    try {
      if (id === "memory") { var m = S.get("memory", []) || []; var sum = S.get("summary", null); var learned = m.filter(function (x) { return x.auto; }).length; return m.length + " things · " + learned + " learned on her own" + (sum && sum.text ? " · keeps a summary of older chats" : ""); }
      if (id === "lists") { var l = S.get("lists", null); if (!l || !l.items) return "No lists yet"; return Object.keys(l.items).map(function (k) { return (k === "to-do" ? "To-do" : k.charAt(0).toUpperCase() + k.slice(1)) + " " + l.items[k].filter(function (x) { return !x.done; }).length; }).join(" · "); }
      if (id === "bills" || id === "money") { var b = S.get("bills", []) || []; if (!b.length) return "No bills yet"; var tot = b.filter(function (x) { return x.repeat !== "once"; }).reduce(function (s, x) { return s + (+x.amount || 0); }, 0); return b.length + " bills · $" + Math.round(tot) + " a month"; }
      if (id === "timers") { var t = (S.get("timers", []) || []).filter(function (x) { return x && x.end > Date.now(); }); if (!t.length) return "None running"; return t.map(function (x) { var s = Math.max(0, Math.round((x.end - Date.now()) / 1000)); return x.name + " " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }).join(" · "); }
      if (id === "countdowns") { var c = S.get("countdowns", []) || []; return c.length ? c.length + " countdown" + (c.length > 1 ? "s" : "") : "None yet"; }
      if (id === "notes") { var n = S.get("notes", []) || []; return n.length + " note" + (n.length === 1 ? "" : "s"); }
      if (id === "agents") { var a = (S.get("connections", []) || []).filter(function (x) { return x.type === "agent"; }); return a.length ? a.map(function (x) { return x.name + (x.backup ? " (backup)" : ""); }).join(", ") : "None added"; }
      if (id === "thinking") {
        var u = S.get("usage.brain", null), today = new Date().toDateString();
        var line = this.lastBrain ? "Last answer: " + this.lastBrain : "Groq, with automatic backup";
        if (u && u.date === today) line += " · " + (u.total || 0) + " replies today";
        var st = root.FridayBrain && root.FridayBrain.status ? root.FridayBrain.status() : null;
        if (st && st.busy && st.busy.length) line += " · " + st.busy.length + " resting";
        return line;
      }
      if (id === "voice") { var sv = S.get("settings", {}) || {}; var uv = S.get("usage.brain", null); var tts = uv && uv.date === new Date().toDateString() ? (uv.tts || 0) : 0; return (sv.voiceURI && sv.voiceURI.indexOf("ai:") === 0 ? "AI voice " + sv.voiceURI.slice(3) + " · about " + Math.max(0, 100 - tts) + " left today" : "iPhone voice"); }
      if (id === "routines" && root.FridayExtras) { var rr = root.FridayExtras.routines(); return rr.length + " routine" + (rr.length === 1 ? "" : "s") + ": " + rr.map(function (x) { return x.phrase; }).join(", "); }
      if (id === "habits" && root.FridayExtras) { var hh = root.FridayExtras.habits(); return hh.list.length ? hh.list.map(function (x) { return x.name; }).join(", ") : "None yet"; }
      if (id === "spending" && root.FridayExtras) { var tt = root.FridayExtras.spendTotals(); return "This month $" + Math.round(tt.month) + " · this week $" + Math.round(tt.week); }
      if (id === "contacts") { var cn = (S.get("contacts", null) || {}).names; return cn && cn.length ? cn.length + " contact names synced" : "Not synced yet (Settings → Messages & Contacts)"; }
      if (id === "home") { var hi = S.get("homeInfo", null); return hi && hi.lights ? hi.lights + " lights in the app" : "Through your Shortcut"; }
      if (id === "calendar") return root.FridayNative && root.FridayNative.isApp() && root.FridayNative.calendar.available() ? "Right in the app" : "Through your Shortcut";
      if (id === "partner" && root.FridayExtras) { var pc = root.FridayExtras.partnerCfg(root.FRIDAY_CONFIG.getProfile()); return "Say “tell " + pc.display + " …” · texts " + pc.contact; }
      if (id === "translate") return "Say “how do you say … in Spanish”";
      if (id === "weather") return "Open-Meteo · morning briefing " + ((S.get("settings", {}) || {}).morningBriefing === false ? "off" : "on");
      if (id === "shortcut") { var last = S.get("lastShortcut", ""); return last ? "Last job: “" + last + "”" : "Ready for phone-only jobs"; }
      if (id === "core") { var s2 = S.get("settings", {}) || {}; var moods = { normal: "Normal", focus: "Focus", hype: "Hype", calm: "Calm", bedtime: "Bedtime" }; return "Mood: " + (moods[s2.mood || "normal"] || "Normal") + (root.FridayNight && root.FridayNight.isNight() ? " · night mode" : ""); }
    } catch (e) {}
    return "";
  };

  FridayNeural.prototype._badge = function (id) {
    var S = store();
    if (!S) return "";
    try {
      if (id === "memory") return String((S.get("memory", []) || []).length);
      if (id === "lists") { var l = S.get("lists", null); if (!l || !l.items) return ""; var n = 0; Object.keys(l.items).forEach(function (k) { n += l.items[k].filter(function (x) { return !x.done; }).length; }); return n ? String(n) : ""; }
      if (id === "timers") { var t = (S.get("timers", []) || []).filter(function (x) { return x && x.end > Date.now(); }).sort(function (a, b) { return a.end - b.end; }); if (!t.length) return ""; var s = Math.round((t[0].end - Date.now()) / 1000); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
      if (id === "bills") { var b = S.get("bills", []) || []; return b.length ? String(b.length) : ""; }
      if (id === "notes") { var nn = (S.get("notes", []) || []).length; return nn ? String(nn) : ""; }
      if (id === "countdowns") { var c = (S.get("countdowns", []) || []).length; return c ? String(c) : ""; }
      if (id === "routines" && root.FridayExtras) return String(root.FridayExtras.routines().length);
      if (id === "habits" && root.FridayExtras) { var h = root.FridayExtras.habits(); return h.list.length ? String(h.list.length) : ""; }
      if (id === "spending" && root.FridayExtras) { var m = root.FridayExtras.spendTotals().month; return m ? "$" + Math.round(m) : ""; }
      if (id === "contacts") { var cn = (S.get("contacts", null) || {}).names; return cn && cn.length ? String(cn.length) : ""; }
    } catch (e) {}
    return "";
  };

  // ---------- drawing ----------
  FridayNeural.prototype._project = function (p, cx, cy, R) {
    var cy_ = Math.cos(this.rotY), sy_ = Math.sin(this.rotY), cx_ = Math.cos(this.rotX), sx_ = Math.sin(this.rotX);
    var x = p[0] * cy_ + p[2] * sy_, z = -p[0] * sy_ + p[2] * cy_;
    var y = p[1] * cx_ - z * sx_; z = p[1] * sx_ + z * cx_;
    var persp = 2.6 / (2.6 - z);
    return { x: cx + x * R * persp, y: cy + y * R * persp, z: z, s: persp };
  };

  FridayNeural.prototype._curve = function (a, b, cx, cy) {
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    var dx = mx - cx, dy = my - cy, d = Math.sqrt(dx * dx + dy * dy) || 1;
    var bend = 0.18 * Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
    return { x: mx + dx / d * bend, y: my + dy / d * bend };
  };

  function qpt(a, c, b, t) {
    var u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
  }

  FridayNeural.prototype._draw = function (ts) {
    var dt = this._last ? Math.min(0.05, (ts - this._last) / 1000) : 0.016;
    this._last = ts;
    var t = ts / 1000;
    if (this.canvas.clientWidth !== this._cw || this.canvas.clientHeight !== this._ch) this.resize();
    if (!this.dragging) {
      this.velY += (0.05 - this.velY) * 0.02;
      this.rotY += this.velY * dt * (this.active ? 1.8 : 1);
    }
    var ctx = this.ctx, w = this.canvas.width, h = this.canvas.height, dpr = this.dpr;
    var cx = w / 2, cy = h * 0.5, R = Math.min(w * 0.5, h * 0.42);
    ctx.clearRect(0, 0, w, h);
    var bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6);
    bg.addColorStop(0, this.active ? "rgba(40,28,10,0.55)" : "rgba(24,17,7,0.45)");
    bg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    var self = this;
    // dust (depth layer)
    ctx.globalCompositeOperation = "lighter";
    this.dust.forEach(function (d) {
      var q = self._project(d.p, cx, cy, R);
      var a = (0.06 + 0.12 * (q.z + 1) / 2) * (0.6 + 0.4 * Math.sin(t * 1.3 + d.tw));
      ctx.fillStyle = rgba(d.s < 0.75 ? GOLD_SOFT : SILVER, a);
      var r = (0.6 + d.s * 1.1) * dpr * q.s;
      ctx.fillRect(q.x - r / 2, q.y - r / 2, r, r);
    });

    // project nodes
    var P = {};
    Object.keys(this.nodes).forEach(function (id) {
      var n = self.nodes[id];
      var wob = [Math.sin(t * 0.31 + n.seed) * 0.015, Math.cos(t * 0.27 + n.seed) * 0.015, 0];
      var q = self._project([n.p[0] + wob[0], n.p[1] + wob[1], n.p[2]], cx, cy, R);
      n.sx = q.x; n.sy = q.y; n.sz = q.z; n.scale = q.s;
      self.flash[id] = (self.flash[id] || 0) * Math.exp(-dt * 1.6);
      P[id] = q;
    });

    // links
    LINKS.forEach(function (L) {
      var a = P[L[0]], b = P[L[1]];
      if (!a || !b) return;
      var c = self._curve(a, b, cx, cy);
      var hot = Math.max(self.flash[L[0]] || 0, self.flash[L[1]] || 0);
      var depth = (a.z + b.z + 2) / 4;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
      ctx.strokeStyle = hot > 0.05 ? rgba(GOLD, 0.12 + hot * 0.45) : rgba(SILVER, 0.05 + depth * 0.09);
      ctx.lineWidth = (0.6 + hot * 1.6) * dpr;
      ctx.stroke();
    });

    // packets
    var keep = [];
    this.packets.forEach(function (k) {
      k.t += dt * k.speed;
      if (k.t >= 1) return;
      keep.push(k);
      if (k.t < 0) return;
      var a = P[k.a], b = P[k.b];
      if (!a || !b) return;
      var c = self._curve(a, b, cx, cy);
      var col = k.silver ? SILVER : GOLD;
      for (var tail = 0; tail < 5; tail++) {
        var tt = Math.max(0, k.t - tail * 0.025);
        var q = qpt(a, c, b, tt);
        var rr = (2.0 - tail * 0.3) * dpr;
        ctx.fillStyle = rgba(col, (1 - tail / 5) * 0.75);
        ctx.beginPath(); ctx.arc(q.x, q.y, rr, 0, TAU); ctx.fill();
      }
      var q0 = qpt(a, c, b, k.t);
      var g = ctx.createRadialGradient(q0.x, q0.y, 0, q0.x, q0.y, 7 * dpr);
      g.addColorStop(0, rgba(col, 0.22)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q0.x, q0.y, 7 * dpr, 0, TAU); ctx.fill();
    });
    this.packets = keep.slice(-260);
    if (this.active && Math.random() < 0.06) this.pulse(this.active === "thinking" ? "thinking" : this.active, null, true);

    // learned bubbles around their parent
    var nowMs = performance.now();
    Object.keys(this.leaves).forEach(function (id) {
      var lf = self.leaves[id], par = P[lf.parent];
      if (!par) return;
      var wob = [Math.sin(t * 0.5 + lf.seed) * 0.01, Math.cos(t * 0.43 + lf.seed) * 0.01, 0];
      var q = self._project([lf.p[0] + wob[0], lf.p[1] + wob[1], lf.p[2]], cx, cy, R);
      lf.sx = q.x; lf.sy = q.y; lf.sz = q.z;
      var grow = lf.born < 0 ? 1 : Math.min(1, (nowMs - lf.born) / 1200);
      var pop = lf.born < 0 ? 0 : Math.max(0, 1 - (nowMs - lf.born) / 4000);
      var depth = (q.z + 1) / 2, a = (0.25 + depth * 0.6) * grow;
      ctx.strokeStyle = rgba(GOLD_SOFT, 0.08 + 0.1 * depth + pop * 0.4);
      ctx.lineWidth = 0.6 * dpr;
      ctx.beginPath(); ctx.moveTo(par.x, par.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      var rr = (1.8 + 1.2 * depth + pop * 3) * dpr * q.s * grow;
      if (pop > 0 || self.selected === id) {
        var gg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rr * 5);
        gg.addColorStop(0, rgba(GOLD, 0.35 * Math.max(pop, self.selected === id ? 0.7 : 0)));
        gg.addColorStop(1, rgba(GOLD, 0));
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(q.x, q.y, rr * 5, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = rgba(lf.parent === "memory" ? SILVER : GOLD_SOFT, a);
      ctx.beginPath(); ctx.arc(q.x, q.y, rr, 0, TAU); ctx.fill();
      if (self.selected === id || pop > 0.5) {
        ctx.globalCompositeOperation = "source-over";
        ctx.font = "500 " + 9.5 * dpr + "px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = rgba([239, 236, 232], 0.9);
        ctx.fillText(lf.label, q.x, q.y - rr - 6 * dpr);
        ctx.globalCompositeOperation = "lighter";
      }
    });

    // nodes, back to front
    var order = Object.keys(this.nodes).sort(function (a, b) { return self.nodes[a].sz - self.nodes[b].sz; });
    order.forEach(function (id) {
      var n = self.nodes[id], d = n.def, q = P[id];
      var hot = self.flash[id] || 0;
      var depth = (q.z + 1) / 2;
      var base = d.kind === "core" ? 11 : d.kind === "mind" ? 6.5 : 5;
      var r = base * dpr * q.s * (1 + hot * 0.35 + (d.kind === "core" ? 0.06 * Math.sin(t * 2.2) : 0));
      var col = d.kind === "core" ? CORE : d.kind === "mind" ? SILVER : d.kind === "phone" ? [190, 205, 230] : GOLD_SOFT;
      var alpha = 0.35 + depth * 0.65;
      var gr = r * (d.kind === "core" ? 5 : 4);
      var gl = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, gr);
      gl.addColorStop(0, rgba(col, (0.18 + hot * 0.4) * alpha));
      gl.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(q.x, q.y, gr, 0, TAU); ctx.fill();
      if (d.kind === "core") {
        ctx.save();
        ctx.translate(q.x, q.y);
        for (var ring = 0; ring < 2; ring++) {
          ctx.save();
          ctx.rotate(t * (0.25 + ring * 0.2) * (ring ? -1 : 1) + ring * 1.1);
          ctx.strokeStyle = rgba(GOLD, 0.22 + hot * 0.35);
          ctx.lineWidth = 0.9 * dpr;
          ctx.beginPath(); ctx.ellipse(0, 0, r * (2.1 + ring * 0.6), r * (0.62 + ring * 0.18), 0, 0, TAU * 0.86); ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
      }
      ctx.fillStyle = rgba(col, alpha);
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba([255, 255, 255], 0.5 * alpha);
      ctx.beginPath(); ctx.arc(q.x - r * 0.3, q.y - r * 0.3, r * 0.35, 0, TAU); ctx.fill();
      if (self.selected === id) {
        ctx.strokeStyle = rgba(GOLD, 0.9); ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath(); ctx.arc(q.x, q.y, r + 6 * dpr, 0, TAU); ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      var label = d.label;
      var showLabel = label && (depth > 0.32 || hot > 0.2 || self.selected === id || d.kind === "core");
      if (showLabel) {
        var fs = (d.kind === "core" ? 13 : 10 + 1.5 * depth) * dpr;
        ctx.font = (d.kind === "core" ? "600 " : "500 ") + fs + "px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.textAlign = "center";
        var ly = q.y + r + 13 * dpr;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillText(label, q.x + 0.8 * dpr, ly + 0.8 * dpr);
        ctx.fillStyle = rgba([239, 236, 232], 0.2 + depth * 0.75);
        ctx.fillText(label, q.x, ly);
        var badge = self._badge(id);
        if (badge && depth > 0.25) {
          ctx.font = "600 " + 10 * dpr + "px -apple-system, BlinkMacSystemFont, sans-serif";
          var bw = ctx.measureText(badge).width + 10 * dpr, bx = q.x + r * 0.7, by = q.y - r - 6 * dpr;
          ctx.fillStyle = rgba([24, 20, 12], 0.85);
          ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx - bw / 2, by - 8 * dpr, bw, 16 * dpr, 8 * dpr) : ctx.rect(bx - bw / 2, by - 8 * dpr, bw, 16 * dpr); ctx.fill();
          ctx.fillStyle = rgba(GOLD, 0.95);
          ctx.fillText(badge, bx, by + 3.5 * dpr);
        }
      }
      ctx.globalCompositeOperation = "lighter";
    });
    ctx.globalCompositeOperation = "source-over";
  };

  // ---------- tap, card, log, stats ----------
  FridayNeural.prototype._tap = function (x, y) {
    var best = null, bd = 1e9, self = this;
    Object.keys(this.nodes).forEach(function (id) {
      var n = self.nodes[id];
      var d = Math.hypot(n.sx - x, n.sy - y);
      var lim = (n.def.kind === "core" ? 40 : 30) * self.dpr;
      if (d < lim && d < bd) { bd = d; best = id; }
    });
    Object.keys(this.leaves || {}).forEach(function (id) {
      var lf = self.leaves[id];
      var d = Math.hypot(lf.sx - x, lf.sy - y);
      if (d < 16 * self.dpr && d < bd * 0.8) { bd = d; best = id; }
    });
    this.selected = best === this.selected ? null : best;
    if (best) this.flash[best] = 1;
    this._renderCard();
  };

  FridayNeural.prototype._renderCard = function () {
    var card = document.getElementById("neural-card");
    if (!card) return;
    if (!this.selected) { card.classList.add("hidden"); return; }
    var lf = this.leaves && this.leaves[this.selected];
    if (lf) {
      var pd = this.nodes[lf.parent] ? this.nodes[lf.parent].def : {};
      lf = { def: { label: lf.label, tip: lf.tip, panel: pd.panel } };
    }
    var n = lf || this.nodes[this.selected];
    if (!n) { card.classList.add("hidden"); return; }
    var d = n.def, self = this;
    card.classList.remove("hidden");
    var key = this.selected + "|" + (lf ? d.tip : this._info(this.selected));
    if (card._key === key) return;
    card._key = key;
    card.innerHTML = "";
    var h = document.createElement("b"); h.textContent = d.label || "Core";
    var p = document.createElement("p"); p.textContent = d.tip || "";
    var live = document.createElement("div"); live.className = "neural-live"; live.textContent = lf ? "Learned" : this._info(this.selected);
    card.appendChild(h); card.appendChild(p); card.appendChild(live);
    if (d.panel && this.onOpen) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn gold"; b.textContent = "Open " + (d.label || "");
      b.onclick = function () { self.selected = null; self.onOpen(d.panel); };
      card.appendChild(b);
    }
  };

  FridayNeural.prototype._renderLog = function () {
    var el = document.getElementById("neural-log");
    if (!el) return;
    el.innerHTML = "";
    if (!this.log.length) { el.innerHTML = '<div class="neural-row muted">Her activity shows up here as it happens.</div>'; return; }
    this.log.slice(0, 6).forEach(function (r) {
      var d = document.createElement("div"); d.className = "neural-row";
      var tm = document.createElement("span"); tm.textContent = r.t;
      var tx = document.createElement("span"); tx.textContent = r.text;
      d.appendChild(tm); d.appendChild(tx); el.appendChild(d);
    });
  };

  FridayNeural.prototype._renderStats = function () {
    var el = document.getElementById("neural-stats");
    if (!el) return;
    var S = store(), u = S && S.get("usage.brain", null), today = new Date().toDateString();
    var replies = u && u.date === today ? (u.total || 0) : 0;
    var tts = u && u.date === today ? (u.tts || 0) : 0;
    var st = root.FridayBrain && root.FridayBrain.status ? root.FridayBrain.status() : { busy: [], backups: [] };
    var parts = [
      ["Learned", String(Object.keys(this.leaves || {}).length)],
      ["Replies today", String(replies)],
      ["Brains", st.busy && st.busy.length ? st.busy.length + " resting" : "all ready"],
      ["Backups", String((st.backups || []).length)],
      ["AI voice", tts ? Math.max(0, 100 - tts) + " left" : "ready"]
    ];
    el.innerHTML = "";
    parts.forEach(function (p) {
      var d = document.createElement("div");
      var a = document.createElement("b"); a.textContent = p[1];
      var b = document.createElement("span"); b.textContent = p[0];
      d.appendChild(a); d.appendChild(b); el.appendChild(d);
    });
  };

  root.FridayNeural = FridayNeural;
})(window);
