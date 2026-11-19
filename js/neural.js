/* Live neural map: procedural glowing nodes, never a short loop. */
(function (root) {
  "use strict";

  var NODES = [
    { id: "friday", label: "Friday", group: "core" },
    { id: "thinking", label: "Thinking", group: "mind" },
    { id: "memory", label: "Memory", group: "mind" },
    { id: "research", label: "Research", group: "helper" },
    { id: "coding", label: "Coding", group: "helper" },
    { id: "money", label: "Money", group: "helper" },
    { id: "messages", label: "Messages", group: "helper" }
  ];

  function FridayNeural(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.active = null;
    this.running = false;
    this._raf = 0;
    this._t0 = 0;
    this.nodes = NODES.map(function (n, i) {
      var a = (i / NODES.length) * Math.PI * 2 - Math.PI / 2;
      return {
        id: n.id, label: n.label, group: n.group,
        a: a,
        r: n.group === "core" ? 0 : (n.group === "mind" ? 0.28 : 0.46),
        phase: Math.random() * 100,
        seed: Math.random() * 1000,
        pulse: 0
      };
    });
    this.sparks = [];
    var self = this;
    this._onResize = function () { self.resize(); };
    window.addEventListener("resize", this._onResize);
  }

  FridayNeural.prototype.resize = function () {
    var c = this.canvas;
    var parent = c.parentElement;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = parent.clientWidth || window.innerWidth;
    var h = parent.clientHeight || (window.innerHeight - 80);
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    c.style.width = w + "px";
    c.style.height = h + "px";
    this.dpr = dpr;
  };

  FridayNeural.prototype.setActive = function (id) {
    this.active = id || null;
    var self = this;
    this.nodes.forEach(function (n) {
      if (n.id === self.active || (self.active && n.id === "friday") || (self.active && n.id === "thinking")) {
        n.pulse = 1;
      }
    });
  };

  FridayNeural.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.resize();
    var self = this;
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
  };

  FridayNeural.prototype._pos = function (n, t) {
    var w = this.canvas.width, h = this.canvas.height;
    var cx = w / 2, cy = h * 0.48;
    var R = Math.min(w, h) * 0.42;
    // Slow non-repeating wander: incommensurate frequencies + time, not a short cycle.
    var wob = Math.sin(t * 0.13 + n.phase) * 0.04 + Math.sin(t * 0.07 + n.seed) * 0.03;
    var ang = n.a + Math.sin(t * 0.05 + n.seed) * 0.12 + t * 0.01 * (n.group === "helper" ? 1 : 0.4);
    var rr = n.r + wob;
    if (n.group === "core") return { x: cx, y: cy };
    return { x: cx + Math.cos(ang) * R * rr, y: cy + Math.sin(ang) * R * rr * 0.92 };
  };

  FridayNeural.prototype._draw = function (ts) {
    if (!this._t0) this._t0 = ts;
    var t = (ts - this._t0) / 1000;
    var ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    // faint vignette field
    var g = ctx.createRadialGradient(w / 2, h * 0.48, 10, w / 2, h * 0.48, Math.max(w, h) * 0.55);
    g.addColorStop(0, "rgba(20,14,6,0.35)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    var pos = {};
    var self = this;
    this.nodes.forEach(function (n) {
      pos[n.id] = self._pos(n, t);
      n.pulse *= 0.96;
      if (self.active === n.id) n.pulse = Math.max(n.pulse, 0.85);
      if (self.active && (n.id === "friday" || n.id === "thinking")) n.pulse = Math.max(n.pulse, 0.55);
    });

    var edges = [
      ["friday", "thinking"], ["friday", "memory"],
      ["thinking", "research"], ["thinking", "coding"],
      ["thinking", "money"], ["thinking", "messages"],
      ["memory", "friday"], ["research", "friday"]
    ];
    edges.forEach(function (e) {
      var a = pos[e[0]], b = pos[e[1]];
      if (!a || !b) return;
      var hot = self.active && (e[0] === self.active || e[1] === self.active || e[0] === "thinking");
      var gold = hot;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = gold ? "rgba(232,200,114,0.28)" : "rgba(180,190,205,0.12)";
      ctx.lineWidth = (gold ? 1.4 : 0.7) * self.dpr;
      ctx.stroke();
    });

    if (this.active) {
      if (Math.random() < 0.35) {
        var from = pos.friday, to = pos[this.active] || pos.thinking;
        if (from && to) this.sparks.push({ x: from.x, y: from.y, tx: to.x, ty: to.y, life: 0, silver: Math.random() < 0.4 });
      }
    }
    var next = [];
    this.sparks.forEach(function (s) {
      s.life += 0.025 + Math.random() * 0.01;
      if (s.life >= 1) return;
      var x = s.x + (s.tx - s.x) * s.life;
      var y = s.y + (s.ty - s.y) * s.life;
      var r = (2.2 + (1 - s.life) * 2) * self.dpr;
      ctx.beginPath();
      ctx.arc(x, y, r * 3, 0, Math.PI * 2);
      ctx.fillStyle = s.silver ? "rgba(200,210,220,0.08)" : "rgba(232,200,114,0.1)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = s.silver ? "rgba(230,238,248,0.9)" : "rgba(255,208,115,0.95)";
      ctx.fill();
      next.push(s);
    });
    this.sparks = next;

    this.nodes.forEach(function (n) {
      var p = pos[n.id];
      var hot = n.pulse;
      var radius = ((n.group === "core") ? 7.5 : 4.2) * self.dpr * (1 + hot * 0.45);
      var glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 7);
      var col = n.group === "helper" ? "232,200,114" : (n.group === "mind" ? "200,210,224" : "255,214,130");
      glow.addColorStop(0, "rgba(" + col + "," + (0.28 + hot * 0.45) + ")");
      glow.addColorStop(1, "rgba(" + col + ",0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = n.group === "helper" ? "#e8c872" : (n.group === "core" ? "#ffe0a0" : "#dfe6f0");
      ctx.fill();
      ctx.font = (11 * self.dpr) + "px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = "rgba(239,236,232,0.72)";
      ctx.textAlign = "center";
      ctx.fillText(n.label, p.x, p.y + radius + 16 * self.dpr);
    });
  };

  root.FridayNeural = FridayNeural;
})(window);
