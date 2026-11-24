/* Friday 3.1: the parts of the iPhone she can now reach directly (no Shortcut).
   Each one is a built-in add-on in the app shell. If an add-on or permission isn't
   there, the function says so and the app falls back to the Shortcut like before.
     notifications: timers, bills and countdowns ring even when the app is closed
     reminders and calendar: add reminders, add events, read today's events
     battery: level and charging
     contacts: names only, kept on this phone, so texts and calls find the right person
     home: lights to an exact brightness, on/off, scenes (works only if iOS allows it)
     aidot: AiDot lights over home Wi-Fi (on/off, brightness, warm/cool white, colors) */
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
    // Read what iPhone Settings says (no prompt), so the app never shows "Turn on" when it's already on.
    refresh: async function () {
      var P = plugin("LocalNotifications");
      if (!P) return false;
      try { var cur = await P.checkPermissions(); var ok = granted(cur && cur.display); S().set("notifyAllowed", ok); return ok; }
      catch (e) { return notify.allowed(); }
    },
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
    at: async function (key, title, body, when, extra) {
      var P = plugin("LocalNotifications");
      if (!P || !notify.allowed()) return false;
      var t = when instanceof Date ? when : new Date(when);
      if (!(t > new Date(Date.now() + 1000))) return false;
      var n = { id: hashId(key), title: title, body: body, schedule: { at: t, allowWhileIdle: true }, sound: "default" };
      if (extra) n.extra = extra;
      try {
        await P.schedule({ notifications: [n] });
        return true;
      } catch (e) { return false; }
    },
    // Runs fn(extra) when you tap one of her notifications.
    onTap: function (fn) {
      var P = plugin("LocalNotifications");
      if (!P || !P.addListener) return;
      try {
        P.addListener("localNotificationActionPerformed", function (e) {
          var n = e && e.notification;
          try { fn((n && n.extra) || {}, n); } catch (er) {}
        });
      } catch (e) {}
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
    // The phone number for a contact, read only when needed (numbers aren't kept by the app).
    numberFor: async function (who) {
      var P = plugin("Contacts");
      if (!P || !who) return null;
      try {
        var perm = await P.requestPermissions();
        if (!granted(perm && (perm.contacts || perm.readContacts))) return null;
        var res = await P.getContacts({ projection: { name: true, phones: true } });
        var list = (res && res.contacts) || [];
        function nameOf(c) { return c && c.name ? String(c.name.display || [c.name.given, c.name.family].filter(Boolean).join(" ")).trim() : ""; }
        var names = list.map(nameOf).filter(Boolean);
        var exact = contacts.resolve(who, names);
        if (!exact) return null;
        var c = list.filter(function (x) { return nameOf(x) === exact && x.phones && x.phones.length; })[0];
        if (!c) return null;
        var ph = c.phones.filter(function (x) { return /mobile|iphone|cell/i.test(String(x.type || "") + " " + String(x.label || "")); })[0] || c.phones[0];
        var num = String(ph.number || "").replace(/[^\d+]/g, "");
        return num ? { name: exact, number: num } : null;
      } catch (e) { return null; }
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
      // A "yes" is trusted for a minute; a "no" only for a few seconds, so she keeps trying.
      if (home._status && Date.now() - home._status.at < (home._status.ok ? 60000 : 8000)) return home._status.ok;
      var ok = false;
      try {
        var r = await P.list();
        ok = !!(r && r.authorization === "authorized" && r.lights && r.lights.length);
        if (r) S().set("homeInfo", { lights: (r.lights || []).length, scenes: r.scenes || [], rooms: r.rooms || [], homes: r.homes, accessories: r.accessories, otherPlugs: r.otherPlugs, authorization: r.authorization, at: Date.now() });
      } catch (e) { ok = false; }
      home._status = { ok: ok, at: Date.now() };
      return ok;
    },
    _worked: function () { home._status = { ok: true, at: Date.now() }; },
    // She always tries Home herself first; only if this fails does the Shortcut get the job.
    setLights: async function (opts) {
      var P = plugin("FridayHome");
      if (!P) return { ok: false };
      try { var r = await P.setLights(opts); home._worked(); return { ok: true, count: r && r.count }; }
      catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    },
    scene: async function (name) {
      var P = plugin("FridayHome");
      if (!P) return { ok: false };
      try { var r = await P.runScene({ name: name }); home._worked(); return { ok: true, scene: r && r.scene }; }
      catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    },
    // 3.4: the whole home. Names are kept so she can match "the fan" or "the bedroom heater".
    devices: async function () {
      var P = plugin("FridayHome");
      if (!P || !P.devices) return [];
      try { var r = await P.devices(); var d = (r && r.devices) || []; S().set("homeDevices", d.map(function (x) { return { name: x.name, room: x.room, kind: x.kind }; })); return d; }
      catch (e) { return []; }
    },
    knownDevices: function () { return S().get("homeDevices", []) || []; },
    control: async function (opts) {
      var P = plugin("FridayHome");
      if (!P || !P.control) return { ok: false };
      try { var r = await P.control(opts); home._worked(); return { ok: true, names: (r && r.names) || [], count: r && r.count }; }
      catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    },
    read: async function (opts) {
      var P = plugin("FridayHome");
      if (!P || !P.read) return { ok: false };
      try { var r = await P.read(opts || {}); return { ok: true, readings: (r && r.readings) || [] }; }
      catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    }
  };

  // ---------- music and texts (Friday's own add-on) ----------
  var kit = {
    available: function () { return !!plugin("FridayKit"); },
    music: async function (action) {
      var P = plugin("FridayKit");
      if (!P) return { ok: false };
      try { var r = await P.musicControl({ action: action }); return { ok: true, state: r && r.state, title: (r && r.title) || "" }; }
      catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    },
    play: async function (query, kind, shuffle) {
      var P = plugin("FridayKit");
      if (!P) return { ok: false };
      try { var r = await P.musicPlay({ query: query || "", kind: kind || "any", shuffle: !!shuffle }); return { ok: true, title: (r && r.title) || "" }; }
      catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    },
    text: async function (number, body) {
      var P = plugin("FridayKit");
      if (!P) return { ok: false };
      try { var r = await P.composeText({ to: [number], body: body }); return { ok: true, result: (r && r.result) || "" }; }
      catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    },
    // Which app links open on this iPhone, e.g. canOpen(["altload","sidestore"]) -> { altload: true, sidestore: false }.
    canOpen: async function (schemes) {
      var P = plugin("FridayKit");
      if (!P || !P.canOpen) return null;
      try { var r = await P.canOpen({ schemes: schemes }); return (r && r.apps) || null; }
      catch (e) { return null; }
    },
    // iPhone's heat level: "nominal", "fair", "serious" or "critical". fn runs now and whenever it changes.
    watchHeat: function (fn) {
      var P = plugin("FridayKit");
      if (!P || !P.thermal) return;
      P.thermal().then(function (r) { if (r && r.state) fn(r.state); }, function () {});
      if (P.addListener) { try { P.addListener("thermal", function (e) { if (e && e.state) fn(e.state); }); } catch (e) {} }
    },
    // 3.5.1: set the screen brightness (0 to 1). Resolves with the brightness it was before, or null.
    brightness: async function (value) {
      var P = plugin("FridayKit");
      if (!P || !P.brightness) return null;
      try {
        var r = await P.brightness(value == null ? {} : { value: Math.max(0, Math.min(1, +value)) });
        return r && typeof r.previous === "number" ? r.previous : null;
      } catch (e) { return null; }
    },
    personalVoice: async function () {
      var P = plugin("FridayKit");
      if (!P || !P.personalVoice) return { status: "unsupported", voices: [] };
      try { return await P.personalVoice(); } catch (e) { return { status: "error", voices: [] }; }
    },
    health: async function () {
      var P = plugin("FridayKit");
      if (!P || !P.health) return { ok: false };
      try { var r = await P.health(); return { ok: true, steps: r.steps || 0, sleepMinutes: r.sleepMinutes || 0 }; }
      catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    },
    wifiName: async function (ask) {
      var P = plugin("FridayKit");
      if (!P || !P.wifiName) return null;
      try { var r = await P.wifiName({ ask: !!ask }); return (r && r.ssid) || null; } catch (e) { return null; }
    },
    alarm: async function (at, title) {
      var P = plugin("FridayKit");
      if (!P || !P.alarmSet) return { ok: false };
      try { var r = await P.alarmSet({ at: +at, title: title || "Alarm" }); return { ok: true, id: r && r.id }; }
      catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    },
    camera: async function (mode) {
      var P = plugin("FridayKit");
      if (!P || !P.camera) return { ok: false };
      try { var r = await P.camera({ mode: mode || "photo" }); return { ok: true, result: r && r.result, kind: r && r.kind, photo: r && r.photo }; }
      catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    },
    onKeyboard: function (fn) {
      var P = plugin("FridayKit");
      if (!P || !P.addListener) return false;
      try { P.addListener("keyboard", function (e) { fn(+(e && e.height) || 0); }); return true; } catch (e) { return false; }
    },
    darkKeyboard: async function () {
      var P = plugin("FridayKit");
      if (!P || !P.darkKeyboard) return false;
      try { await P.darkKeyboard(); return true; } catch (e) { return false; }
    }
  };

  // ---------- AiDot lights (Friday's own add-on, straight over home Wi-Fi) ----------
  // The AiDot password and light keys live only in the iPhone's Keychain (native side).
  // The app keeps just the light names here so she can match "the bedroom lamp".
  function timeout(p, ms) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error("timeout")); }, ms); })]);
  }
  function errText(e) { return String((e && (e.message || e.code || e.errorMessage)) || e || ""); }
  var aidot = {
    available: function () { return !!plugin("FridayAidot"); },
    info: function () { return S().get("aidotInfo", null); },
    lights: function () { var i = aidot.info(); return ((i && i.devices) || []).filter(function (d) { return d && d.lan !== false; }); },
    ready: function () { var i = aidot.info(); return !!(aidot.available() && i && i.signedIn && aidot.lights().length); },
    _save: function (r) {
      if (r) S().set("aidotInfo", { signedIn: !!r.signedIn, user: r.user || "", country: r.country || "", devices: r.devices || [], at: r.at || Date.now(), homeNet: !!r.homeNet });
      return r;
    },
    status: async function () {
      var P = plugin("FridayAidot");
      if (!P) return aidot.info();
      try { return aidot._save(await P.status()); } catch (e) { return aidot.info(); }
    },
    signIn: async function (country, region, username, password) {
      var P = plugin("FridayAidot");
      if (!P) return { ok: false, reason: "app" };
      try {
        var r = aidot._save(await timeout(P.signIn({ country: country, region: region, username: username, password: password }), 40000));
        fire("friday:aidot", { signedIn: true });
        return { ok: true, status: r };
      } catch (e) { return { ok: false, reason: errText(e) }; }
    },
    signOut: async function () {
      var P = plugin("FridayAidot");
      S().set("aidotInfo", { signedIn: false, devices: [] });
      if (P) { try { await P.signOut(); } catch (e) {} }
      fire("friday:aidot", { signedIn: false });
    },
    refresh: async function () {
      var P = plugin("FridayAidot");
      if (!P) return { ok: false, reason: "app" };
      try { var r = aidot._save(await timeout(P.refresh(), 40000)); return { ok: true, status: r }; }
      catch (e) { return { ok: false, reason: errText(e) }; }
    },
    find: async function () {
      var P = plugin("FridayAidot");
      if (!P) return { ok: false, reason: "app" };
      try { var r = await timeout(P.find(), 15000); await aidot.status(); return { ok: true, found: r.found || 0, total: r.total || 0, reason: r.reason || "" }; }
      catch (e) { return { ok: false, reason: errText(e) }; }
    },
    // opts: { on, brightness (0-100), cct (kelvin), rgb: [r,g,b] }. ids [] = every light.
    control: async function (ids, opts) {
      var P = plugin("FridayAidot");
      if (!P) return { ok: false, reason: "app", done: [], failed: [] };
      opts = opts || {};
      var args = { ids: ids || [] };
      if (opts.on != null) args.on = !!opts.on;
      if (opts.brightness != null) args.brightness = Math.round(opts.brightness);
      if (opts.cct != null) args.cct = Math.round(opts.cct);
      if (opts.rgb) args.rgb = opts.rgb;
      try {
        var r = await timeout(P.control(args), 10000);
        var done = (r && r.done) || [], failed = (r && r.failed) || [];
        return { ok: done.length > 0, done: done, failed: failed, away: !!(r && r.away), reason: failed[0] ? failed[0].reason : "" };
      } catch (e) { return { ok: false, done: [], failed: [], reason: errText(e) }; }
    },
    state: async function (ids) {
      var P = plugin("FridayAidot");
      if (!P) return { ok: false, done: [], failed: [] };
      try {
        var r = await timeout(P.state({ ids: ids || [] }), 10000);
        var done = (r && r.done) || [];
        return { ok: done.length > 0, done: done, failed: (r && r.failed) || [], away: !!(r && r.away) };
      } catch (e) { return { ok: false, done: [], failed: [], reason: errText(e) }; }
    }
  };

  root.FridayNative = {
    aidot: aidot,
    kit: kit,
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
