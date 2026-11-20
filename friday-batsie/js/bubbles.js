/* Concept 28 floating bubbles, edit mode, and URL / shortcut actions. */
(function (root) {
  "use strict";

  var ICONS = {
    lights: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 1 4.2 10.1c-.6.6-1.2 1.6-1.2 2.6h-6c0-1-.6-2-1.2-2.6A6 6 0 0 1 12 3z"/></svg>',
    timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="13" r="7"/><path d="M12 13V9M9 3h6"/></svg>',
    tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8"/></svg>',
    alarm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="13" r="7"/><path d="M12 13V9M5 6 3 4M19 6l2-2"/></svg>',
    cameras: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="8"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></svg>',
    music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2.2"/><circle cx="17" cy="16" r="2.2"/></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 3v18M16 7.5c0-2-1.8-3.2-4-3.2S8 5.5 8 7.2s1.6 2.8 4 3.3 4 1.6 4 3.4-1.8 3.3-4 3.3-4-1.2-4-3.3"/></svg>',
    memory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 4c4 4 4 8 0 16-4-8-4-12 0-16z"/><path d="M8 11h8"/></svg>',
    notes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 4h8l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M15 4v6h6M8 13h8M8 17h6"/></svg>',
    automations: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 8h6l2-3h6"/><path d="M4 16h7l2-3h7"/><circle cx="6" cy="8" r="2"/><circle cx="8" cy="16" r="2"/></svg>',
    weather: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="3.2"/><path d="M10 4.2V3M10 17v-1.2M4.2 10H3M17 10h-1.2M5.6 5.6 4.8 4.8M15.2 15.2l-.8-.8M15.2 5.6l.8-.8"/><path d="M14 13.5a4 4 0 0 1 1 7.5H8.5A3.5 3.5 0 0 1 8 14"/></svg>',
    messages: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-5 4V6.5z"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.5.1l1.4-1.4a5 5 0 0 0-7.1-7.1L10.5 6"/><path d="M14 11a5 5 0 0 0-7.5-.1L5.1 12.3a5 5 0 0 0 7.1 7.1L13.5 18"/></svg>'
  };

  // Concept 28 layout in 590-space, recentered around the orb.
  var LAYOUT = [
    [253.0, 208.0], [375.0, 190.4], [382.9, 283.0], [481.0, 374.0],
    [382.9, 433.0], [375.0, 557.6], [253.0, 508.0], [163.0, 557.6],
    [123.1, 433.0], [57.0, 374.0], [123.1, 283.0], [163.0, 190.4]
  ];
  var CX = 0, CY = 0;
  (function () {
    var i, sx = 0, sy = 0;
    for (i = 0; i < LAYOUT.length; i++) { sx += LAYOUT[i][0]; sy += LAYOUT[i][1]; }
    CX = sx / LAYOUT.length;
    CY = sy / LAYOUT.length;
  })();

  var PRESETS = [
    { kind: "lights", label: "Lights", gold: true, size: "lg", action: "shortcut", command: "lights on" },
    { kind: "timer", label: "Timer", gold: false, size: "sm", action: "panel", panel: "timer" },
    { kind: "tv", label: "TV", gold: false, size: "lg", action: "shortcut", command: "tv on" },
    { kind: "alarm", label: "Alarm", gold: true, size: "sm", action: "shortcut", command: "set an alarm" },
    { kind: "cameras", label: "Cameras", gold: true, size: "lg", action: "shortcut", command: "cameras" },
    { kind: "chat", label: "Chat", gold: false, size: "sm", action: "panel", panel: "chat" },
    { kind: "music", label: "Music", gold: false, size: "lg", action: "url", url: "music://" },
    { kind: "money", label: "Money", gold: true, size: "sm", action: "panel", panel: "money" },
    { kind: "memory", label: "Memory", gold: true, size: "lg", action: "panel", panel: "memory" },
    { kind: "notes", label: "Notes", gold: false, size: "sm", action: "panel", panel: "notes" },
    { kind: "automations", label: "Automations", gold: false, size: "lg", action: "url", url: "shortcuts://" },
    { kind: "weather", label: "Weather", gold: true, size: "sm", action: "shortcut", command: "weather" },
    { kind: "messages", label: "Daddy", gold: true, size: "lg", action: "url", url: "sms:" }
  ];

  function uid() { return "b" + Math.random().toString(36).slice(2, 9); }

  function defaultBubbles(profile) {
    var list = (root.FRIDAY_CONFIG.DEFAULT_BUBBLES[profile.id] || root.FRIDAY_CONFIG.DEFAULT_BUBBLES.sky).map(function (b, i) {
      var c = Object.assign({ slot: i }, b);
      if (!c.id) c.id = uid();
      return c;
    });
    if (profile.id === "batsie") {
      list.forEach(function (b) {
        if (b.id === "daddy") {
          var num = (root.FridayStorage.get("settings", {}).daddySms) || profile.daddySms || "sms:";
          b.url = num.indexOf("sms:") === 0 ? num : ("sms:" + String(num).replace(/[^\d+]/g, ""));
        }
      });
    }
    return list;
  }

  function FridayBubbles(opts) {
    this.el = opts.el;
    this.profile = opts.profile;
    this.onAction = opts.onAction || function () {};
    this.onAddRequest = opts.onAddRequest || function () {};
    this.edit = false;
    this.list = root.FridayStorage.get("bubbles", null);
    if (!this.list || !this.list.length) this.list = defaultBubbles(this.profile);
    // migration: give Sky a real Messages bubble if the saved layout predates it
    if (this.profile.id === "sky" && !this.list.some(function (b) { return b.kind === "messages"; })) {
      this.list.push({ id: "texts", kind: "messages", label: "Messages", gold: true, size: "lg", action: "url", url: "sms:", slot: this.list.length });
      root.FridayStorage.set && root.FridayStorage.set("bubbles", this.list);
    }
    this._floatT0 = performance.now();
    this._slots = [];
    this.mode = "orbit";
    this.revealed = true;
    this._flow = false;
    this._slotUnit = "scaled";
    this.onLayout = opts.onLayout || function () {};
    this.frameFor = opts.frameFor || function () { return null; };
    this._fit = 1;
    this.render();
    var self = this;
    this._onResize = function () { self.layout(); };
    window.addEventListener("resize", this._onResize);
    this._bindReveal();
    this._raf = requestAnimationFrame(function tick(ts) {
      self._tick(ts);
      self._raf = requestAnimationFrame(tick);
    });
  }

  FridayBubbles.prototype.scale = function () {
    var m = Math.min(window.innerWidth, window.innerHeight);
    return m / 590 * 0.92;
  };

  var FLOW = { dock: 1, grid: 1, home: 1, list: 1, sheet: 1 };

  FridayBubbles.prototype._effectiveMode = function () {
    if (this.mode === "orbonly") return (this.revealed || this.edit) ? "dock" : "orbonly";
    return this.mode || "orbit";
  };

  FridayBubbles.prototype._stageClass = function () {
    var stage = document.getElementById("stage");
    if (!stage) return;
    Array.prototype.slice.call(stage.classList).forEach(function (c) {
      if (c.indexOf("layout-") === 0 || c === "bubbles-revealed" || c === "flow-tray") stage.classList.remove(c);
    });
    stage.classList.add("layout-" + (this.mode || "orbit"));
    var eff = this._effectiveMode();
    if (FLOW[eff]) stage.classList.add("flow-tray");
    if (this.mode === "orbonly" && (this.revealed || this.edit)) stage.classList.add("bubbles-revealed");
  };

  FridayBubbles.prototype._bindReveal = function () {
    var self = this;
    var zone = document.getElementById("reveal-zone");
    if (!zone) return;
    var y0 = 0, x0 = 0, tracking = false;
    zone.addEventListener("touchstart", function (e) {
      if (self.mode !== "orbonly" || !e.touches[0]) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      tracking = true;
    }, { passive: true });
    zone.addEventListener("touchend", function (e) {
      if (!tracking) return;
      tracking = false;
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      var dy = t.clientY - y0, dx = t.clientX - x0;
      if (Math.abs(dx) > Math.abs(dy)) return;
      if (dy < -48) self.setRevealed(true);
      else if (dy > 48 && !self.edit) self.setRevealed(false);
    }, { passive: true });
  };

  FridayBubbles.prototype.setLayout = function (mode) {
    this.mode = mode || "orbit";
    this.revealed = this.mode !== "orbonly";
    this._stageClass();
    this.onLayout(this.mode, this.revealed);
    this.render();
  };

  FridayBubbles.prototype.setRevealed = function (on) {
    this.revealed = !!on;
    this._stageClass();
    this.onLayout(this.mode, this.revealed);
    this.layout();
  };

  // Screen band the floating bubbles may use, in px relative to the orb center.
  FridayBubbles.prototype._bounds = function () {
    var w = window.innerWidth, h = window.innerHeight;
    var f = this.frameFor(this._effectiveMode()) || { cyN: 0.46, radiusK: 0.28 };
    var cy = h * f.cyN;
    var top = 64, bottom = h - 150;
    var bar = document.querySelector("#chrome .actions");
    if (bar) { var br = bar.getBoundingClientRect(); if (br.bottom > 0) top = br.bottom + 8; }
    var chips = document.getElementById("chips");
    if (chips && chips.offsetParent !== null && chips.children.length) {
      var cr = chips.getBoundingClientRect();
      if (cr.top > cy) bottom = Math.min(bottom, cr.top - 4);
    }
    return {
      l: -w / 2 + 6, r: w / 2 - 6, t: top - cy, b: bottom - cy,
      orbR: f.radiusK * Math.min(w, h) * 1.02 + 4
    };
  };

  // Push circles apart, off the orb and the Add spot, inside the band.
  function relax(pts, rad, B, fixed) {
    var it, i, j, n = pts.length, gap = 6;
    for (it = 0; it < 260; it++) {
      for (i = 0; i < n; i++) {
        for (j = i + 1; j < n; j++) {
          var dx = pts[j][0] - pts[i][0], dy = pts[j][1] - pts[i][1];
          var d = Math.sqrt(dx * dx + dy * dy), m = rad * 2 + gap;
          if (d < m) {
            if (d < 0.01) { dx = Math.cos(i + j); dy = Math.sin(i + j); d = 1; }
            var push = (m - d) / 2 / d;
            pts[i][0] -= dx * push; pts[i][1] -= dy * push;
            pts[j][0] += dx * push; pts[j][1] += dy * push;
          }
        }
        var obs = [[0, 0, B.orbR + rad]];
        if (fixed) obs.push([fixed[0], fixed[1], fixed[2] + rad + gap]);
        obs.forEach(function (o) {
          var ox = pts[i][0] - o[0], oy = pts[i][1] - o[1];
          var od = Math.sqrt(ox * ox + oy * oy);
          if (od < o[2]) {
            if (od < 0.01) { ox = Math.cos(i * 2.4); oy = Math.sin(i * 2.4); od = 1; }
            pts[i][0] = o[0] + ox / od * o[2];
            pts[i][1] = o[1] + oy / od * o[2];
          }
        });
        pts[i][0] = Math.max(B.l + rad, Math.min(B.r - rad, pts[i][0]));
        pts[i][1] = Math.max(B.t + rad, Math.min(B.b - rad, pts[i][1]));
      }
    }
    for (i = 0; i < n; i++) {
      if (Math.hypot(pts[i][0], pts[i][1]) < B.orbR + rad - 1) return false;
      if (fixed && Math.hypot(pts[i][0] - fixed[0], pts[i][1] - fixed[1]) < fixed[2] + rad - 1) return false;
      for (j = i + 1; j < n; j++) if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < rad * 2 - 1) return false;
    }
    return true;
  }

  FridayBubbles.prototype._computeModeSlots = function () {
    var mode = this._effectiveMode();
    var n = Math.max(this.list.length, 1);
    var s = this.scale();
    var i, a, r, t, pts = [];
    this._flow = !!FLOW[mode];
    this._slotUnit = "px";
    this._fit = 1;
    if (this._flow) {
      // Flow layouts position with CSS. Placeholder slots keep drag swaps working.
      for (i = 0; i < n; i++) pts.push([i * 80, 0]);
      this._slots = pts;
      this._addPos = null;
      return;
    }
    var B = this._bounds();
    var rx = Math.min(B.r, -B.l), ryUp = -B.t, ryDn = B.b;
    var rad = 60 * s;
    var addR = 30 * s + 6;
    var add = [0, B.b - addR, addR];
    for (var tries = 0; tries < 6; tries++) {
      pts = [];
      var ring1 = B.orbR + rad + 6;
      if (mode === "orbit") {
        for (i = 0; i < n; i++) {
          if (i < LAYOUT.length) pts.push([(LAYOUT[i][0] - CX) * s * 1.25, (LAYOUT[i][1] - CY) * s * 1.25]);
          else { a = (i - LAYOUT.length + 0.5) * 2.1; pts.push([Math.cos(a) * rx * 0.8, Math.sin(a) * ryUp * 0.8]); }
        }
      } else if (mode === "double") {
        var mid = Math.ceil(n * 0.42);
        for (i = 0; i < n; i++) {
          var outer = i >= mid, idx = outer ? i - mid : i, cnt = outer ? n - mid : mid;
          a = -Math.PI / 2 + (idx / Math.max(cnt, 1)) * Math.PI * 2 + (outer ? Math.PI / cnt : 0);
          r = outer ? ring1 + rad * 2 + 8 : ring1;
          pts.push([Math.cos(a) * Math.min(r, rx - rad), Math.sin(a) * r]);
        }
      } else if (mode === "arc") {
        for (i = 0; i < n; i++) {
          a = Math.PI * 0.08 + (n <= 1 ? 0.42 : i / (n - 1)) * Math.PI * 0.84;
          r = ring1 + (i % 2) * rad * 1.6;
          pts.push([Math.cos(a) * Math.min(r, rx), Math.sin(a) * r]);
        }
      } else if (mode === "spiral") {
        for (i = 0; i < n; i++) {
          t = i / Math.max(n - 1, 1);
          a = -Math.PI / 2 + t * Math.PI * 3.2;
          r = ring1 + t * rad * 2.2;
          pts.push([Math.cos(a) * Math.min(r, rx), Math.sin(a) * r]);
        }
      } else {
        // ring (and the hidden orb-only state)
        for (i = 0; i < n; i++) {
          a = -Math.PI / 2 + (i / n) * Math.PI * 2;
          pts.push([Math.cos(a) * Math.min(ring1 * 1.05, rx - rad), Math.sin(a) * (Math.sin(a) < 0 ? Math.min(ryUp - rad, ring1 * 1.3) : Math.min(ryDn - rad, ring1 * 1.3))]);
        }
      }
      if (relax(pts, rad, B, add)) break;
      // Too crowded: shrink everything and try again.
      rad *= 0.88; addR *= 0.9; add = [0, B.b - addR, addR];
      this._fit *= 0.88;
      B.orbR *= 0.96;
    }
    this._slots = pts;
    this._addPos = add;
  };

  FridayBubbles.prototype.layout = function () {
    this._computeModeSlots();
    this._stageClass();
    var s = this.scale();
    var nodes = this.el.querySelectorAll(".bubble[data-id]");
    var self = this;
    var mode = this._effectiveMode();
    var bySlot = this.list.slice().sort(function (a, b) { return (a.slot || 0) - (b.slot || 0); });
    var dockIds = {};
    if (mode === "home") {
      bySlot.slice(0, 4).forEach(function (b) { dockIds[b.id] = true; });
    }
    var dockIndex = 0;
    var dockRow = Math.ceil(Math.max(this.list.length - 4, 0) / 4) + 1;
    nodes.forEach(function (node) {
      var b = self.byId(node.getAttribute("data-id"));
      if (!b) return;
      var szScale = mode === "list" || mode === "sheet" ? 0.72 : 1;
      var sz = (b.size === "sm" ? 52 : 84) * s * (self._flow ? 0.85 : self._fit) * szScale;
      if (mode === "grid" || mode === "home") sz = 58 * s;
      node.style.setProperty("--sz", sz + "px");
      if (mode === "home") {
        if (dockIds[b.id]) {
          node.setAttribute("data-dock", "1");
          node.style.gridColumn = String((dockIndex++ % 4) + 1);
          node.style.gridRow = String(dockRow);
        } else {
          node.removeAttribute("data-dock");
          node.style.gridColumn = "";
          node.style.gridRow = "";
        }
      } else {
        node.removeAttribute("data-dock");
        node.style.gridColumn = "";
        node.style.gridRow = "";
      }
      if (self._flow) {
        node.dataset.baseX = "0";
        node.dataset.baseY = "0";
        node.style.transform = "none";
        return;
      }
      var slot = self._slots[b.slot] || self._slots[(b.slot || 0) % self._slots.length] || [0, 0];
      node.dataset.baseX = slot[0];
      node.dataset.baseY = slot[1];
      if (!node.classList.contains("dragging")) node.style.transform = "translate(calc(-50% + " + slot[0] + "px), calc(-50% + " + slot[1] + "px))";
    });
    var add = this.el.querySelector(".add-bubble");
    if (add) {
      if (this._flow) {
        add.style.transform = "none";
        add.style.setProperty("--sz", (52 * s) + "px");
      } else {
        var ap = this._addPos || [0, 200, 30];
        add.style.setProperty("--sz", (52 * s * this._fit) + "px");
        add.style.transform = "translate(calc(-50% + " + ap[0] + "px), calc(-50% + " + ap[1] + "px))";
      }
    }
  };

  FridayBubbles.prototype.byId = function (id) {
    for (var i = 0; i < this.list.length; i++) if (this.list[i].id === id) return this.list[i];
    return null;
  };

  FridayBubbles.prototype.save = function () {
    root.FridayStorage.set("bubbles", this.list);
  };

  FridayBubbles.prototype.render = function () {
    var self = this;
    this.el.innerHTML = "";
    this._normalizeSlots();
    this.list.slice().sort(function (a, b) { return a.slot - b.slot; }).forEach(function (b) {
      self.el.appendChild(self._node(b));
    });
    if (this.edit) this.el.appendChild(this._addNode());
    this.el.classList.toggle("edit-on", this.edit);
    document.getElementById("stage").classList.toggle("edit-on", this.edit);
    this.layout();
  };

  // Every bubble gets its own slot 0..n-1. Repairs stacked or duplicate saved slots.
  FridayBubbles.prototype._normalizeSlots = function () {
    var changed = false;
    var order = this.list.map(function (b, i) { return { b: b, i: i }; });
    order.sort(function (x, y) {
      var a = typeof x.b.slot === "number" ? x.b.slot : 1e6 + x.i;
      var c = typeof y.b.slot === "number" ? y.b.slot : 1e6 + y.i;
      return a - c || x.i - y.i;
    });
    order.forEach(function (o, k) { if (o.b.slot !== k) { o.b.slot = k; changed = true; } });
    if (changed) this.save();
  };

  FridayBubbles.prototype._node = function (b) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bubble" + (b.gold ? " gold" : "");
    btn.setAttribute("data-id", b.id);
    btn.setAttribute("aria-label", b.label || b.kind);
    var icon = ICONS[b.kind] || ICONS.link;
    btn.innerHTML = '<span class="orb">' + icon + '</span>' +
      (b.label ? '<span class="label">' + escapeHtml(b.label) + "</span>" : "") +
      '<button type="button" class="badge" aria-label="Remove">–</button>';
    this._bind(btn, b);
    return btn;
  };

  FridayBubbles.prototype._addNode = function () {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bubble add-bubble";
    btn.innerHTML = '<span class="orb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 6v12M6 12h12"/></svg></span><span class="label">Add</span>';
    var self = this;
    btn.addEventListener("click", function () { self.onAddRequest(); });
    return btn;
  };

  FridayBubbles.prototype._bind = function (btn, b) {
    var self = this;
    var timer = 0;
    var startX = 0, startY = 0, moved = false;
    function down(ev) {
      var t = ev.touches ? ev.touches[0] : ev;
      startX = t.clientX; startY = t.clientY; moved = false;
      if (self.edit) {
        self._beginDrag(btn, b, t);
        return;
      }
      timer = setTimeout(function () {
        timer = 0;
        self.setEdit(true);
      }, 430);
    }
    function move(ev) {
      var t = ev.touches ? ev.touches[0] : ev;
      if (Math.hypot(t.clientX - startX, t.clientY - startY) > 8) {
        moved = true;
        if (timer) { clearTimeout(timer); timer = 0; }
      }
    }
    function up(ev) {
      if (timer) { clearTimeout(timer); timer = 0; }
      if (!self.edit && !moved) self.activate(b);
    }
    btn.addEventListener("touchstart", down, { passive: true });
    btn.addEventListener("mousedown", down);
    btn.addEventListener("touchmove", move, { passive: true });
    btn.addEventListener("mousemove", move);
    btn.addEventListener("touchend", up);
    btn.addEventListener("mouseup", up);
    btn.querySelector(".badge").addEventListener("click", function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      self.remove(b.id);
    });
  };

  FridayBubbles.prototype._beginDrag = function (btn, b, t) {
    var self = this;
    btn.classList.add("dragging");
    var moved = false;
    function pos(ev) {
      var p = ev.touches ? ev.touches[0] : ev;
      var rect = self.el.getBoundingClientRect();
      var x = p.clientX - rect.left;
      var y = p.clientY - rect.top;
      btn.style.transform = "translate(calc(-50% + " + x + "px), calc(-50% + " + y + "px))";
      moved = true;
      var nearest = self._nearestSlot(x, y, b.slot);
      if (nearest != null && nearest !== b.slot) {
        var other = self.list.filter(function (x) { return x.slot === nearest; })[0];
        if (other) {
          other.slot = b.slot;
          b.slot = nearest;
          self.save();
          self._relayoutOthers(btn);
        }
      }
    }
    function end() {
      document.removeEventListener("touchmove", pos);
      document.removeEventListener("mousemove", pos);
      document.removeEventListener("touchend", end);
      document.removeEventListener("mouseup", end);
      btn.classList.remove("dragging");
      self.layout();
    }
    document.addEventListener("touchmove", pos, { passive: true });
    document.addEventListener("mousemove", pos);
    document.addEventListener("touchend", end);
    document.addEventListener("mouseup", end);
  };

  FridayBubbles.prototype._relayoutOthers = function (except) {
    if (this._flow) return;
    var self = this;
    this.el.querySelectorAll(".bubble[data-id]").forEach(function (node) {
      if (node === except) return;
      var b = self.byId(node.getAttribute("data-id"));
      if (!b) return;
      var slot = self._slots[b.slot] || [0, 0];
      var px = slot[0], py = slot[1];
      node.dataset.baseX = px;
      node.dataset.baseY = py;
      node.style.transform = "translate(calc(-50% + " + px + "px), calc(-50% + " + py + "px))";
    });
  };

  FridayBubbles.prototype._nearestSlot = function (x, y, cur) {
    if (this._flow) {
      var els = this.el.querySelectorAll(".bubble[data-id]");
      var best = 0, bd = 1e9, i, r, cx, cy, d, b;
      var rect = this.el.getBoundingClientRect();
      for (i = 0; i < els.length; i++) {
        r = els[i].getBoundingClientRect();
        cx = r.left + r.width / 2 - rect.left;
        cy = r.top + r.height / 2 - rect.top;
        d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
        if (d < bd) {
          bd = d;
          b = this.byId(els[i].getAttribute("data-id"));
          best = b && b.slot != null ? b.slot : i;
        }
      }
      return best;
    }
    var best = 0, bd = 1e9, i, n = Math.min(this._slots.length, this.list.length);
    for (i = 0; i < n; i++) {
      var dx = this._slots[i][0] - x, dy = this._slots[i][1] - y;
      var d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    // Small dead zone so a bubble doesn't flip back and forth between two slots.
    var own = this._slots[cur];
    if (own && best !== cur) {
      var od = (own[0] - x) * (own[0] - x) + (own[1] - y) * (own[1] - y);
      if (Math.sqrt(od) - Math.sqrt(bd) < 14) return cur;
    }
    return best;
  };

  /* Stop/restart the floating animation (used when Friday isn't on screen). */
  FridayBubbles.prototype.pause = function () {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  };
  FridayBubbles.prototype.resume = function () {
    if (this._raf) return;
    var self = this;
    this._raf = requestAnimationFrame(function tick(ts) {
      self._tick(ts);
      self._raf = requestAnimationFrame(tick);
    });
  };

  FridayBubbles.prototype._tick = function (ts) {
    if (this.edit || this._flow) return;
    var mode = this._effectiveMode();
    var floaty = mode === "orbit" || mode === "ring" || mode === "double" || mode === "arc" || mode === "spiral";
    var t = (ts - this._floatT0) / 1000;
    var nodes = this.el.querySelectorAll(".bubble[data-id]");
    nodes.forEach(function (node, i) {
      var x = parseFloat(node.dataset.baseX || "0");
      var y = parseFloat(node.dataset.baseY || "0");
      var fx = floaty ? Math.sin(t * 0.7 + i * 1.17) * 2.4 : 0;
      var fy = floaty ? Math.cos(t * 0.9 + i * 0.83) * 3.2 : 0;
      node.style.transform = "translate(calc(-50% + " + (x + fx) + "px), calc(-50% + " + (y + fy) + "px))";
    });
  };

  FridayBubbles.prototype.setEdit = function (on) {
    this.edit = !!on;
    if (this.edit && this.mode === "orbonly") this.revealed = true;
    this._stageClass();
    this.onLayout(this.mode, this.revealed);
    this.render();
  };

  FridayBubbles.prototype.remove = function (id) {
    this.list = this.list.filter(function (b) { return b.id !== id; });
    this.save();
    this.render();
  };

  FridayBubbles.prototype.add = function (spec) {
    var b = Object.assign({ id: uid(), gold: true, size: "lg", kind: "link", label: "Link", action: "url", url: "#" }, spec);
    b.slot = this.list.length;
    this.list.push(b);
    this.save();
    this.render();
  };

  FridayBubbles.prototype.resetLayout = function () {
    this.list = defaultBubbles(this.profile);
    this.save();
    this.render();
  };

  FridayBubbles.prototype.presets = function () { return PRESETS; };

  FridayBubbles.prototype.activate = function (b) {
    if (this.edit) return;
    if (b.action === "panel") this.onAction({ type: "panel", panel: b.panel, bubble: b });
    else if (b.action === "shortcut") this.onAction({ type: "shortcut", command: b.command, bubble: b });
    else if (b.action === "url") this.onAction({ type: "url", url: this._resolveUrl(b), bubble: b });
  };

  FridayBubbles.prototype._resolveUrl = function (b) {
    if (b.id === "daddy" || b.kind === "messages" && (b.label || "").toLowerCase().indexOf("daddy") >= 0) {
      var s = root.FridayStorage.get("settings", {});
      var num = s.daddySms || this.profile.daddySms || b.url || "sms:";
      return num.indexOf("sms:") === 0 ? num : ("sms:" + String(num).replace(/[^\d+]/g, ""));
    }
    return b.url;
  };

  FridayBubbles.prototype.syncDaddy = function () {
    var self = this;
    this.list.forEach(function (b) {
      if (b.id === "daddy") b.url = self._resolveUrl(b);
    });
    this.save();
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  root.FridayBubbles = FridayBubbles;
  root.FridayBubbleIcons = ICONS;
})(window);
