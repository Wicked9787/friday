/* In-app timer, notes, and memory lists. */
(function (root) {
  "use strict";

  function beep() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      var ctx = new Ctx();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 1);
      setTimeout(function () { ctx.close(); }, 1200);
    } catch (e) {}
  }

  function FridayTools(opts) {
    this.onToast = (opts && opts.onToast) || function () {};
    this._timer = null;
    this._remain = 0;
    this._end = 0;
    this.display = document.getElementById("timer-display");
    this._tick = this._tick.bind(this);
  }

  FridayTools.prototype.startTimer = function (seconds) {
    seconds = Math.max(1, parseInt(seconds, 10) || 0);
    this.cancelTimer(true);
    this._remain = seconds;
    this._end = Date.now() + seconds * 1000;
    this._show(seconds);
    var self = this;
    this._timer = setInterval(this._tick, 200);
    this.onToast("Timer started");
  };

  FridayTools.prototype._tick = function () {
    var left = Math.max(0, Math.ceil((this._end - Date.now()) / 1000));
    this._remain = left;
    this._show(left);
    if (left <= 0) {
      this.cancelTimer(true);
      beep();
      this.onToast("Time's up.");
    }
  };

  FridayTools.prototype._show = function (sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    if (this.display) this.display.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  };

  FridayTools.prototype.cancelTimer = function (silent) {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    if (!silent) this._show(0);
  };

  FridayTools.prototype.notes = function () {
    return root.FridayStorage.get("notes", []);
  };
  FridayTools.prototype.addNote = function (text) {
    text = String(text || "").trim();
    if (!text) return;
    var list = this.notes();
    list.unshift({ text: text, at: new Date().toISOString() });
    root.FridayStorage.set("notes", list);
  };
  FridayTools.prototype.removeNote = function (i) {
    var list = this.notes();
    list.splice(i, 1);
    root.FridayStorage.set("notes", list);
  };

  function fmt(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch (e) { return ""; }
  }

  FridayTools.prototype.renderList = function (el, items, onDelete) {
    el.innerHTML = "";
    if (!items.length) {
      el.innerHTML = '<p class="hint">Nothing here yet.</p>';
      return;
    }
    items.forEach(function (item, i) {
      var card = document.createElement("div");
      card.className = "list-card";
      var x = document.createElement("button");
      x.className = "x";
      x.type = "button";
      x.setAttribute("aria-label", "Delete");
      x.textContent = "×";
      x.addEventListener("click", function () { onDelete(i); });
      var p = document.createElement("p");
      p.textContent = item.text;
      var meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = fmt(item.at);
      card.appendChild(x);
      card.appendChild(p);
      card.appendChild(meta);
      el.appendChild(card);
    });
  };

  root.FridayTools = FridayTools;
})(window);
