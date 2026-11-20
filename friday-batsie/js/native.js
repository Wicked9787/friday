/* Friday 3.1: the parts of the iPhone she can now reach directly (no Shortcut).
   Each one is a built-in add-on in the app shell. If an add-on or permission isn't
   there, the function says so and the app falls back to the Shortcut like before.
     notifications: timers, bills and countdowns ring even when the app is closed
     reminders and calendar: add reminders, add events, read today's events
     battery: level and charging
     contacts: names only, kept on this phone, so texts and calls find the right person
     home: lights to an exact brightness, on/off, scenes (works only if iOS allows it) */
(function (root) {
  "use strict";

  function S() { return root.FridayStorage; }
  function fire(n, detail) { try { root.dispatchEvent(new CustomEvent(n, { detail: detail })); } catch (e) {} }
  function cap() {
    var c = root.Capacitor;
    return c && c.isNativePlatform && c.isNativePlatform() && c.Plugins ? c.Plugins : null;
  }
  function plugin(name) { var p = cap(); return p && p[name] ? p[name] : null; }
  function appName() {
    var p = root.FRIDAY_CONFIG && root.FRIDAY_CONFIG.getProfile ? root.FRIDAY_CONFIG.getProfile() : null;
    return (p && p.assistantName) || "Friday";
  }
  function hashId(str) {
    var h = 0;
    str = String(str || "");
    for (var i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
    return Math.abs(h) % 2000000000 + 1;
  }
  function granted(st) { return st === "granted" || st === "limited"; }

  // ---------- notifications ----------
  var notify = {
    available: function () { return !!plugin("LocalNotifications"); },
    allowed: function () { return S().get("notifyAllowed", false) === true && notify.available(); },
    ask: async function () {
      var P = plugin("LocalNotifications");
      if (!P) return false;
      try {
        var cur = await P.checkPermissions();
        var st = cur && cur.display;
        if (!granted(st)) { var r = await P.requestPermissions(); st = r && r.display; }
        var ok = granted(st);
        S().set("notifyAllowed", ok);
        return ok;
      } catch (e) { return false; }
    },
    at: async function (key, title, body, when) {
      var P = plugin("LocalNotifications");
      if (!P || !notify.allowed()) return false;
      var t = when instanceof Date ? when : new Date(when);
      if (!(t > new Date(Date.now() + 1000))) return false;
      try {
        await P.schedule({ notifications: [{ id: hashId(key), title: title, body: body, schedule: { at: t, allowWhileIdle: true }, sound: "default" }] });
        return true;
      } catch (e) { return false; }
    },
    cancel: async function (key) {
      var P = plugin("LocalNotifications");
      if (!P) return;
      try { await P.cancel({ notifications: [{ id: hashId(key) }] }); } catch (e) {}
    }
  };

  // ---------- reminders and calendar ----------
  var cal = {
    available: function () { return !!plugin("CapacitorCalendar"); },
    _ask: async function (which) {
      var P = plugin("CapacitorCalendar");
      if (!P) return false;
      try {
        var r = which === "reminders" ? await P.requestFullRemindersAccess() : await P.requestFullCalendarAccess();
        return granted(r && r.result);
      } catch (e) { return false; }
    },
    addReminder: async function (title, due) {
      var P = plugin("CapacitorCalendar");
      if (!P || !(await cal._ask("reminders"))) return { ok: false };
      try {
        var opts = { title: title };
        if (due) { opts.dueDate = due.getTime(); opts.startDate = due.getTime(); opts.alerts = [0]; }
        var r = await P.createReminder(opts);
        return { ok: true, id: r && r.id };
      } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    },
    addEvent: async function (title, start, end) {
      var P = plugin("CapacitorCalendar");
      if (!P || !(await cal._ask("calendar"))) return { ok: false };
      try {
        var r = await P.createEvent({ title: title, startDate: start.getTime(), endDate: (end || new Date(start.getTime() + 3600000)).getTime(), alerts: [-15] });
        return { ok: true, id: r && r.id };
      } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    },
    events: async function (from, to) {
      var P = plugin("CapacitorCalendar");
      if (!P || !(await cal._ask("calendar"))) return null;
      try {
        var r = await P.listEventsInRange({ from: from.getTime(), to: to.getTime() });
        return ((r && r.result) || []).map(function (e) {
          return { title: e.title || "Busy", start: new Date(e.startDate), end: new Date(e.endDate), allDay: !!e.isAllDay };
        }).sort(function (a, b) { return a.start - b.start; });
      } catch (e) { return null; }
    }
  };

  // ---------- battery ----------
  async function battery() {
    var P = plugin("Device");
    if (!P) return null;
    try {
      var b = await P.getBatteryInfo();
      if (!b || b.batteryLevel == null) return null;
      return { level: Math.round(b.batteryLevel * 100), charging: !!b.isCharging };
    } catch (e) { return null; }
  }

  // ---------- contacts (names only) ----------
  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); }
  function lev(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) d[i] = [i];
    for (j = 0; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  var contacts = {
    available: function () { return !!plugin("Contacts"); },
    names: function () { var d = S().get("contacts", null); return d && Array.isArray(d.names) ? d.names : []; },
    syncedAt: function () { var d = S().get("contacts", null); return (d && d.at) || 0; },
    sync: async function () {
      var P = plugin("Contacts");
      if (!P) return { ok: false, reason: "Contacts sync works in the installed app." };
      try {
        var perm = await P.requestPermissions();
        var st = perm && (perm.contacts || perm.readContacts);
        if (!granted(st)) return { ok: false, reason: "Contacts access is off. Turn it on in iPhone Settings, " + appName() + ", Contacts." };
        var res = await P.getContacts({ projection: { name: true } });
        var seen = {}, list = [];
        ((res && res.contacts) || []).forEach(function (c) {
          var n = c && c.name ? (c.name.display || [c.name.given, c.name.family].filter(Boolean).join(" ")) : "";
          n = String(n || "").trim();
          if (n && !seen[n.toLowerCase()]) { seen[n.toLowerCase()] = 1; list.push(n); }
        });
        list.sort(function (a, b) { return a.localeCompare(b); });
        S().set("contacts", { names: list, at: Date.now() });
        fire("friday:contacts", { count: list.length });
        return { ok: true, count: list.length };
      } catch (e) { return { ok: false, reason: "Couldn't read your contacts just now." }; }
    },
    // "daddy" -> "DADDY!!", "mom" -> "Mom", "batsie" -> "Batsie Smith"
    resolve: function (spoken, list) {
      list = list || contacts.names();
      var q = norm(spoken);
      if (!q || !list.length) return null;
      var best = null, bs = 0;
      list.forEach(function (n) {
        var k = norm(n);
        if (!k) return;
        var first = k.split(" ")[0], s = 0;
        if (k === q) s = 100;
        else if (first === q) s = 85;
        else if (k.indexOf(q + " ") === 0) s = 75;
        else if ((" " + k + " ").indexOf(" " + q + " ") >= 0) s = 60;
        else if (q.length >= 4 && lev(first, q) <= 1) s = 50;
        if (s > bs || (s === bs && s && n.length < (best || "").length)) { bs = s; best = n; }
      });
      return bs >= 50 ? best : null;
    }
  };

  // ---------- home (lights, scenes) ----------
  var home = {
    available: function () { return !!plugin("FridayHome"); },
    _status: null,
    ready: async function () {
      var P = plugin("FridayHome");
      if (!P) return false;
      if (home._status && Date.now() - home._status.at < 60000) return home._status.ok;
      var ok = false;
      try {
        var r = await P.list();
        ok = !!(r && r.authorization === "authorized" && r.lights && r.lights.length);
        if (r) S().set("homeInfo", { lights: (r.lights || []).length, scenes: r.scenes || [], rooms: r.rooms || [], at: Date.now() });
      } catch (e) { ok = false; }
      home._status = { ok: ok, at: Date.now() };
      return ok;
    },
    setLights: async function (opts) {
      var P = plugin("FridayHome");
      if (!P) return { ok: false };
      try { var r = await P.setLights(opts); return { ok: true, count: r && r.count }; }
      catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    },
    scene: async function (name) {
      var P = plugin("FridayHome");
      if (!P) return { ok: false };
      try { var r = await P.runScene({ name: name }); return { ok: true, scene: r && r.scene }; }
      catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    }
  };

  root.FridayNative = {
    isApp: function () { return !!cap(); },
    notify: notify,
    calendar: cal,
    battery: battery,
    contacts: contacts,
    home: home,
    hashId: hashId,
    _norm: norm
  };
})(window);
