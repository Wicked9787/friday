/* Neural map v3 (3.4): an Obsidian-style graph of her mind, flat or 3D.
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
    { id: "self", label: "Self", ring: 1, kind: "mind", tip: "Her own personality and how she feels. She chooses them herself, a little each day. Each small bubble is a day and how she felt.", selfOnly: true },
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
    { id: "partner", label: "Partner", ring: 4, kind: "phone", tip: "Messages between Friday and Reed, read out loud." },
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
    ["core", "self"], ["self", "memory"], ["self", "voice"],
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
  // 3D turning: one rotation matrix, so it turns freely in every direction.
  function matMul(a, b) {
    var r = new Array(9);
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return r;
  }
  // Turn around the screen's up-down line: the front moves right for a positive angle.
  function rotYm(a) { var c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
  // Turn around the screen's left-right line: the front moves down for a positive angle.
  function rotXm(b) { var c = Math.cos(b), s = Math.sin(b); return [1, 0, 0, 0, c, s, 0, -s, c]; }
  function tidy(m) {
    var a = [m[0], m[1], m[2]], b = [m[3], m[4], m[5]];
    var na = Math.hypot(a[0], a[1], a[2]) || 1; a = [a[0] / na, a[1] / na, a[2] / na];
    var d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; b = [b[0] - d * a[0], b[1] - d * a[1], b[2] - d * a[2]];
    var nb = Math.hypot(b[0], b[1], b[2]) || 1; b = [b[0] / nb, b[1] / nb, b[2] / nb];
    var c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    return a.concat(b, c);
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
    this.M = matMul(rotXm(0.22), rotYm(0.4));
    this.spinX = 0; this.spinY = 0.06; this.dragging = false;
    this.packets = [];
    this.flash = {};
    this.log = (store() && store().get("neuralLog", [])) || [];
    this.selected = null;
    this.lastBrain = "";
    var rings = { 1: [], 2: [], 3: [], 4: [] };
    // 3.5.9: her Self node (her own personality) is Friday's only
    var prof0 = null; try { prof0 = root.FRIDAY_CONFIG.getProfile(); } catch (e) {}
    var hasSelf = !!(root.FridaySelf && root.FridaySelf.on(prof0));
    var defs = DEFS.filter(function (d) { return !d.selfOnly || hasSelf; });
    defs.forEach(function (d) { if (d.ring) rings[d.ring].push(d); });
    var shape = { 1: { r: 0.40, y: 0.02, off: 0.4 }, 2: { r: 0.74, y: -0.52, off: 0.0 }, 3: { r: 0.92, y: 0.5, off: 0.25 }, 4: { r: 0.5, y: -0.98, off: 0.6 } };
    var self = this;
    this.nodes = {};
    defs.forEach(function (d) {
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
    var pcfg = null;
    try {
      pcfg = root.FridayExtras && root.FridayExtras.partnerCfg ? root.FridayExtras.partnerCfg(root.FRIDAY_CONFIG.getProfile()) : null;
      if (pcfg && pcfg.display) this.nodes.partner.def = Object.assign({}, this.nodes.partner.def, { label: pcfg.display });
    } catch (e) {}
    // 3.1: the map grows. Every memory, routine, habit, list, countdown and connection
    // becomes a small bubble around the part of her it belongs to.
    this.leaves = {};
    this.leafLinks = [];
    this._seen = null;
    try {
      var pn = [];
      if (pcfg) pn = (pcfg.names || []).concat(pcfg.contact ? [pcfg.contact] : []);
      pn = pn.map(function (x) { return String(x).toLowerCase().replace(/[^a-z0-9 ]+/g, "").trim(); }).filter(function (x) { return x.length >= 2; });
      if (pn.length) this._partnerRe = new RegExp("\\b(" + pn.join("|") + ")\\b");
    } catch (e2) {}
    // one soft glow, drawn once and reused for every bubble
    try {
      var gc = document.createElement("canvas"); gc.width = gc.height = 64;
      var gx = gc.getContext("2d"), gg0 = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gg0.addColorStop(0, "rgba(255,214,130,0.9)"); gg0.addColorStop(0.35, "rgba(255,200,110,0.28)"); gg0.addColorStop(1, "rgba(255,200,110,0)");
      gx.fillStyle = gg0; gx.fillRect(0, 0, 64, 64);
      this._glow = gc;
    } catch (e3) {}
    this.nodes.core.def = Object.assign({}, this.nodes.core.def, { label: name, tip: "This is " + name + ". Everything she does flows through here." });
    // background synapse dust
    this.dust = [];
    for (var k = 0; k < 260; k++) {
      var u = Math.random() * 2 - 1, th = Math.random() * TAU, rr = Math.pow(Math.random(), 0.5) * 1.15;
      var sq = Math.sqrt(1 - u * u);
      this.dust.push({ p: [Math.cos(th) * sq * rr, u * rr * 0.8, Math.sin(th) * sq * rr], tw: Math.random() * TAU, s: Math.random() });
    }
    this._initGraph();
    this._bind();
    var sw = document.getElementById("neural-mode"), hint = document.getElementById("neural-hint");
    function syncMode() {
      if (sw) sw.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", (b.getAttribute("data-mode") === "3d") === self.mode3d); });
      if (hint) hint.textContent = self.mode3d ? "Activity · drag to turn, pinch to zoom, tap a dot" : "Activity · drag to move, pinch to zoom, tap a dot";
    }
    if (sw) sw.addEventListener("click", function (e) { var b = e.target.closest("button[data-mode]"); if (!b) return; self.setMode(b.getAttribute("data-mode") === "3d"); syncMode(); });
    syncMode();
  }

  FridayNeural.prototype._bind = function () {
    var self = this, c = this.canvas;
    this._onResize = function () { if (self.running) self.resize(); };
    window.addEventListener("resize", this._onResize);
    // 3.4 Obsidian-style: drag moves the map (flat) or turns it (3D), pinch zooms, tap shows a dot.
    var x0 = 0, y0 = 0, lx = 0, ly = 0, lt = 0, moved = false, t0 = 0, pinch = null;
    function pt(e) { var t = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e); return t; }
    function down(e) {
      if (e.touches && e.touches.length === 2) {
        var a = e.touches[0], b = e.touches[1];
        pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1, z: self.cam.zoom };
        moved = true; return;
      }
      var p = pt(e); x0 = lx = p.clientX; y0 = ly = p.clientY; moved = false; t0 = lt = Date.now(); self.dragging = true;
      self.spinX = 0; self.spinY = 0;
    }
    function move(e) {
      if (e.touches && e.touches.length === 2 && pinch) {
        var a = e.touches[0], b = e.touches[1];
        var d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
        self.cam.zoom = Math.max(0.3, Math.min(5, pinch.z * d / pinch.d));
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (!self.dragging) return;
      var p = pt(e);
      var dx = p.clientX - lx, dy = p.clientY - ly, now = Date.now(), dtm = Math.max(8, now - lt) / 1000;
      lx = p.clientX; ly = p.clientY; lt = now;
      if (Math.abs(p.clientX - x0) + Math.abs(p.clientY - y0) > 8) moved = true;
      if (self.mode3d) {
        self.turn(dx * 0.008, dy * 0.008);
        self.spinY = self.spinY * 0.5 + (dx * 0.008 / dtm) * 0.5;
        self.spinX = self.spinX * 0.5 + (dy * 0.008 / dtm) * 0.5;
      } else {
        self.cam.x += dx; self.cam.y += dy;
      }
      if (e.cancelable) e.preventDefault();
    }
    function up(e) {
      if (e.touches && e.touches.length) return;
      if (pinch) { pinch = null; self.dragging = false; return; }
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
    c.addEventListener("wheel", function (e) {
      self.cam.zoom = Math.max(0.3, Math.min(5, self.cam.zoom * Math.exp(-e.deltaY * 0.0015)));
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    // live activity from the rest of the app
    var map = {
      "friday:lists": ["lists", "List updated"], "friday:bills": ["bills", "Bills updated"],
      "friday:countdowns": ["countdowns", "Countdown updated"], "friday:notes": ["notes", "Note saved"],
      "friday:timers": ["timers", "Timers changed"], "friday:memory": ["memory", "Memory updated"],
      "friday:habits": ["habits", "Habits updated"], "friday:spending": ["spending", "Spending logged"],
      "friday:routines": ["routines", "Routines changed"], "friday:contacts": ["contacts", "Contacts synced"],
      "friday:self": ["self", "Her personality changed"]
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

  // Turn the map: positive ax moves the front to the right, positive ay moves it down (it follows your finger).
  FridayNeural.prototype.turn = function (ax, ay) {
    if (ax) this.M = matMul(rotYm(ax), this.M);
    if (ay) this.M = matMul(rotXm(ay), this.M);
    this._turns = (this._turns || 0) + 1;
    if (this._turns % 60 === 0) this.M = tidy(this.M);
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
    // open already mostly settled and sized to fit, then let it float into place
    if (!this._settled) { for (var k = 0; k < 170; k++) this._simulate(); this._settled = true; }
    this._fit();
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
    function add(parent, key, label, tip, text) { out.push({ id: parent + ":" + hashStr(key), parent: parent, label: shortLabel(label), tip: tip || label, text: String(text || label || "") }); }
    try {
      (S.get("memory", []) || []).slice(-60).forEach(function (m) { var t = (m && m.text) || m; if (t) add("memory", t, t, (m.auto ? "She learned this on her own: " : "You told her: ") + t, t); });
      (S.get("connections", []) || []).filter(function (x) { return x.type === "agent"; }).forEach(function (a) { add("agents", a.id || a.name, a.name, a.name + (a.backup ? " · backup brain" : " · say “ask " + a.name + " …”")); });
      var X = root.FridayExtras;
      if (X) {
        X.routines().forEach(function (r) { add("routines", r.id || r.phrase, r.phrase, "“" + r.phrase + "” · " + ((r.steps || []).length ? (r.steps || []).join(", ") : "greeting only"), r.phrase + " " + (r.steps || []).join(" ")); });
        X.habits().list.forEach(function (h) { add("habits", h.id, h.name, h.name + (h.goal > 1 ? " · goal " + h.goal + " a day" : " · once a day")); });
      }
      var l = S.get("lists", null);
      if (l && l.items) Object.keys(l.items).forEach(function (k) { var n = l.items[k].filter(function (x) { return !x.done; }).length; add("lists", "list:" + k, k.charAt(0).toUpperCase() + k.slice(1), (k === "to-do" ? "To-do" : k) + " list · " + n + " open"); });
      (S.get("countdowns", []) || []).forEach(function (c) { add("countdowns", c.id || c.name, c.name, c.name); });
      (S.get("bills", []) || []).forEach(function (b) { add("bills", b.id || b.name, b.name, b.name + (b.amount ? " · $" + b.amount : "")); });
      // 3.5.9: one bubble per day she picked how she felt (Friday only)
      if (this.nodes && this.nodes.self) (S.get("selfLog", []) || []).slice(-45).forEach(function (x) {
        if (x && x.feeling) add("self", x.day, x.feeling, new Date(x.at || Date.now()).toLocaleDateString([], { month: "short", day: "numeric" }) + ": she felt " + x.feeling, x.feeling);
      });
    } catch (e) {}
    return out;
  };
  // ---------- connections: what each learned thing is about ----------
  var TOPICS = {
    money: /\b(money|pay|paid|rent|bank|budget|cost|price|save|saving|savings|loan|card|\$\d*)\b/,
    bills: /\b(bill|bills|due|subscription|electric|water bill|phone bill|insurance)\b/,
    spending: /\b(spend|spent|spending|bought|buy|shopping|store)\b/,
    calendar: /\b(birthday|anniversary|appointment|meeting|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|tomorrow|tonight|morning|evening)\b/,
    countdowns: /\b(trip|vacation|holiday|christmas|thanksgiving|halloween|new year|wedding|graduation|countdown)\b/,
    home: /\b(light|lights|lamp|tv|home|house|room|bedroom|kitchen|living room|apple tv|homepod|scene)\b/,
    habits: /\b(water|gym|workout|run|running|walk|steps|sleep|meditate|stretch|vitamins?)\b/,
    lists: /\b(grocery|groceries|list|to-?do|milk|eggs|bread)\b/,
    notes: /\b(note|notes|remember|password hint|idea)\b/,
    weather: /\b(weather|rain|snow|cold|hot|sunny|umbrella|jacket)\b/,
    timers: /\b(timer|alarm|wake up|nap|minutes)\b/,
    voice: /\b(voice|talk|speak|sound|loud|quiet|accent)\b/,
    vision: /\b(photo|picture|camera|look at|see)\b/,
    coding: /\b(code|coding|app|github|program|website)\b/,
    research: /\b(news|read|book|study|school|class|learn|history)\b/,
    messages: /\b(text|texts|message|email|call)\b/,
    contacts: /\b(mom|dad|mother|father|brother|sister|aunt|uncle|cousin|grandma|grandpa|friend|family)\b/,
    routines: /\b(routine|every day|always|usually|every night|every morning)\b/
  };
  var STOP = { this: 1, that: 1, with: 1, from: 1, have: 1, likes: 1, like: 1, loves: 1, love: 1, wants: 1, want: 1, about: 1, their: 1, there: 1, would: 1, should: 1, been: 1, every: 1, always: 1, really: 1, when: 1, what: 1, they: 1, them: 1, just: 1, prefers: 1, prefer: 1, uses: 1, gets: 1, does: 1, doesn: 1, into: 1, over: 1, after: 1, before: 1, usually: 1, favorite: 1, thinks: 1, says: 1, said: 1, very: 1, much: 1, more: 1, some: 1, than: 1, also: 1, only: 1, still: 1, being: 1, your: 1, will: 1, years: 1, year: 1, name: 1, named: 1 };
  FridayNeural.prototype._topicsFor = function (text, parent) {
    var t = " " + String(text || "").toLowerCase().replace(/[’]/g, "'") + " ";
    var out = [];
    if (this._partnerRe && this._partnerRe.test(t) && parent !== "partner") out.push("partner");
    var keys = Object.keys(TOPICS);
    for (var i = 0; i < keys.length && out.length < 3; i++) {
      var k = keys[i];
      if (k !== parent && this.nodes[k] && TOPICS[k].test(t)) out.push(k);
    }
    return out.slice(0, 3);
  };
  function keyWords(text, owner) {
    var w = String(text || "").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/), out = {};
    w.forEach(function (x) {
      x = x.replace(/'s$/, "");
      if (x.length >= 4 && !STOP[x] && x !== owner) out[x] = 1;
    });
    return out;
  }

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
      var n = arr.length, rad = Math.min(0.3, 0.1 + 0.02 * Math.sqrt(n));
      arr.forEach(function (w, k) {
        keep[w.id] = 1;
        var d = fib(Math.max(n, 6), k, parent.seed);
        var pos = [parent.p[0] + d[0] * rad, parent.p[1] + d[1] * rad * 1.1, parent.p[2] + d[2] * rad];
        var lf = self.leaves[w.id];
        if (!lf) {
          var isNew = !firstTime && !self._seen[w.id];
          lf = self.leaves[w.id] = { id: w.id, parent: pid, p: pos, born: isNew ? performance.now() : -1, seed: Math.random() * 100 };
          if (isNew) { self.pulse(pid, "New: " + w.label, false); }
          self._placeNear(w.id, pid);
        }
        lf.label = w.label; lf.tip = w.tip; lf.text = w.text;
        if (lf._linkText !== w.text) { lf._linkText = w.text; lf.links = self._topicsFor(w.text, pid); }
        if (lf.born > 0 && !lf._sent) {
          // a new bubble: light the way from her core to it, then out to what it's about
          lf._sent = true;
          for (var q = 0; q < 3; q++) self.packets.push({ a: pid, b: w.id, t: -0.9 - q * 0.12, speed: 0.8, silver: q === 1 });
          (lf.links || []).forEach(function (to, li) {
            for (var q2 = 0; q2 < 2; q2++) self.packets.push({ a: w.id, b: to, t: -1.8 - li * 0.3 - q2 * 0.12, speed: 0.75, silver: false });
            self.flash[to] = Math.max(self.flash[to] || 0, 0.6);
          });
        }
      });
    });
    Object.keys(this.leaves).forEach(function (id) { if (!keep[id]) delete self.leaves[id]; });
    // memories that share something (the same person, place or thing) are joined too
    var owner = "";
    try { owner = String((root.FRIDAY_CONFIG.getProfile() || {}).ownerName || "").toLowerCase(); } catch (e0) {}
    var mem = Object.keys(this.leaves).filter(function (id) { return self.leaves[id].parent === "memory"; }).map(function (id) { return { id: id, k: keyWords(self.leaves[id].text, owner) }; });
    var pairs = [], per = {};
    for (var i = 0; i < mem.length && pairs.length < 40; i++) {
      for (var j = i + 1; j < mem.length && pairs.length < 40; j++) {
        if ((per[mem[i].id] || 0) >= 2 || (per[mem[j].id] || 0) >= 2) continue;
        var shared = Object.keys(mem[i].k).filter(function (x) { return mem[j].k[x]; });
        if (shared.length) { pairs.push([mem[i].id, mem[j].id]); per[mem[i].id] = (per[mem[i].id] || 0) + 1; per[mem[j].id] = (per[mem[j].id] || 0) + 1; }
      }
    }
    this.leafLinks = pairs;
    Object.keys(this.g.pos).forEach(function (id) { if (!self.nodes[id] && !self.leaves[id]) { delete self.g.pos[id]; delete self.g.vel[id]; } });
    this._edges = null;
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
      if (id === "self") { var me = S.get("self", null) || {}; return me.feeling ? "Feels " + me.feeling + " today. In her words: “" + me.note + "”" : (me.wasReset ? "Back to how she started. She picks again tomorrow." : "She hasn't picked yet. She will after a day of talking."); }
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
  // ---------- 3.4 graph: Obsidian-style dots and lines that float into place ----------
  FridayNeural.prototype._initGraph = function () {
    var self = this;
    this.g = { pos: {}, vel: {}, alpha: 1 };
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.mode3d = (store() && store().get("neuralMode", "2d")) === "3d";
    var rnd = function (n) { return (Math.random() * 2 - 1) * n; };
    Object.keys(this.nodes).forEach(function (id) {
      var n = self.nodes[id];
      var ring = n.def.ring || 0;
      var ang = Math.atan2(n.p[2], n.p[0]) || Math.random() * TAU, rad = ring ? 70 + ring * 38 : 0;
      self.g.pos[id] = [Math.cos(ang) * rad + rnd(8), Math.sin(ang) * rad + rnd(8), rnd(60)];
      self.g.vel[id] = [0, 0, 0];
    });
  };
  FridayNeural.prototype.setMode = function (three) {
    this.mode3d = !!three;
    try { store().set("neuralMode", three ? "3d" : "2d"); } catch (e) {}
    var self = this;
    Object.keys(this.g.pos).forEach(function (id) { if (three) self.g.pos[id][2] = (Math.random() * 2 - 1) * 60; });
    this.g.alpha = Math.max(this.g.alpha, 0.8);
    for (var k = 0; k < 120; k++) this._simulate();
    this._fit();
  };
  FridayNeural.prototype._fit = function () {
    var ids = Object.keys(this.g.pos);
    if (!ids.length) return;
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, g = this.g;
    ids.forEach(function (id) { var p = g.pos[id]; x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    var w = this._cw || 360, h = this._ch || 560;
    var zx = (w - 40) / Math.max(60, x1 - x0), zy = (h - 90) / Math.max(60, y1 - y0);
    this.cam.zoom = Math.max(0.35, Math.min(1.6, Math.min(zx, zy)));
    this._fitZoom = this.cam.zoom;
    this.cam.x = -((x0 + x1) / 2) * this.cam.zoom;
    this.cam.y = -((y0 + y1) / 2) * this.cam.zoom + 10;
  };
  FridayNeural.prototype._placeNear = function (id, pid) {
    var pp = this.g.pos[pid] || [0, 0, 0];
    var a = Math.random() * TAU, r = 18 + Math.random() * 16;
    this.g.pos[id] = [pp[0] + Math.cos(a) * r, pp[1] + Math.sin(a) * r, pp[2] + (Math.random() * 2 - 1) * 16];
    this.g.vel[id] = [0, 0, 0];
    this.g.alpha = Math.max(this.g.alpha, 0.5);
  };
  FridayNeural.prototype._edgeList = function () {
    if (this._edges) return this._edges;
    var self = this, E = [], deg = {};
    function add(a, b, len, k) { if (!self.g.pos[a] || !self.g.pos[b]) return; E.push([a, b, len, k]); deg[a] = (deg[a] || 0) + 1; deg[b] = (deg[b] || 0) + 1; }
    LINKS.forEach(function (L) { add(L[0], L[1], L[0] === "core" ? 95 : 85, 0.05); });
    Object.keys(this.leaves).forEach(function (id) {
      var lf = self.leaves[id];
      add(id, lf.parent, 34, 0.08);
      (lf.links || []).forEach(function (to) { add(id, to, 110, 0.012); });
    });
    (this.leafLinks || []).forEach(function (L) { add(L[0], L[1], 55, 0.03); });
    this._deg = deg;
    this._edges = E;
    return E;
  };
  // one step of the layout: everything pushes apart, links pull together, all drift gently to the middle
  FridayNeural.prototype._simulate = function () {
    var g = this.g, ids = Object.keys(g.pos), n = ids.length, three = this.mode3d;
    if (g.alpha < 0.004) return;
    var E = this._edgeList(), a = g.alpha, i, j;
    var P = ids.map(function (id) { return g.pos[id]; }), V = ids.map(function (id) { return g.vel[id]; });
    var isLeaf = ids.map(function (id) { return id.indexOf(":") > 0; });
    for (i = 0; i < n; i++) {
      for (j = i + 1; j < n; j++) {
        var dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1], dz = three ? P[i][2] - P[j][2] : 0;
        var d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > 90000) continue;
        if (d2 < 4) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 4; }
        var k = (isLeaf[i] && isLeaf[j] ? 260 : isLeaf[i] || isLeaf[j] ? 420 : 1500) * a / d2;
        V[i][0] += dx * k; V[i][1] += dy * k; V[j][0] -= dx * k; V[j][1] -= dy * k;
        if (three) { V[i][2] += dz * k; V[j][2] -= dz * k; }
      }
    }
    E.forEach(function (e) {
      var pa = g.pos[e[0]], pb = g.pos[e[1]];
      var dx = pb[0] - pa[0], dy = pb[1] - pa[1], dz = three ? pb[2] - pa[2] : 0;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, f = (d - e[2]) * e[3] * a / d;
      var va = g.vel[e[0]], vb = g.vel[e[1]];
      va[0] += dx * f; va[1] += dy * f; vb[0] -= dx * f; vb[1] -= dy * f;
      if (three) { va[2] += dz * f; vb[2] -= dz * f; }
    });
    for (i = 0; i < n; i++) {
      var pull = ids[i] === "core" ? 0.08 : 0.006;
      V[i][0] -= P[i][0] * pull * a; V[i][1] -= P[i][1] * pull * a; V[i][2] -= P[i][2] * pull * a;
      V[i][0] *= 0.62; V[i][1] *= 0.62; V[i][2] *= 0.62;
      P[i][0] += V[i][0]; P[i][1] += V[i][1];
      if (three) P[i][2] += V[i][2]; else { P[i][2] *= 0.9; V[i][2] = 0; }
    }
    g.alpha *= 0.992;
  };
  FridayNeural.prototype._project = function (p, cx, cy) {
    var z = this.cam.zoom * this.dpr, x = p[0], y = p[1], d = 0, s = 1;
    if (this.mode3d) {
      var M = this.M;
      var rx = M[0] * x + M[1] * y + M[2] * p[2], ry = M[3] * x + M[4] * y + M[5] * p[2], rz = M[6] * x + M[7] * y + M[8] * p[2];
      s = 520 / Math.max(120, 520 - rz);
      x = rx * s; y = ry * s; d = Math.max(-1, Math.min(1, rz / 260));
    }
    return { x: cx + this.cam.x * this.dpr + x * z, y: cy + this.cam.y * this.dpr + y * z, z: d, s: s };
  };
  FridayNeural.prototype._radius = function (id) {
    var dg = (this._deg && this._deg[id]) || 0;
    if (id === "core") return 9;
    if (this.nodes[id]) return Math.min(11, 3.6 + Math.sqrt(dg) * 1.25);
    return Math.min(7, 2.2 + Math.sqrt(dg) * 0.9);
  };
  FridayNeural.prototype._draw = function (ts) {
    var dt = this._last ? Math.min(0.05, (ts - this._last) / 1000) : 0.016;
    this._last = ts;
    var t = ts / 1000;
    if (this.canvas.clientWidth !== this._cw || this.canvas.clientHeight !== this._ch) this.resize();
    if (this.mode3d && !this.dragging) {
      var idle = 0.05 * (this.active ? 1.8 : 1);
      this.spinY += (idle - this.spinY) * Math.min(1, dt * 1.6);
      this.spinX += (0 - this.spinX) * Math.min(1, dt * 1.6);
      this.turn(this.spinY * dt, this.spinX * dt);
    }
    this._simulate();
    var ctx = this.ctx, w = this.canvas.width, h = this.canvas.height, dpr = this.dpr, self = this;
    var cx = w / 2, cy = h * 0.5, zoom = this.cam.zoom;
    ctx.clearRect(0, 0, w, h);
    var bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6);
    bg.addColorStop(0, this.active ? "rgba(40,28,10,0.45)" : "rgba(24,17,7,0.35)");
    bg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    var E = this._edgeList(), P = {}, nowMs = performance.now();
    Object.keys(this.g.pos).forEach(function (id) {
      var p = self.g.pos[id], sd = (self.nodes[id] && self.nodes[id].seed) || (self.leaves[id] && self.leaves[id].seed) || 0;
      var wob = [p[0] + Math.sin(t * 0.5 + sd) * 0.8, p[1] + Math.cos(t * 0.43 + sd) * 0.8, p[2]];
      var q = self._project(wob, cx, cy);
      P[id] = q;
      if (self.nodes[id]) { self.nodes[id].sx = q.x; self.nodes[id].sy = q.y; self.nodes[id].sz = q.z; self.flash[id] = (self.flash[id] || 0) * Math.exp(-dt * 1.6); }
      else if (self.leaves[id]) { self.leaves[id].sx = q.x; self.leaves[id].sy = q.y; self.leaves[id].sz = q.z; }
    });
    // what's highlighted: the dot you tapped and everything it's linked to (like Obsidian)
    var sel = this.selected && P[this.selected] ? this.selected : null, near = {};
    if (sel) { near[sel] = 1; E.forEach(function (e) { if (e[0] === sel) near[e[1]] = 1; if (e[1] === sel) near[e[0]] = 1; }); }
    function dim(id) { return sel && !near[id] ? 0.18 : 1; }
    function depthA(q) { return self.mode3d ? 0.35 + 0.65 * (q.z + 1) / 2 : 1; }
    // lines
    var lw = Math.max(0.5, Math.min(1.6, 0.8 * Math.sqrt(zoom))) * dpr;
    E.forEach(function (e) {
      var a = P[e[0]], b = P[e[1]];
      if (!a || !b) return;
      var hot = Math.max(self.flash[e[0]] || 0, self.flash[e[1]] || 0);
      var on = sel && (e[0] === sel || e[1] === sel);
      var al = (on ? 0.75 : 0.16 + hot * 0.4) * (on ? 1 : Math.min(dim(e[0]), dim(e[1]))) * Math.min(depthA(a), depthA(b));
      ctx.strokeStyle = on || hot > 0.1 ? rgba(GOLD, al) : rgba([170, 172, 180], al);
      ctx.lineWidth = on ? lw * 1.6 : lw;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    // pulses travel along the lines
    var keep = [];
    this.packets.forEach(function (k) {
      k.t += dt * k.speed;
      if (k.t >= 1) return;
      keep.push(k);
      if (k.t < 0) return;
      var a = P[k.a], b = P[k.b];
      if (!a || !b) return;
      var col = k.silver ? SILVER : GOLD;
      for (var tail = 0; tail < 4; tail++) {
        var tt = Math.max(0, k.t - tail * 0.03);
        ctx.fillStyle = rgba(col, (1 - tail / 4) * 0.8);
        ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * tt, a.y + (b.y - a.y) * tt, (1.8 - tail * 0.3) * dpr, 0, TAU); ctx.fill();
      }
    });
    this.packets = keep.slice(-260);
    if (this.active && Math.random() < 0.06) this.pulse(this.active === "thinking" ? "thinking" : this.active, null, true);
    // dots (back to front in 3D)
    var ids = Object.keys(P);
    if (this.mode3d) ids.sort(function (x, y) { return P[x].z - P[y].z; });
    var labelZoom = zoom / (this._fitZoom || 1);
    ids.forEach(function (id) {
      var q = P[id], node = self.nodes[id], lf = self.leaves[id];
      if (!node && !lf) return;
      var hot = (self.flash[id] || 0);
      var grow = lf && lf.born > 0 ? Math.min(1, (nowMs - lf.born) / 1200) : 1;
      var pop = lf && lf.born > 0 ? Math.max(0, 1 - (nowMs - lf.born) / 6000) : 0;
      var r = self._radius(id) * dpr * Math.max(0.6, Math.min(1.8, Math.sqrt(zoom))) * q.s * grow * (1 + hot * 0.3 + pop * 0.6);
      var kind = node ? node.def.kind : "leaf";
      var col = kind === "core" ? CORE : kind === "phone" ? [190, 205, 230] : node ? GOLD_SOFT : (lf.parent === "memory" ? [226, 228, 236] : [210, 190, 150]);
      var al = dim(id) * depthA(q);
      if (self._glow && (kind === "core" || hot > 0.05 || pop > 0 || id === sel)) {
        var gsz = r * (kind === "core" ? 7 : 5);
        ctx.globalAlpha = Math.min(1, (0.35 + hot * 0.5 + pop * 0.6) * al);
        ctx.drawImage(self._glow, q.x - gsz, q.y - gsz, gsz * 2, gsz * 2);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = rgba(col, (node ? 0.95 : 0.85) * al);
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill();
      if (id === sel) { ctx.strokeStyle = rgba(GOLD, 0.95); ctx.lineWidth = 1.4 * dpr; ctx.beginPath(); ctx.arc(q.x, q.y, r + 4 * dpr, 0, TAU); ctx.stroke(); }
      // names fade in as you zoom, like Obsidian; parts of her show sooner than the small dots
      var label = node ? node.def.label : lf.label;
      var showAt = kind === "core" ? 0 : node ? 0.75 : 1.8;
      var la = sel ? (near[id] ? 1 : 0) : Math.max(0, Math.min(1, (labelZoom - showAt) / 0.35));
      if (pop > 0.25) la = 1;
      if (label && la > 0.02) {
        var fs = (kind === "core" ? 12.5 : node ? 10.5 : 9.5) * dpr * Math.max(0.85, Math.min(1.3, Math.sqrt(zoom)));
        ctx.font = (kind === "core" ? "600 " : "500 ") + fs + "px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0," + (0.6 * la * al).toFixed(3) + ")";
        ctx.fillText(label, q.x + 0.8 * dpr, q.y + r + 12 * dpr + 0.8 * dpr);
        ctx.fillStyle = rgba([232, 230, 226], 0.92 * la * al);
        ctx.fillText(label, q.x, q.y + r + 12 * dpr);
        var badge = node ? self._badge(id) : "";
        if (badge && la > 0.5 && al > 0.5) {
          ctx.font = "600 " + 9.5 * dpr + "px -apple-system, BlinkMacSystemFont, sans-serif";
          var bw = ctx.measureText(badge).width + 9 * dpr, bx = q.x + r + bw / 2, by = q.y - r - 4 * dpr;
          ctx.fillStyle = rgba([24, 20, 12], 0.85);
          ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx - bw / 2, by - 7.5 * dpr, bw, 15 * dpr, 7.5 * dpr) : ctx.rect(bx - bw / 2, by - 7.5 * dpr, bw, 15 * dpr); ctx.fill();
          ctx.fillStyle = rgba(GOLD, 0.95);
          ctx.fillText(badge, bx, by + 3.3 * dpr);
        }
      }
    });
  };

  // ---------- tap, card, log, stats ----------
  FridayNeural.prototype._tap = function (x, y) {
    var best = null, bd = 1e9, self = this;
    Object.keys(this.nodes).forEach(function (id) {
      var n = self.nodes[id];
      var d = Math.hypot(n.sx - x, n.sy - y);
      var lim = (n.def.kind === "core" ? 36 : 26) * self.dpr;
      if (d < lim && d < bd) { bd = d; best = id; }
    });
    Object.keys(this.leaves || {}).forEach(function (id) {
      var lf = self.leaves[id];
      var d = Math.hypot(lf.sx - x, lf.sy - y);
      if (d < 18 * self.dpr && d < bd * 0.8) { bd = d; best = id; }
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
      lf = { def: { label: lf.label, tip: lf.tip, panel: pd.panel, openLabel: pd.label } };
    }
    var n = lf || this.nodes[this.selected];
    if (!n) { card.classList.add("hidden"); return; }
    var d = n.def, self = this;
    card.classList.remove("hidden");
    var key = this.selected + "|" + (lf ? d.tip + "|" + ((this.leaves[this.selected].links || []).join(",")) : this._info(this.selected));
    if (card._key === key) return;
    card._key = key;
    card.innerHTML = "";
    var h = document.createElement("b"); h.textContent = d.label || "Core";
    var p = document.createElement("p"); p.textContent = d.tip || "";
    var liveText = this._info(this.selected);
    if (lf) {
      var real = this.leaves[this.selected], names = [];
      var pn = this.nodes[real.parent] ? this.nodes[real.parent].def.label : "";
      if (pn) names.push(pn);
      (real.links || []).forEach(function (k) { if (self.nodes[k]) names.push(self.nodes[k].def.label); });
      var mates = (this.leafLinks || []).filter(function (L) { return L[0] === self.selected || L[1] === self.selected; }).length;
      liveText = "Learned · connected to " + names.join(", ") + (mates ? " and " + mates + " related memor" + (mates === 1 ? "y" : "ies") : "");
    }
    var live = document.createElement("div"); live.className = "neural-live"; live.textContent = liveText;
    card.appendChild(h); card.appendChild(p); card.appendChild(live);
    if (d.panel && this.onOpen) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn gold"; b.textContent = "Open " + (d.openLabel || d.label || "");
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
