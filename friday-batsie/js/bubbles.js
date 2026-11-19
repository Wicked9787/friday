/* Concept 28 floating bubbles, edit mode, and URL / shortcut actions. */
(function (root) {
  "use strict";

  var ICONS = {
    lights: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 1 4.2 10.1c-.6.6-1.2 1.6-1.2 2.6h-6c0-1-.6-2-1.2-2.6A6 6 0 0 1 12 3z"/></svg>',
    timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="13" r="7"/><path d="M12 13V9M9 3h6"/></svg>',
    tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8"/></svg>',
    alarm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="13" r="7"/><path d="M12 13V9M5 6 3 4M19 6l2-2"/></svg>',
    cameras: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="8"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 16.5V7.8A2.8 2.8 0 0 1 7.8 5h8.4A2.8 2.8 0 0 1 19 7.8v5.2A2.8 2.8 0 0 1 16.2 16H9l-4 3.2z"/></svg>',
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
    this._floatT0 = performance.now();
    this._slots = LAYOUT.map(function (p) { return [p[0] - CX, p[1] - CY]; });
    this.render();
    var self = this;
    this._onResize = function () { self.layout(); };
    window.addEventListener("resize", this._onResize);
    this._raf = requestAnimationFrame(function tick(ts) {
      self._tick(ts);
      self._raf = requestAnimationFrame(tick);
    });
  }

  FridayBubbles.prototype.scale = function () {
    var m = Math.min(window.innerWidth, window.innerHeight);
    return m / 590 * 0.92;
  };

  FridayBubbles.prototype.layout = function () {
    var s = this.scale();
    var nodes = this.el.querySelectorAll(".bubble[data-id]");
    var self = this;
    nodes.forEach(function (node) {
      var b = self.byId(node.getAttribute("data-id"));
      if (!b) return;
      var slot = self._slots[b.slot % self._slots.length] || [0, 0];
      var px = slot[0] * s;
      var py = slot[1] * s;
      node.dataset.baseX = px;
      node.dataset.baseY = py;
      var sz = (b.size === "sm" ? 52 : 84) * s;
      node.style.setProperty("--sz", sz + "px");
      if (!self.edit) node.style.transform = "translate(calc(-50% + " + px + "px), calc(-50% + " + py + "px))";
    });
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
    this.list.forEach(function (b, i) {
      if (b.slot == null) b.slot = i;
      self.el.appendChild(self._node(b));
    });
    if (this.edit) this.el.appendChild(this._addNode());
    this.el.classList.toggle("edit-on", this.edit);
    document.getElementById("stage").classList.toggle("edit-on", this.edit);
    this.layout();
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
    var used = this.list.length;
    var slot = this._slots[used % this._slots.length] || [0, 220];
    btn.dataset.baseX = slot[0];
    btn.dataset.baseY = slot[1];
    btn.innerHTML = '<span class="orb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 6v12M6 12h12"/></svg></span><span class="label">Add</span>';
    var self = this;
    btn.addEventListener("click", function () { self.onAddRequest(); });
    var s = this.scale();
    var extra = this._slots[Math.min(used, this._slots.length - 1)];
    // Park the add bubble just below the ring.
    btn.style.setProperty("--sz", 52 * s + "px");
    btn.style.transform = "translate(-50%, calc(-50% + " + (150 * s) + "px))";
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
      var nearest = self._nearestSlot(x, y);
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
    var s = this.scale();
    var self = this;
    this.el.querySelectorAll(".bubble[data-id]").forEach(function (node) {
      if (node === except) return;
      var b = self.byId(node.getAttribute("data-id"));
      if (!b) return;
      var slot = self._slots[b.slot % self._slots.length];
      var px = slot[0] * s, py = slot[1] * s;
      node.dataset.baseX = px;
      node.dataset.baseY = py;
      node.style.transform = "translate(calc(-50% + " + px + "px), calc(-50% + " + py + "px))";
    });
  };

  FridayBubbles.prototype._nearestSlot = function (x, y) {
    var s = this.scale();
    var best = 0, bd = 1e9, i;
    for (i = 0; i < this._slots.length; i++) {
      var dx = this._slots[i][0] * s - x, dy = this._slots[i][1] * s - y;
      var d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };

  FridayBubbles.prototype._tick = function (ts) {
    if (this.edit) return;
    var t = (ts - this._floatT0) / 1000;
    var nodes = this.el.querySelectorAll(".bubble[data-id]");
    nodes.forEach(function (node, i) {
      var x = parseFloat(node.dataset.baseX || "0");
      var y = parseFloat(node.dataset.baseY || "0");
      var fx = Math.sin(t * 0.7 + i * 1.17) * 2.4;
      var fy = Math.cos(t * 0.9 + i * 0.83) * 3.2;
      node.style.transform = "translate(calc(-50% + " + (x + fx) + "px), calc(-50% + " + (y + fy) + "px))";
    });
  };

  FridayBubbles.prototype.setEdit = function (on) {
    this.edit = !!on;
    this.render();
  };

  FridayBubbles.prototype.remove = function (id) {
    this.list = this.list.filter(function (b) { return b.id !== id; });
    this.save();
    this.render();
  };

  FridayBubbles.prototype.add = function (spec) {
    var b = Object.assign({ id: uid(), gold: true, size: "lg", kind: "link", label: "Link", action: "url", url: "#" }, spec);
    var used = {};
    this.list.forEach(function (x) { used[x.slot] = true; });
    b.slot = 0;
    for (var i = 0; i < this._slots.length; i++) if (!used[i]) { b.slot = i; break; }
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
