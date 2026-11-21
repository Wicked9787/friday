/* Friday app bootstrap: orb, voice, chat, bubbles, panels, phone handoff. */
(function () {
  "use strict";

  var cfg = window.FRIDAY_CONFIG;
  var profile = cfg.getProfile();
  var settingsData = window.FridayLoadSettings();

  var orb, voice, chat, bubbles, tools, settings, neural, life, eyes, bedside;
  var extras = window.FridayExtras || null;
  var APP_VERSION = "3.2.0";
  var APP_LABEL = "Direct Lights";
  var IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  var handsFree = cfg.queryParam("listen") === "1" || (IS_NATIVE && settingsData.handsFree !== false);
  function handsFreeOn() { var v = (settings && settings.values) || settingsData || {}; return v.handsFree !== false; }
  var busy = false;


  function lookOrder() {
    var ids = [];
    (cfg.LOOK_GROUPS || []).forEach(function (g) {
      (g.ids || []).forEach(function (id) { if (cfg.LOOKS[id] && ids.indexOf(id) < 0) ids.push(id); });
    });
    return ids;
  }

  var lookLabelTimer = 0;
  function showLookLabel(id) {
    var el = document.getElementById("look-label");
    if (!el) return;
    var item = cfg.LOOKS[id];
    el.textContent = item ? item.name : id;
    el.classList.remove("fade");
    el.classList.add("show");
    clearTimeout(lookLabelTimer);
    lookLabelTimer = setTimeout(function () {
      el.classList.add("fade");
      el.classList.remove("show");
    }, 1100);
  }

  function applyLook(id, announce) {
    if (!id || !cfg.LOOKS[id]) return;
    if (orb) orb.setLook(id);
    if (settings) {
      settings.values.look = id;
      FridayStorage.set("settings", settings.values);
      var looks = document.getElementById("looks");
      if (looks) {
        looks.querySelectorAll(".look").forEach(function (b) {
          b.classList.toggle("on", b.getAttribute("data-look") === id);
        });
      }
      if (settings._syncHeaders) settings._syncHeaders();
    }
    if (announce !== false) showLookLabel(id);
  }

  var LAYOUT_FRAMES = {
    orbit: { cyN: 0.46, radiusK: 0.28 },
    ring: { cyN: 0.46, radiusK: 0.26 },
    dock: { cyN: 0.42, radiusK: 0.32 },
    grid: { cyN: 0.24, radiusK: 0.20 },
    arc: { cyN: 0.34, radiusK: 0.26 },
    orbonly: { cyN: 0.50, radiusK: 0.34 },
    immersive: { cyN: 0.50, radiusK: 0.47 },
    orbtop: { cyN: 0.27, radiusK: 0.27 },
    orbdock: { cyN: 0.80, radiusK: 0.15 },
    orbclock: { cyN: 0.58, radiusK: 0.30 },
    double: { cyN: 0.44, radiusK: 0.24 },
    spiral: { cyN: 0.30, radiusK: 0.24 },
    home: { cyN: 0.22, radiusK: 0.18 },
    list: { cyN: 0.28, radiusK: 0.22 },
    sheet: { cyN: 0.25, radiusK: 0.2 }
  };

  function applyOrbFrame(mode, revealed) {
    var oo = window.FridayBubbles && window.FridayBubbles.ORB_ONLY ? window.FridayBubbles.ORB_ONLY : { orbonly: 1 };
    var m = (oo[mode] && revealed) ? "dock" : (mode || "orbit");
    var f = LAYOUT_FRAMES[m] || LAYOUT_FRAMES.orbit;
    if (orb) orb.setFrame(f);
    var stage = document.getElementById("stage");
    if (stage) stage.style.setProperty("--orb-y", (f.cyN * 100) + "%");
  }

  function applyLayout(id, fromSettings) {
    if (!id) id = "orbit";
    if (settings && !fromSettings) {
      settings.values.layout = id;
      FridayStorage.set("settings", settings.values);
      if (settings._syncHeaders) settings._syncHeaders();
    }
    if (bubbles) bubbles.setLayout(id);
    else applyOrbFrame(id, !(window.FridayBubbles && window.FridayBubbles.ORB_ONLY && window.FridayBubbles.ORB_ONLY[id]));
    var sc = document.getElementById("stage-clock");
    if (sc) { sc.hidden = id !== "orbclock"; tickStageClock(); }
  }

  function tickStageClock() {
    var el = document.getElementById("stage-clock");
    if (!el || el.hidden) return;
    var d = new Date(), h = d.getHours() % 12 || 12, m = String(d.getMinutes()).padStart(2, "0");
    var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    el.querySelector(".sc-time").textContent = h + ":" + m;
    el.querySelector(".sc-date").textContent = days[d.getDay()] + ", " + months[d.getMonth()] + " " + d.getDate();
  }

  function applyAppIcon(id) {
    if (!id) return;
    var href180 = "icons/choices/" + id + "-180.png";
    var href192 = "icons/choices/" + id + "-192.png";
    var href512 = "icons/choices/" + id + "-512.png";
    var apple = document.querySelector("link[rel='apple-touch-icon']");
    if (apple) apple.setAttribute("href", href180);
    var icon = document.querySelector("link[rel='icon']");
    if (icon) {
      icon.setAttribute("href", href192);
      icon.setAttribute("sizes", "192x192");
    }
    if (icon && !document.querySelector("link[rel='icon'][sizes='512x512']")) {
      var big = document.createElement("link");
      big.rel = "icon";
      big.type = "image/png";
      big.setAttribute("sizes", "512x512");
      big.href = href512;
      document.head.appendChild(big);
    }
  }

  var WMO = {
    0: "clear", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
    45: "foggy", 48: "foggy", 51: "light drizzle", 53: "drizzle", 55: "drizzle",
    56: "freezing drizzle", 57: "freezing drizzle", 61: "rain", 63: "rain",
    65: "heavy rain", 66: "freezing rain", 67: "freezing rain", 71: "snow",
    73: "snow", 75: "heavy snow", 77: "flurries", 80: "showers", 81: "showers",
    82: "heavy showers", 85: "snow showers", 86: "snow showers",
    95: "thunderstorms", 96: "thunderstorms", 99: "thunderstorms"
  };

  function cycleLook(dir) {
    var ids = lookOrder();
    var cur = (settings && settings.look()) || "N";
    var i = ids.indexOf(cur);
    if (i < 0) i = 0;
    var next = ids[(i + dir + ids.length) % ids.length];
    applyLook(next, true);
  }

  function toast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove("show"); }, 2400);
  }

  function setCaption(line) {
    document.getElementById("caption-line").textContent = line || "Tap to talk";
    if (bedside && bedside.on) bedside.caption(line);
  }

  function openPanel(id) {
    if (id === "photo-take") { if (eyes) eyes.open(""); return; }
    if (id === "bedside") { openBedside(); return; }
    closePanels();
    var el = document.getElementById("panel-" + id);
    if (el) { el.classList.add("open"); if (orb) orb.stop(); }
    if (id === "settings" && settings && settings.showPage) settings.showPage("");
    if (id === "neural") {
      if (neural) neural.start();
    } else if (neural) neural.stop();
    if (id === "chat") renderChat();
    if (id === "notes") renderNotes();
    if (id === "memory") renderMemory();
    if (id === "lists" && life) life.renderLists(document.getElementById("lists-box"));
    if (id === "countdowns" && life) life.renderCountdowns(document.getElementById("countdowns-box"));
    if (id === "money" && life) life.renderBills(document.getElementById("bills-box"));
    if (id === "money" && extras) extras.renderSpending(document.getElementById("spending-box"));
    if (id === "habits" && extras) extras.renderHabits(document.getElementById("habits-box"));
    if (id === "timer" && life) { var tb = document.getElementById("timers-box"); tb._key = null; life.renderTimers(tb); }
  }

  function refreshOpen() {
    var open = document.querySelector(".panel.open");
    if (!open || !life) return;
    var id = open.id.replace("panel-", "");
    if (id === "lists") life.renderLists(document.getElementById("lists-box"));
    else if (id === "countdowns") life.renderCountdowns(document.getElementById("countdowns-box"));
    else if (id === "money") { life.renderBills(document.getElementById("bills-box")); if (extras) extras.renderSpending(document.getElementById("spending-box")); }
    else if (id === "habits" && extras) extras.renderHabits(document.getElementById("habits-box"));
    else if (id === "notes") renderNotes();
    else if (id === "memory") renderMemory();
  }

  function closePanels() {
    document.querySelectorAll(".panel.open").forEach(function (p) { p.classList.remove("open"); });
    if (neural) neural.stop();
    if (orb && !orb.running && document.visibilityState !== "hidden") orb.start();
  }

  function shortcutUrl(command) {
    var name = encodeURIComponent(settings.shortcutName());
    var text = encodeURIComponent(command);
    var isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    if (isNative) {
      var back = encodeURIComponent((window.FRIDAY_BAKED_PROFILE === "batsie" ? "jarvis" : "friday") + "://");
      return "shortcuts://x-callback-url/run-shortcut?name=" + name + "&input=text&text=" + text +
        "&x-success=" + back + "&x-cancel=" + back + "&x-error=" + back;
    }
    return "shortcuts://run-shortcut?name=" + name + "&input=text&text=" + text;
  }

  function emitActivity(node, text, extra) {
    try { window.dispatchEvent(new CustomEvent("friday:activity", { detail: Object.assign({ node: node, text: text }, extra || {}) })); } catch (e) {}
  }

  /* 3.0: when one sentence needs several things outside the app (Shortcut jobs,
     opening an app), they wait here. The first runs now; each time the Shortcut
     hands back to Friday, the next one starts. */
  var handedOffAt = 0; // when she sent you to another app on purpose (Shortcut, call, Music...)
  function goShortcut(cmd, opts) {
    if (opts && opts.collect) { opts.collect.push({ kind: "shortcut", value: cmd }); return; }
    leftForApp = true;
    handedOffAt = Date.now();
    runShortcut(cmd);
  }
  function goUrl(url, opts) {
    if (opts && opts.collect) { opts.collect.push({ kind: "url", value: url }); return; }
    leftForApp = true;
    handedOffAt = Date.now();
    openUrl(url);
  }
  function runLeaveItem(it) {
    if (!it) return;
    handedOffAt = Date.now();
    if (it.kind === "url") openUrl(it.value);
    else runShortcut(it.value);
  }
  function runLeaveQueue(items) {
    items = (items || []).slice();
    if (!items.length) return;
    var first = items.shift();
    FridayStorage.set("leaveQueue", items.length ? { items: items, at: Date.now() } : null);
    leftForApp = true;
    runLeaveItem(first);
  }
  var _leaveAt = 0;
  function pendingLeave() {
    var q = FridayStorage.get("leaveQueue", null);
    if (!q || !Array.isArray(q.items) || !q.items.length) return null;
    if (Date.now() - (q.at || 0) > 3 * 60 * 1000) { FridayStorage.set("leaveQueue", null); return null; }
    return q;
  }
  function continueLeaveQueue() {
    var q = pendingLeave();
    if (!q || Date.now() - _leaveAt < 1500) return false;
    _leaveAt = Date.now();
    var next = q.items.shift();
    FridayStorage.set("leaveQueue", q.items.length ? { items: q.items, at: Date.now() } : null);
    setCaption(q.items.length ? "Next one…" : "Last one…");
    setTimeout(function () { runLeaveItem(next); }, 700);
    return true;
  }

  // "text daddy hi" -> "text DADDY!! saying hi" (names from Contacts, if synced)
  function fixContacts(cmd) {
    var N = window.FridayNative;
    if (!N || !N.contacts.names().length) return cmd;
    var m = String(cmd || "").match(/^(text|message|send a text to|send a message to|call|facetime)\s+(.+)$/i);
    if (!m) return cmd;
    var verb = m[1].toLowerCase(), rest = m[2], who = null, body = null;
    var isCall = verb === "call" || verb === "facetime";
    var sm = rest.match(/^(.+?)\s+(?:saying|that says|and say|to say)\s+([\s\S]*)$/i);
    if (sm) { who = sm[1]; body = sm[2]; }
    else if (isCall) who = rest;
    else {
      var words = rest.split(/\s+/);
      for (var n = Math.min(3, words.length - 1); n >= 1; n--) {
        var cand = words.slice(0, n).join(" ");
        if (N.contacts.resolve(cand.replace(/^(my|the)\s+/i, ""))) { who = cand; body = words.slice(n).join(" "); break; }
      }
    }
    if (!who) return cmd;
    var exact = N.contacts.resolve(who.replace(/^(my|the)\s+/i, ""));
    if (!exact) return cmd;
    return isCall ? verb + " " + exact : "text " + exact + " saying " + (body || "");
  }

  function runShortcut(command) {
    command = fixContacts(command);
    var url = shortcutUrl(command);
    FridayStorage.set("lastShortcut", String(command).slice(0, 60));
    emitActivity("shortcut", "Sent to Shortcut: " + String(command).slice(0, 60));
    // iOS blocks app links that don't come straight from a tap, so show a
    // tap-to-run button (a real link) and also try opening it right away.
    var old = document.getElementById("run-shortcut-btn");
    if (old) old.remove();
    var a = document.createElement("a");
    a.id = "run-shortcut-btn";
    a.href = url;
    a.textContent = "Run in Shortcuts";
    a.setAttribute("style", "position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 96px);transform:translateX(-50%);z-index:9999;padding:14px 26px;border-radius:999px;background:rgba(20,20,20,.85);border:1px solid rgba(214,180,110,.7);color:#e9d3a0;font:600 16px -apple-system,system-ui,sans-serif;text-decoration:none;letter-spacing:.3px;box-shadow:0 0 24px rgba(214,180,110,.35);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)");
    a.addEventListener("click", function () { setTimeout(function () { a.remove(); }, 400); });
    document.body.appendChild(a);
    setTimeout(function () { if (a.parentNode) a.remove(); }, 30000);
    try { location.href = url; } catch (e) {}
  }

  function showMessagesButton(cmd) {
    var m = String(cmd || "").match(/\b(?:saying|that says|that|say)\b\s+(.+)$/i);
    var body = m ? m[1] : String(cmd || "").replace(/^\s*(send\s+)?(a\s+)?(text|message)\s+(to\s+)?\S+\s*/i, "");
    var old = document.getElementById("open-messages-btn");
    if (old) old.remove();
    var a = document.createElement("a");
    a.id = "open-messages-btn";
    a.href = "sms:&body=" + encodeURIComponent(body.trim());
    a.textContent = "Open in Messages";
    a.setAttribute("style", "position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 150px);transform:translateX(-50%);z-index:9999;padding:12px 22px;border-radius:999px;background:rgba(20,20,20,.85);border:1px solid rgba(214,180,110,.5);color:#e9d3a0;font:600 15px -apple-system,system-ui,sans-serif;text-decoration:none;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)");
    a.addEventListener("click", function () { setTimeout(function () { a.remove(); }, 400); });
    document.body.appendChild(a);
    setTimeout(function () { if (a.parentNode) a.remove(); }, 30000);
  }

  var DIRECT_APPS = [
    ["apple music", "music://"], ["music", "music://"], ["spotify", "spotify://"],
    ["phone", "tel:"], ["messages", "sms:"], ["facetime", "facetime://"], ["mail", "mailto:"],
    ["maps", "maps://"], ["photos", "photos-redirect://"], ["settings", "app-settings:"],
    ["youtube", "youtube://"], ["netflix", "nflx://"], ["instagram", "instagram://"],
    ["tiktok", "snssdk1233://"], ["facebook", "fb://"], ["twitter", "twitter://"], ["whatsapp", "whatsapp://"],
    ["cash app", "cashme://"], ["shortcuts", "shortcuts://"], ["safari", "x-web-search://"]
  ];
  function directAppUrl(text) {
    var m = String(text || "").toLowerCase().replace(/[.!?,]/g, "").match(/^(?:hey \w+ )?(?:please )?(?:open|launch|pull up|go to|start)(?: up)? (?:the |my )?(.+?)(?: app)?(?: please)?$/);
    if (!m) return null;
    for (var i = 0; i < DIRECT_APPS.length; i++) if (m[1] === DIRECT_APPS[i][0]) return { name: m[1], url: DIRECT_APPS[i][1] };
    return null;
  }

  // The Camera app has no URL scheme, so camera requests go through the shortcut.
  function cameraCommand(text) {
    var t = String(text || "").toLowerCase().replace(/[.!?,]/g, "").trim();
    var m = t.match(/^(?:hey \w+ )?(?:please )?(?:open|launch|pull up|show|start|bring up|check)(?: up)?(?: me)? (?:the |my )?(cameras|camera)(?: app)?(?: please)?$/);
    if (!m) return null;
    return m[1] === "cameras" ? "cameras" : "open camera";
  }

  function openUrl(url) {
    if (!url) return;
    // Capacitor's WKWebView hands non-http schemes off to iOS; same path works on the web PWA.
    try { location.href = url; } catch (e) {}
  }

  function normalizeEnteredUrl(url) {
    url = String(url || "").trim();
    if (!url) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
    if (/^[\w.-]+\.[a-z]{2,}([\/:?#]|$)/i.test(url)) return "https://" + url;
    return url;
  }

  function honorific() {
    var terms = profile.terms || profile.honorifics || [];
    if (!terms.length && profile.term) terms = [profile.term];
    return terms[0] || "";
  }

  function getCoords() {
    var home = cfg.HOME_COORDS || { lat: 36.6, lon: -83.66, label: "Cumberland Gap" };
    return new Promise(function (resolve) {
      if (!navigator.geolocation) return resolve({ lat: home.lat, lon: home.lon, fallback: true, label: home.label });
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        resolve({ lat: home.lat, lon: home.lon, fallback: true, label: home.label });
      }, 3500);
      navigator.geolocation.getCurrentPosition(function (pos) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, fallback: false });
      }, function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ lat: home.lat, lon: home.lon, fallback: true, label: home.label });
      }, { timeout: 3000, maximumAge: 30 * 60 * 1000 });
    });
  }

  function fetchWeather() {
    return getCoords().then(function (pos) {
      var url = "https://api.open-meteo.com/v1/forecast?latitude=" + pos.lat +
        "&longitude=" + pos.lon + "&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=2&timezone=auto&temperature_unit=fahrenheit";
      return fetch(url).then(function (r) { return r.json(); }).then(function (data) {
        var t = data && data.current ? Math.round(data.current.temperature_2m) : null;
        var code = data && data.current ? data.current.weather_code : null;
        var phrase = WMO[code] || "the weather you'd expect";
        var dly = data && data.daily;
        var hi = dly && dly.temperature_2m_max ? Math.round(dly.temperature_2m_max[0]) : null;
        var lo = dly && dly.temperature_2m_min ? Math.round(dly.temperature_2m_min[0]) : null;
        var rain = dly && dly.precipitation_probability_max ? dly.precipitation_probability_max[0] : null;
        var tom = null;
        if (dly && dly.temperature_2m_max && dly.temperature_2m_max.length > 1) {
          tom = { hi: Math.round(dly.temperature_2m_max[1]), lo: Math.round(dly.temperature_2m_min[1]), rain: dly.precipitation_probability_max ? dly.precipitation_probability_max[1] : null, phrase: WMO[dly.weather_code ? dly.weather_code[1] : -1] || "" };
        }
        return { temp: t, phrase: phrase, hi: hi, lo: lo, rain: rain, tomorrow: tom, fallback: pos.fallback, label: pos.label || "Cumberland Gap" };
      });
    });
  }

  function aPct(n) { return (/^(8|11|18)/.test(String(n)) ? "an " : "a ") + n; }

  function weatherSentence(when) {
    return fetchWeather().then(function (w) {
      if (when === "tomorrow" && w.tomorrow) {
        var tm = w.tomorrow;
        var line = (w.fallback ? "In " + w.label + ", tomorrow's" : "Tomorrow's") + " forecast is " + (tm.phrase || "about the same as today") + ", with a high of " + tm.hi + "° and a low of " + tm.lo + "°.";
        if (tm.rain != null && tm.rain >= 30) line += " There's " + aPct(tm.rain) + " percent chance of rain" + (tm.rain >= 60 ? ", so plan for an umbrella." : ".");
        return line;
      }
      var where = w.fallback ? ("In " + w.label + ", it's ") : "It's ";
      if (w.temp == null) return "I couldn't get the weather just now.";
      var extra = "";
      if (w.hi != null && w.lo != null) extra += " Today's high is " + w.hi + "°, low " + w.lo + "°.";
      if (w.rain != null && w.rain >= 30) extra += " There's " + aPct(w.rain) + " percent chance of rain" + (w.rain >= 60 ? ", so grab an umbrella." : ".");
      return where + w.temp + "° and " + w.phrase + "." + extra;
    }).catch(function () {
      return navigator.onLine === false ? "I need the internet for the weather." : "I couldn't get the weather just now.";
    });
  }

  function todayNotesAndTimers() {
    var bits = life ? life.briefingBits(chat ? chat.memory : []) : [];
    var notes = (tools && tools.notes()) || [];
    var start = new Date();
    start.setHours(0, 0, 0, 0);
    var today = notes.filter(function (n) {
      if (!n || !n.at) return true;
      var d = new Date(n.at);
      return d >= start;
    });
    if (today.length) {
      var first = today[0].text || "";
      if (today.length === 1) bits.push("You have a note: " + first);
      else bits.push("You have " + today.length + " notes for today. The first is: " + first);
    }
    if (!bits.length) bits.push("Nothing on the books for today.");
    return bits.join(" ");
  }

  function clockPhrase(d) {
    var h = d.getHours(), m = d.getMinutes();
    var ap = h >= 12 ? "PM" : "AM";
    var hr = h % 12;
    if (!hr) hr = 12;
    var min = m < 10 ? "0" + m : String(m);
    return "It's " + hr + ":" + min + " " + ap + ".";
  }

  function wakeLine() {
    var d = new Date();
    var h = d.getHours();
    var term = honorific();
    var name = profile.ownerName || "";
    var part = h < 12 ? "morning" : (h < 17 ? "afternoon" : "evening");
    var lines = [
      "Good " + part + ".",
      "I'm here.",
      "Ready when you are."
    ];
    if (term) {
      lines.push("Good " + part + ", " + term + ".");
      lines.push("I'm here, " + term + ".");
      lines.push("Ready when you are, " + term + ".");
    }
    if (name) lines.push("Hello, " + name.split(" ")[0] + ".");
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function speakLine(text) {
    if (!text) return;
    setCaption(text);
    if (voice) voice.speak(text, profile);
  }

  function maybeGreet() {
    var s = (settings && settings.values) || settingsData || {};
    var now = new Date();
    var hour = now.getHours();
    var dayKey = now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate();
    var briefDue = s.morningBriefing !== false && hour >= 5 && hour < 11 && FridayStorage.get("briefingDate", "") !== dayKey;
    if (briefDue) {
      FridayStorage.set("briefingDate", dayKey);
      runBriefing();
      return;
    }
    if (recapDue()) { runRecap(); return; }
    if (s.wakeGreeting !== false) speakLine(wakeLine());
  }

  function runBriefing() {
    var now = new Date();
    var h = now.getHours();
    var part = h < 12 ? "Good morning" : (h < 17 ? "Good afternoon" : "Good evening");
    var hello = part + (honorific() ? ", " + honorific() : "") + ". " + clockPhrase(now);
    setCaption("Getting your briefing…");
    emitActivity("weather", "Morning briefing");
    return new Promise(function (done) {
      weatherSentence().then(function (wx) {
        var body = hello + " " + wx + " " + todayNotesAndTimers();
        var st = (settings && settings.values) || {};
        if (st.briefingNews === false || !FridayStorage.hasApiKey()) { setCaption(body); done(voice.speak(body, profile)); return; }
        var news = window.FridayBrain.ask([
          { role: "system", content: "Search the web for the top two news headlines in the United States today. Reply with one short spoken sentence for each, no links, no lists, no citations." },
          { role: "user", content: "Top headlines today?" }
        ], { purpose: "chat", tools: [{ type: "browser_search" }], reasoning_effort: "low", temperature: 0.4, noBackup: true });
        var timeout = new Promise(function (res) { setTimeout(function () { res(""); }, 6000); });
        Promise.race([news, timeout]).then(function (n) {
          n = window.FridayGroq ? window.FridayGroq.cleanSpoken(n || "") : "";
          var full = body + (n ? " In the news: " + n : "");
          setCaption(full); done(voice.speak(full, profile));
        }, function () { setCaption(body); done(voice.speak(body, profile)); });
      });
    });
  }

  function renderChips() {
    var el = document.getElementById("chips");
    if (!el) return;
    el.innerHTML = "";
    var list = (settings && settings.values && settings.values.chips) || (cfg.DEFAULT_CHIPS || []);
    list.forEach(function (c) {
      if (c.type === "shortcut") {
        var a = document.createElement("a");
        a.className = "chip";
        a.href = shortcutUrl(c.command || c.label);
        a.textContent = c.label || "Shortcut";
        el.appendChild(a);
      } else {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.textContent = c.label || "Chip";
        b.addEventListener("click", function () {
          if (c.type === "weather") {
            setCaption("Checking the weather…");
            weatherSentence().then(function (line) { speakLine(line); });
          } else {
            handleUtterance(c.command || c.label);
          }
        });
        el.appendChild(b);
      }
    });
    if (bubbles) bubbles.layout();
  }

  function renderChat() {
    var thread = document.getElementById("chat-thread");
    thread.className = "body thread";
    thread.innerHTML = "";
    (chat.history || []).forEach(function (h) {
      if (h.role !== "user" && h.role !== "assistant") return;
      var d = document.createElement("div");
      d.className = "msg " + (h.role === "user" ? "user" : "friday");
      d.textContent = h.content;
      thread.appendChild(d);
    });
    if (!chat.history.length) {
      var s = document.createElement("div");
      s.className = "msg sys";
      s.textContent = "Say hello, or tap the orb.";
      thread.appendChild(s);
    }
    thread.scrollTop = thread.scrollHeight;
  }

  function renderNotes() {
    tools.renderList(document.getElementById("note-list"), tools.notes(), function (i) {
      tools.removeNote(i);
      renderNotes();
    });
  }

  var memFilter = "all";
  function renderMemory() {
    var box = document.getElementById("memory-list");
    if (!box) return;
    var q = String((document.getElementById("memory-search") || {}).value || "").toLowerCase().trim();
    var items = chat.memory.map(function (m, i) { return { m: m, i: i }; });
    if (q) items = items.filter(function (x) { return String(x.m.text).toLowerCase().indexOf(q) >= 0; });
    if (memFilter === "pinned") items = items.filter(function (x) { return x.m.pinned; });
    if (memFilter === "learned") items = items.filter(function (x) { return x.m.auto; });
    if (memFilter === "az") items.sort(function (a, b) { return String(a.m.text).localeCompare(String(b.m.text)); });
    else items.sort(function (a, b) { return ((b.m.pinned ? 1 : 0) - (a.m.pinned ? 1 : 0)) || String(b.m.at || "").localeCompare(String(a.m.at || "")); });
    box.innerHTML = "";
    if (!items.length) { box.innerHTML = '<p class="hint">' + (q || memFilter !== "all" ? "No memories match." : "Nothing here yet. Say “remember that …” or add one above.") + "</p>"; }
    items.forEach(function (x) {
      var card = document.createElement("div");
      card.className = "list-card mem-card";
      var p = document.createElement("p");
      p.textContent = x.m.text;
      var meta = document.createElement("div");
      meta.className = "meta";
      var when = "";
      try { when = new Date(x.m.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch (e) {}
      meta.textContent = when + (x.m.auto ? " · learned on her own" : "") + (x.m.pinned ? " · pinned" : "");
      var acts = document.createElement("div");
      acts.className = "mem-acts";
      [["Edit", function () {
        var ta = document.createElement("textarea");
        ta.value = x.m.text;
        var save = document.createElement("button"); save.className = "btn gold"; save.type = "button"; save.textContent = "Save";
        var cancel = document.createElement("button"); cancel.className = "btn"; cancel.type = "button"; cancel.textContent = "Cancel";
        card.innerHTML = ""; card.appendChild(ta); card.appendChild(save); card.appendChild(cancel);
        ta.focus();
        save.onclick = function () { chat.editMemory(x.i, ta.value); renderMemory(); };
        cancel.onclick = renderMemory;
      }], [x.m.pinned ? "Unpin" : "Pin", function () { chat.togglePin(x.i); renderMemory(); }],
        ["Delete", function () { chat.removeMemory(x.i); renderMemory(); }]].forEach(function (a) {
        var b = document.createElement("button");
        b.type = "button"; b.textContent = a[0]; b.onclick = a[1];
        if (a[0] === "Delete") b.className = "danger";
        acts.appendChild(b);
      });
      card.appendChild(p); card.appendChild(meta); card.appendChild(acts);
      box.appendChild(card);
    });
    var sum = document.getElementById("memory-summary");
    if (sum) {
      var smry = (chat.summary && chat.summary.text) || "";
      sum.textContent = chat.memory.length + " things remembered." + (smry ? " She also keeps a short summary of your older chats so she remembers past conversations." : "");
    }
  }

  var leftForApp = false;
  async function handleUtterance(text, opts) {
    opts = opts || {};
    text = String(text || "").trim();
    if (!text) {
      setCaption("Tap to talk");
      return;
    }
    setCaption(text);
    if (!opts.part) emitActivity("listening", "Heard: " + text.slice(0, 70));
    if (!opts.part && extras) {
      var steps = extras.splitCommands(text);
      if (steps.length > 1) {
        chat._push("user", text);
        emitActivity("thinking", "Doing " + steps.length + " things at once");
        await runMany(steps, null);
        return;
      }
    }
    if (opts.showChat !== false) {
      chat.history.push({ role: "user", content: text, at: new Date().toISOString() });
      chat.save();
      // ask() also pushes — avoid double-push by popping this and letting ask do it? 
      // Simpler: don't pre-push. render after.
      chat.history.pop();
    }
    busy = true;
    if (neural) neural.setActive("thinking");
    document.getElementById("neural-caption").textContent = (profile.assistantName || "Friday").toUpperCase() + " · THINKING";
    try {
      var camCmd = cameraCommand(text);
      if (camCmd) {
        setCaption(camCmd === "cameras" ? "Pulling up the cameras." : "Opening the camera.");
        goShortcut(camCmd, opts);
        return;
      }
      var direct = directAppUrl(text);
      if (direct) {
        if (bubbles) { if (!bubbles.noteAppMentions("open " + direct.name)) bubbles.noteUsage("url:" + direct.url); bubbles.refreshSuggestions(); }
        setCaption("Opening " + direct.name + ".");
        goUrl(direct.url, opts);
        return;
      }
      var low = text.toLowerCase().replace(/[.!?,]/g, "").trim();
      if (/^(good morning|morning briefing|(give me |run |start )?(my |the )?(morning )?briefing|brief me|what'?s (my day|today) look(ing)? like)$/.test(low)) {
        chat._push("user", text);
        await runBriefing();
        return;
      }
      if (/\b(weather|forecast|temperature outside|how (hot|cold) is it|is it (going to )?(rain|snow)|will it (rain|snow)|do i need (a |an )?(umbrella|jacket|coat))\b/.test(low) && !/\b(in|for) (?!the morning|tomorrow|today|tonight)[a-z]+/.test(low.replace(/^.*?(weather|forecast)/, "$1"))) {
        chat._push("user", text);
        setCaption("Checking the weather…");
        emitActivity("weather", /\btomorrow\b/.test(low) ? "Checked tomorrow's weather" : "Checked the weather");
        var wline = await weatherSentence(/\btomorrow\b/.test(low) ? "tomorrow" : "today");
        chat._push("assistant", wline);
        setCaption(wline);
        await voice.speak(wline, profile);
        return;
      }
      var ex = extras ? extras.handle(text, profile) : null;
      if (ex) { await runExtra(ex, text, opts); return; }
      if (window.FridayPhone) {
        var ph = await window.FridayPhone.handle(text, profile);
        if (ph) {
          chat._push("user", text);
          chat._push("assistant", ph.say);
          setCaption(ph.say);
          emitActivity(ph.tool === "home" ? "home" : ph.tool === "battery" ? "core" : ph.tool === "music" || ph.tool === "call" ? "voice" : "calendar", ph.say.slice(0, 70));
          // music is playing now: stop the hands-free conversation so she doesn't listen to the song
          if (ph.tool === "music" && ph.playing && !opts.part) handsFree = false;
          // when music starts, the music is the answer: she doesn't talk over it
          if (!(ph.tool === "music" && ph.playing)) await voice.speak(ph.say, profile);
          if (ph.url) goUrl(ph.url, opts);
          return;
        }
      }
      var act = life ? life.handle(text) : null;
      if (!act && /^(run |start )?(a )?(diagnostics?|system check|self[- ]?check|health check)$|^check (yourself|your systems)$/.test(low)) {
        chat._push("user", text);
        await runDiagnostics(true);
        return;
      }
      if (!act && navigator.onLine === false) {
        var off = "I'm offline right now. I can still do lists, timers, notes, bills and countdowns, and I'll be back to normal when the internet returns.";
        setCaption(off);
        await voice.speak(off, profile);
        return;
      }
      if (act) {
        chat._push("user", text);
        if (act.say) chat._push("assistant", act.say);
        if (act.photo) {
          setCaption(act.say);
          if (eyes) eyes.offer(text);
          await voice.speak(act.say, profile);
          return;
        }
        if (act.panel) { openPanel(act.panel); if (bubbles) { bubbles.noteUsage("panel:" + act.panel); bubbles.refreshSuggestions(); } }
        else refreshOpen();
        setCaption(act.say || "");
        if (act.url) { await voice.speak(act.say, profile); goUrl(act.url, opts); return; }
        await voice.speak(act.say, profile);
        if (act.shortcut) goShortcut(act.shortcut, opts);
        return;
      }
      var spokeStream = false;
      var result = await chat.ask(text, {
        onSentence: function (sentence) {
          spokeStream = true;
          setCaption(sentence);
          voice.queue(sentence, profile);
        }
      });
      if (result.kind === "timer") {
        life.startTimer(result.seconds);
        openPanel("timer");
        var line = "Timer set for " + Math.round(result.seconds / 60) + " minutes.";
        if (result.seconds < 60) line = "Timer set for " + result.seconds + " seconds.";
        setCaption(line);
        await voice.speak(line, profile);
      } else if (result.kind === "phone" || (result.kind === "messages" && result.command)) {
        setCaption(result.text);
        await voice.speak(result.text, profile);
        if (bubbles && result.command) bubbles.noteUsage("cmd:" + String(result.command).toLowerCase());
        if (bubbles) bubbles.noteAppMentions(text);
        if (bubbles) bubbles.refreshSuggestions();
        goShortcut(result.command, opts);
        if (result.kind === "messages" && !opts.collect) showMessagesButton(result.command);
      } else if (result.kind === "memory") {
        setCaption(result.text || "");
        renderMemory();
        if (bubbles) bubbles.refreshSuggestions();
        await voice.speak(result.text, profile);
      } else {
        setCaption(result.text || "");
        renderChat();
        if (bubbles && bubbles.noteAppMentions(text)) bubbles.refreshSuggestions();
        if (result.streamed || spokeStream) await voice.whenDone();
        else await voice.speak(result.text, profile);
      }
    } catch (err) {
      var msg = (err && err.message) || "Something went wrong.";
      setCaption(msg);
      toast(msg);
      try { await voice.speak(msg, profile); } catch (e) {}
    } finally {
      busy = false;
      if (neural) neural.setActive(null);
      document.getElementById("neural-caption").textContent = (profile.assistantName || "Friday").toUpperCase() + " · THINKING";
      if (opts.part) {
        // a step inside a multi-task sentence: the caller decides what happens next
      } else if (leftForApp) {
        leftForApp = false;
        orb.setTalking("idle", 0);
      } else if (handsFree && !voice.listening) {
        setTimeout(function () { beginListen(); }, 400);
      } else if (!voice.speaking) {
        orb.setTalking("idle", 0);
      }
    }
  }

  // ---------- 3.0: several steps, routines, messages, translator, recap ----------
  function joinList(a) { return a.length < 2 ? (a[0] || "") : a.slice(0, -1).join(", ") + ", and " + a[a.length - 1]; }

  async function runMany(steps, opener, outer) {
    var collect = (outer && outer.collect) || [];
    var own = !(outer && outer.collect);
    if (opener) { setCaption(opener); await voice.speak(opener, profile); }
    for (var i = 0; i < steps.length; i++) {
      await handleUtterance(steps[i], { part: true, collect: collect, showChat: false });
    }
    if (!own) return;
    if (collect.length) { runLeaveQueue(collect); orb.setTalking("idle", 0); return; }
    if (outer && outer.part) return;
    if (handsFree && !voice.listening) setTimeout(function () { beginListen(); }, 400);
    else if (!voice.speaking) orb.setTalking("idle", 0);
  }

  function rainChanceToday() {
    var t = new Promise(function (res) { setTimeout(function () { res(null); }, 4000); });
    var w = fetchWeather().then(function (x) { return x && x.rain != null ? x.rain : null; }, function () { return null; });
    return Promise.race([w, t]);
  }

  async function runRoutine(r, opts) {
    var hon = honorific(), steps = (r.steps || []).slice(), opener;
    if (r.builtin === "home") opener = "Welcome home" + (hon ? ", " + hon : "") + ".";
    else if (r.builtin === "leaving") {
      opener = "Have a good one" + (hon ? ", " + hon : "") + ".";
      var rain = await rainChanceToday();
      if (rain != null && rain >= 40) opener += " There's " + aPct(rain) + " percent chance of rain today, so grab an umbrella.";
    } else {
      if (!steps.length) {
        var none = "The " + String(r.phrase || "").toLowerCase() + " routine doesn't have any steps yet. You can add them in Settings, under Routines.";
        setCaption(none);
        await voice.speak(none, profile);
        return;
      }
      opener = "Starting " + String(r.phrase || "your routine").toLowerCase() + ".";
    }
    emitActivity("thinking", "Routine: " + (r.phrase || ""));
    chat._push("assistant", opener);
    if (!steps.length) { setCaption(opener); await voice.speak(opener, profile); return; }
    await runMany(steps, opener, opts);
  }

  async function runTranslate(tr) {
    setCaption("Translating…");
    emitActivity("research", "Translating to " + tr.language);
    var out = "";
    try {
      out = await window.FridayBrain.ask([
        { role: "system", content: "You are a translator. Translate the user's text into " + tr.language + ". Reply with only the translation, natural and everyday. No quotes, no notes, no pronunciation guide." },
        { role: "user", content: tr.text }
      ], { purpose: "chat", temperature: 0.2 });
    } catch (e) { out = ""; }
    out = String(out || "").trim().replace(/^["\u201C]+|["\u201D]+$/g, "");
    if (!out) {
      var fail = navigator.onLine === false ? "I need the internet to translate." : "I couldn't translate that just now.";
      setCaption(fail);
      await voice.speak(fail, profile);
      return;
    }
    var intro = "In " + tr.language + ", that's:";
    chat._push("assistant", intro + " " + out);
    setCaption(tr.language + ": " + out);
    voice.stopSpeak();
    voice.queue(intro, profile);
    voice.queue(out, profile, tr.code);
    await voice.whenDone();
  }

  function recapKey() {
    var d = new Date();
    if (d.getHours() < 3) d.setDate(d.getDate() - 1);
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  function recapDue() {
    var s = (settings && settings.values) || settingsData || {};
    if (s.nightlyRecap === false) return false;
    var h = new Date().getHours(), at = s.recapHour == null ? 21 : +s.recapHour;
    return (h >= at || h < 3) && FridayStorage.get("recapDate", "") !== recapKey();
  }
  async function runRecap() {
    FridayStorage.set("recapDate", recapKey());
    var hon = honorific(), bits = extras ? extras.recapBits() : { today: [], tomorrow: [] };
    setCaption("Putting your recap together…");
    emitActivity("weather", "Nightly recap");
    var wx = "";
    try { wx = await Promise.race([weatherSentence("tomorrow"), new Promise(function (r) { setTimeout(function () { r(""); }, 5000); })]); } catch (e) { wx = ""; }
    var parts = ["Here's your day" + (hon ? ", " + hon : "") + "."];
    parts.push(bits.today.length ? bits.today.join(" ") : "A quiet day. Nothing logged.");
    if (wx && !/couldn't|need the internet/i.test(wx)) parts.push(wx);
    if (bits.tomorrow.length) parts.push("For tomorrow, " + joinList(bits.tomorrow) + ".");
    parts.push("Sleep well" + (hon ? ", " + hon : "") + ".");
    var body = parts.join(" ");
    chat._push("assistant", body);
    setCaption(body);
    await voice.speak(body, profile);
  }

  // Texts from inside the app: the message opens filled in and you tap Send (iPhone always asks).
  // If that can't happen (no add-on, no number, switched off), the Shortcut sends it as before.
  async function textInApp(ex, text) {
    var N = window.FridayNative;
    if (!N || !N.isApp() || !N.kit || !N.kit.available() || !(window.FridayPhone && window.FridayPhone.inAppTexts())) return false;
    var who = ex.partner ? (ex.partner.contact || ex.partner.to) : ex.textSend.to;
    var body = ex.partner ? (ex.partner.command.replace(/^text .+? saying /, "")) : ex.textSend.body;
    var num = await N.contacts.numberFor(who);
    if (!num) return false;
    chat._push("user", text);
    var line = (ex.partner ? "Here's your message to " + ex.partner.to : "Here's your text to " + num.name.replace(/[^\w' -]+/g, "").trim()) + ". Tap Send.";
    chat._push("assistant", line);
    setCaption(line);
    emitActivity("messages", (ex.partner ? "Message for " + ex.partner.to : "Text to " + num.name));
    await voice.speak(line, profile);
    var r = await N.kit.text(num.number, body);
    if (!r.ok) return false;
    var after = r.result === "sent" ? "Sent." : r.result === "cancelled" ? "Okay, I didn't send it." : "";
    if (after) { setCaption(after); await voice.speak(after, profile); }
    return true;
  }

  async function runExtra(ex, text, opts) {
    if (ex.bedside) {
      chat._push("user", text);
      if (ex.bedside === "open") { openBedside(); var on = "Charging display on."; setCaption(on); await voice.speak(on, profile); }
      else { closeBedside(); setCaption("Charging display off."); }
      return;
    }
    if (ex.recap) { chat._push("user", text); await runRecap(); return; }
    if (ex.contacts) {
      chat._push("user", text);
      var N0 = window.FridayNative;
      var cr = N0 ? await N0.contacts.sync() : { ok: false, reason: "Contacts sync works in the installed app." };
      var cl = cr.ok ? "Synced " + cr.count + " contacts. Texts and calls will go to the right person now." : cr.reason;
      chat._push("assistant", cl); setCaption(cl); emitActivity("contacts", cl);
      await voice.speak(cl, profile);
      return;
    }
    if ((ex.partner || ex.textSend) && !opts.collect && await textInApp(ex, text)) return;
    if (ex.partner) {
      chat._push("user", text);
      var line = "Sending that to " + ex.partner.to + ".";
      chat._push("assistant", line);
      setCaption(line);
      emitActivity("shortcut", "Message for " + ex.partner.to);
      await voice.speak(line, profile);
      goShortcut(ex.partner.command, opts);
      return;
    }
    if (ex.textSend) {
      chat._push("user", text);
      var tl = "Texting " + ex.textSend.to.replace(/[^\w' -]+/g, "").trim() + ".";
      chat._push("assistant", tl);
      setCaption(tl);
      emitActivity("shortcut", "Text to " + ex.textSend.to);
      await voice.speak(tl, profile);
      goShortcut(ex.textSend.command, opts);
      return;
    }
    if (ex.translate) { chat._push("user", text); await runTranslate(ex.translate); return; }
    if (ex.routine) { chat._push("user", text); await runRoutine(ex.routine, opts); return; }
    chat._push("user", text);
    if (ex.say) chat._push("assistant", ex.say);
    if (ex.panel) openPanel(ex.panel); else refreshOpen();
    setCaption(ex.say || "");
    if (ex.tool) emitActivity("thinking", ex.tool === "spending" ? "Logged spending" : "Updated habits");
    await voice.speak(ex.say, profile);
  }

  // ---------- 3.0: links from Shortcuts automations (messages, charging) ----------
  var pendingMessage = false;
  function onIncomingMessage(L) {
    var pc = extras ? extras.partnerCfg(profile) : { display: "" };
    var who, line;
    if (L.kind === "text" || L.kind === "email") {
      who = L.from || "someone";
      line = (L.kind === "email" ? "Email from " : "Text from ") + who + ": " + L.text;
    } else {
      who = pc.display || L.app || "your partner";
      line = "Message from " + who + ": " + L.text;
    }
    chat._push("assistant", line);
    toast(line);
    emitActivity("speaking", "Message from " + who);
    if (bedside && bedside.on) bedside.message(who, L.text);
    pendingMessage = true;
    var tries = 0;
    (function go() {
      if ((busy || voice.speaking || document.visibilityState === "hidden") && tries++ < 40) { setTimeout(go, 700); return; }
      if (voice.listening) { try { voice.stopListen().catch(function () {}); } catch (e) {} document.getElementById("listen-dot").classList.remove("on"); }
      try { chime(); } catch (e) {}
      setCaption(line);
      setTimeout(function () {
        voice.speak(line, profile).then(function () {
          pendingMessage = false;
          if (IS_NATIVE && handsFreeOn() && !voice.listening && !busy) { handsFree = true; beginListen(); }
        });
      }, 700);
    })();
  }
  function handleLink(url) {
    var L = extras ? extras.parseLink(url) : null;
    if (!L) return;
    if (L.action === "msg") { onIncomingMessage(L); return; }
    if (L.action === "charging" || L.action === "bedside") { openBedside(); return; }
    if (L.action === "unplugged") { closeBedside(); return; }
    if (L.action === "listen" || L.action === "wake") {
      closePanels();
      setTimeout(function () {
        if (voice.speaking) voice.stopSpeak();
        if (!voice.listening && !busy) { handsFree = handsFreeOn(); beginListen(); }
      }, 350);
      return;
    }
    if ((L.action === "say" || L.action === "do") && (L.query.text || L.query.q)) { handleUtterance(L.query.text || L.query.q); return; }
    if (!L.action) continueLeaveQueue();
  }
  window.__fridayHandleLink = handleLink;

  // ---------- 3.0: charging display ----------
  var bedsideWx = "";
  function refreshBedsideWeather() {
    fetchWeather().then(function (w) {
      if (!w || w.temp == null) return;
      bedsideWx = w.temp + "\u00B0 " + (w.phrase || "") + (w.rain != null && w.rain >= 30 ? " \u00B7 " + w.rain + "% rain" : "");
    }, function () {});
  }
  function openBedside() {
    if (!bedside) return;
    closePanels();
    refreshBedsideWeather();
    clearInterval(openBedside._wx);
    openBedside._wx = setInterval(refreshBedsideWeather, 30 * 60 * 1000);
    bedside.open();
  }
  function closeBedside() {
    if (!bedside) return;
    clearInterval(openBedside._wx);
    bedside.close();
  }

  // ---------- 3.1: bills and countdowns ring through iPhone notifications ----------
  var _alertsT = 0;
  function scheduleLifeAlerts() {
    clearTimeout(_alertsT);
    _alertsT = setTimeout(async function () {
      var N = window.FridayNative, D = window.FridayLifeData;
      if (!N || !N.notify.allowed() || !D) return;
      var s = (settings && settings.values) || settingsData || {};
      var old = FridayStorage.get("alertKeys", []) || [];
      for (var i = 0; i < old.length; i++) await N.notify.cancel(old[i]);
      var keys = [];
      function nine(daysAhead) { var at = new Date(); at.setHours(9, 0, 0, 0); at.setDate(at.getDate() + daysAhead); return at; }
      if (s.billAlerts !== false) D.bills().forEach(function (b) {
        var st = D.billStatus(b);
        if (!st || st.paid || st.days < 0 || st.days > 40) return;
        var at = nine(st.days), key = "bill:" + (b.id || b.name) + ":" + at.toDateString();
        keys.push(key);
        N.notify.at(key, b.name + " bill is due today", (b.amount ? D.money(b.amount) + ". " : "") + "Tell " + (profile.assistantName || "Friday") + " when it's paid.", at);
      });
      if (s.countdownAlerts !== false) D.countdowns().forEach(function (c) {
        var n = D.countdownDays(c);
        if (n == null || n < 0 || n > 60) return;
        var at = nine(n), key = "cd:" + (c.id || c.name) + ":" + at.toDateString();
        keys.push(key);
        N.notify.at(key, c.name + " is today!", "Counting down with " + (profile.assistantName || "Friday") + ".", at);
      });
      FridayStorage.set("alertKeys", keys);
    }, 800);
  }
  async function turnOnNotifications() {
    var N = window.FridayNative;
    if (!N || !N.notify.available()) { toast("Notifications work in the installed app."); return false; }
    var ok = await N.notify.ask();
    FridayStorage.set("notifyAsked", true);
    toast(ok ? "Notifications are on." : "Notifications are off. Turn them on in iPhone Settings, " + (profile.assistantName || "Friday") + ", Notifications.");
    if (ok) scheduleLifeAlerts();
    return ok;
  }
  window.__fridayTurnOnNotifications = turnOnNotifications;

  // ---------- 3.0: battery savers for the orb ----------
  var lastActivity = Date.now();
  function applyPower() {
    if (!orb || !orb.setPower) return;
    var s = (settings && settings.values) || settingsData || {};
    var active = busy || (voice && (voice.speaking || voice.listening));
    if (active) lastActivity = Date.now();
    var rest = s.restingOrb !== false && !active && Date.now() - lastActivity > 60000;
    var night = s.nightOrb !== false && !!(window.FridayNight && window.FridayNight.isNight());
    orb.setPower({ rest: rest, night: night, saver: !!orb.lowPower });
  }
  // ---------- background window (3.1.3) ----------
  // When you switch apps while talking with her, she keeps going for the minutes set in
  // Settings → Voice & Talking, then goes to sleep. Back Tap or the widget wakes her any time.
  var bgTimer = 0, bgTick = 0;
  function bgMinutes() {
    var s = FridayStorage.get("settings", null) || (settings && settings.values) || settingsData || {};
    var m = parseInt(s.bgMinutes, 10);
    return isNaN(m) ? 3 : Math.max(0, Math.min(10, m));
  }
  function keepInBackground() {
    var mins = bgMinutes();
    if (!mins || !(voice.listening || voice.speaking || busy || handsFree)) return false;
    // She sent you to another app on purpose (a Shortcut, a call, Music): don't keep listening there.
    if (Date.now() - handedOffAt < 8000) return false;
    voice.keepAlive(true);
    var start = Date.now();
    FridayStorage.set("bgWindow", { start: start, mins: mins, awake: 0 });
    clearTimeout(bgTimer); clearInterval(bgTick);
    // a heartbeat, so we can tell afterwards how long iOS really let her stay awake
    bgTick = setInterval(function () {
      var w = FridayStorage.get("bgWindow", null);
      if (w && w.start === start) { w.awake = Date.now() - start; FridayStorage.set("bgWindow", w); }
    }, 5000);
    bgTimer = setTimeout(function () { endBackgroundWindow(true); }, mins * 60000);
    return true;
  }
  function endBackgroundWindow(sleep) {
    var had = !!bgTimer;
    clearTimeout(bgTimer); clearInterval(bgTick); bgTimer = 0; bgTick = 0;
    voice.keepAlive(false);
    if (sleep) {
      handsFree = false;
      try { voice.releaseMic(); } catch (e) {}
      var d = document.getElementById("listen-dot"); if (d) d.classList.remove("on");
    }
    return had;
  }

  function noteActivity() { lastActivity = Date.now(); applyPower(); }

  async function beginListen() {
    if (busy || voice.listening) return;
    try {
      document.getElementById("listen-dot").classList.add("on");
      setCaption("Listening…");
      orb.setTalking("user", 0);
      await voice.startListen();
    } catch (err) {
      document.getElementById("listen-dot").classList.remove("on");
      orb.setTalking("idle", 0);
      var msg = (err && err.name === "NotAllowedError")
        ? "Microphone permission is needed to talk."
        : ((err && err.message) || "Could not listen.");
      setCaption(msg);
      toast(msg);
    }
  }

  async function endListen() {
    document.getElementById("listen-dot").classList.remove("on");
    if (!voice.listening) return;
    setCaption("Working…");
    orb.setTalking("idle", 0);
    var text = "";
    try {
      text = await voice.stopListen();
    } catch (err) {
      if (err && err.message === "whisper-failed" && window.webkitSpeechRecognition) {
        toast("Trying the on-phone listener…");
        // already stopped; nothing else
      } else {
        setCaption((err && err.message) || "Could not hear that.");
        return;
      }
    }
    if (!text) {
      setCaption("I didn't catch that.");
      if (handsFree) setTimeout(function () { beginListen(); }, 500);
      return;
    }
    await handleUtterance(text);
  }

  function toggleListen() {
    // One tap starts a hands-free conversation; she stops listening on her own
    // when you pause. Tapping again ends the conversation.
    if (handsFree || voice.listening || voice.speaking || busy) {
      handsFree = false;
      if (voice.speaking) voice.stopSpeak();
      if (voice.listening) {
        document.getElementById("listen-dot").classList.remove("on");
        voice.stopListen().catch(function () {});
      }
      orb.setTalking("idle", 0);
      setCaption("Tap to talk");
      return;
    }
    handsFree = handsFreeOn();
    beginListen();
  }

  var lastPhoto = null;

  function chime() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    var ctx = new Ctx();
    [0, 0.28, 0.56].forEach(function (t, i) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = [880, 1108.73, 1318.51][i];
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.6);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.65);
    });
    setTimeout(function () { try { ctx.close(); } catch (e) {} }, 1600);
  }

  function applyNight() {
    var on = !!(window.FridayNight && window.FridayNight.isNight());
    document.body.classList.toggle("night", on);
  }

  // ---------- diagnostics ----------
  async function runDiagnostics(speak) {
    var lines = [], problems = 0;
    function add(ok, text) { lines.push((ok ? "✓ " : "✗ ") + text); if (!ok) problems++; }
    setCaption("Running diagnostics…");
    emitActivity("thinking", "Ran diagnostics");
    add(navigator.onLine !== false, navigator.onLine !== false ? "Internet connected" : "No internet connection");
    var key = FridayStorage.getApiKey();
    var models = [];
    if (!key) add(false, "No Groq key saved (Settings → Groq API key)");
    else {
      try {
        var r = await fetch(window.FridayBrain.GROQ_BASE + "/models", { headers: { Authorization: "Bearer " + key } });
        if (r.status === 401) add(false, "Groq key was rejected — replace it in Settings");
        else if (r.ok) { var j = await r.json(); models = (j.data || []).map(function (m) { return m.id; }); add(true, "Groq key works"); }
        else add(false, "Groq answered with an error (" + r.status + ")");
      } catch (e) { add(false, "Couldn't reach Groq"); }
    }
    if (models.length) {
      var want = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
      var have = want.filter(function (m) { return models.indexOf(m) >= 0; });
      add(have.length >= 2, have.length + " of " + want.length + " chat brains available");
      var hasVoice = models.some(function (m) { return /orpheus/.test(m); });
      add(hasVoice, hasVoice ? "AI voices available" : "AI voices not offered on this key (iPhone voices still work)");
      var hasVision = models.some(function (m) { return /qwen3\.\d|llama-4|vision/.test(m); });
      add(hasVision, hasVision ? "Photo vision available" : "No vision model found for photos");
    }
    var st = window.FridayBrain.status();
    add(true, st.backups.length ? "Backup brains: " + st.backups.join(", ") : "No backup brain (optional, Settings → Connections)");
    if (st.busy.length) add(false, st.busy.length + " brain" + (st.busy.length > 1 ? "s are" : " is") + " resting after hitting a limit");
    var pause = FridayStorage.get("aiVoicePauseUntil", 0) || 0;
    if (pause > Date.now()) add(false, "AI voice resting until " + new Date(pause).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    add(!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia), navigator.mediaDevices ? "Microphone available" : "Microphone not available in this app");
    add(!!settings.shortcutName(), "Shortcut name: " + settings.shortcutName());
    var used = 0;
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); used += (localStorage.getItem(k) || "").length + k.length; } } catch (e) {}
    add(used < 4000000, "Storage used: " + Math.round(used / 1024) + " KB");
    var u = FridayStorage.get("usage.brain", null);
    if (u && u.date === new Date().toDateString()) add(true, "Today: " + (u.total || 0) + " replies, " + (u.tts || 0) + " AI voice clips");
    var box = document.getElementById("diag-list");
    if (box) { box.innerHTML = ""; lines.forEach(function (l) { var d = document.createElement("div"); d.className = "diag-row" + (l.charAt(0) === "✗" ? " bad" : ""); d.textContent = l; box.appendChild(d); }); }
    openPanel("diag");
    var summary = problems ? "Diagnostics done. I found " + problems + " thing" + (problems > 1 ? "s" : "") + " to look at; they're on screen." : "All systems normal" + (honorific() ? ", " + honorific() : "") + ".";
    setCaption(summary);
    if (speak) await voice.speak(summary, profile);
    return problems;
  }

  function maybeBackupReminder() {
    var last = FridayStorage.get("lastBackupAt", 0) || 0;
    var nag = FridayStorage.get("backupNagAt", 0) || 0;
    var mem = (chat && chat.memory && chat.memory.length) || 0;
    var week = 7 * 864e5;
    if (!mem && !FridayStorage.get("lists", null)) return;
    if (!last) { FridayStorage.set("lastBackupAt", Date.now()); return; }
    if (Date.now() - last > week && Date.now() - nag > 864e5) {
      FridayStorage.set("backupNagAt", Date.now());
      setTimeout(function () { toast("It's been a week since your last backup. Settings → Download backup."); }, 4000);
    }
  }

  function warmUp() {
    var key = FridayStorage.getApiKey();
    if (!key || navigator.onLine === false) return;
    try { fetch(window.FridayBrain.GROQ_BASE + "/models", { headers: { Authorization: "Bearer " + key } }).catch(function () {}); } catch (e) {}
  }

  function showVersion() {
    var t = "Version " + APP_VERSION + " · " + APP_LABEL;
    ["app-version", "app-version-about"].forEach(function (id) { var e = document.getElementById(id); if (e) e.textContent = t; });
  }

  function maybeWhatsNew() {
    showVersion();
    var seen = FridayStorage.get("seenVersion", "");
    if (seen === APP_VERSION) return;
    var box = document.getElementById("whatsnew");
    if (!box) return;
    if (!FridayStorage.hasApiKey()) { FridayStorage.set("seenVersion", APP_VERSION); return; }
    box.classList.remove("hidden");
    function done() { box.classList.add("hidden"); FridayStorage.set("seenVersion", APP_VERSION); }
    document.getElementById("btn-wn-close").onclick = done;
    document.getElementById("btn-wn-shortcut").onclick = function () {
      done();
      openPanel("settings");
      if (window.__fridaySettingsShow) window.__fridaySettingsShow("aidot-status");
      setTimeout(function () { var el = document.getElementById("accord-aidot"); if (el) { el.open = true; try { el.scrollIntoView({ block: "start", behavior: "smooth" }); } catch (e) {} } }, 250);
    };
  }

  function showSetup(on) {
    document.getElementById("setup").classList.toggle("open", !!on);
  }

  function init() {
    document.getElementById("caption-name").textContent = (profile.assistantName || "Friday").toLowerCase();
    document.getElementById("setup-name").textContent = (profile.assistantName || "Friday").toLowerCase();
    document.title = profile.assistantName || "Friday";

    orb = new FridayOrb(document.getElementById("orb-canvas"));
    orb.setLook(settingsData.look || profile.defaultLook || "N");
    orb.start();

    voice = new FridayVoice({
      onVolume: function (v, who) {
        if (who === "idle") orb.setTalking("idle", 0);
        else orb.setTalking(who || (voice.speaking ? "friday" : "user"), v);
      },
      onSyllable: function () { orb.notifySyllable(); },
      onState: function (st) {
        if (st === "speak-start") emitActivity("speaking", null, { quiet: true });
        else if (st === "listen-start") emitActivity("listening", null, { quiet: true });
        if (st === "speak-start" || st === "listen-start") {
          noteActivity();
          if (bedside && bedside.on) bedside.wake();
        }
      },
      onSilence: function () { if (voice.listening) endListen(); },
      // Live listening: your words show up as you talk.
      onPartial: function (text) { if (voice.listening && text) setCaption("“" + text + "”"); },
      onBargeIn: function () {
        voice.stopSpeak();
        busy = false;
        handsFree = true;
        setTimeout(function () { beginListen(); }, 60);
      }
    });
    if (!FridayStorage.get("voiceGenderFixed", false)) {
      var vfix = false;
      if (!FridayVoice.voiceFitsGender(settingsData.voiceURI || "", profile.voiceGender, voice.listVoices())) { settingsData.voiceURI = ""; vfix = true; }
      if (!FridayVoice.voiceFitsGender(settingsData.fallbackVoiceURI || "", profile.voiceGender, voice.listVoices())) { settingsData.fallbackVoiceURI = ""; vfix = true; }
      if (vfix) FridayStorage.set("settings", settingsData);
      FridayStorage.set("voiceGenderFixed", true);
    }
    voice.setVoiceURI(settingsData.voiceURI || "");
    voice.autoAi = FridayVoice.autoAiFor(profile);

    chat = new FridayChat({
      profile: profile,
      onHelper: function (kind) {
        if (neural) neural.setActive(kind || (busy ? "thinking" : null));
        if (kind && kind !== "thinking") {
          document.getElementById("neural-caption").textContent =
            (profile.assistantName || "Friday").toUpperCase() + " · " + String(kind).toUpperCase();
        }
      }
    });

    tools = new FridayTools({ onToast: toast });
    window.__fridayTools = tools;

    life = new FridayLife({
      profile: profile,
      onToast: toast,
      onTimerDone: function (t, missed) {
        var name = /^Timer( \d+)?$/.test(t.name) ? "Your timer" : "Your " + t.name.toLowerCase() + " timer";
        var line = missed ? name + " finished while you were away." : name + " is done" + (honorific() ? ", " + honorific() : "") + ".";
        try { chime(); } catch (e) {}
        toast(line);
        speakLine(line);
        var tb = document.getElementById("timers-box"); if (tb) tb._key = null;
      }
    });

    eyes = new FridayEyes({
      profile: profile,
      onStart: function () {
        emitActivity("vision", "Looking at a photo");
        setCaption("Looking…");
        if (neural) neural.setActive("research");
        orb.setTalking("user", 0.3);
      },
      onAnswer: function (text, q, data) {
        if (neural) neural.setActive(null);
        lastPhoto = data;
        chat._push("user", "(showed a photo) " + q);
        chat._push("assistant", text);
        openPanel("photo");
        var img = document.getElementById("photo-img"); if (img) img.src = data;
        var ans = document.getElementById("photo-answer"); if (ans) ans.textContent = text;
        speakLine(text);
      },
      onError: function (msg) {
        if (neural) neural.setActive(null);
        orb.setTalking("idle", 0);
        setCaption(msg); toast(msg); speakLine(msg);
      }
    });

    bubbles = new FridayBubbles({
      el: document.getElementById("bubbles"),
      profile: profile,
      onAction: function (act) {
        if (act.type === "panel") openPanel(act.panel);
        else if (act.type === "shortcut" && /^weather$/i.test(String(act.command || "").trim())) {
          handleUtterance("weather");
        }
        else if (act.type === "shortcut") {
          setCaption("On it.");
          runShortcut(act.command);
        } else if (act.type === "url") openUrl(act.url);
      },
      onAddRequest: function () { openPanel("add-bubble"); },
      onLayout: function (mode, revealed) { applyOrbFrame(mode, revealed); },
      frameFor: function (mode) { return LAYOUT_FRAMES[mode] || LAYOUT_FRAMES.orbit; }
    });

    settings = new FridaySettings({
      profile: profile,
      voice: voice,
      onLook: function (id) { applyLook(id, true); },
      onLayout: function (id) { applyLayout(id, true); },
      onIcon: function (id) { applyAppIcon(id); },
      onChips: function () { renderChips(); },
      onReset: function () { toast("Reset. Reloading."); setTimeout(function () { location.reload(); }, 400); },
      onToast: toast,
      onRender: function (mode) {
        if (orb && orb.setRender) orb.setRender(mode);
        if (settings && settings._bindLooks) settings._bindLooks();
      },
      onNight: function () { applyNight(); },
      onLearnBubbles: function (on) {
        bubbles.setLearning(on);
        toast(on ? "Starting small. The bubbles you use will show up over time." : "Your full layout is back.");
      },
      onAddBubble: function (spec) {
        bubbles.add(spec);
        closePanels();
        bubbles.setEdit(true);
        toast("Added to the map.");
      }
    });

    bubbles.onLearned = function (added) {
      var names = added.map(function (b) { return b.label || "a bubble"; });
      toast("Added " + names.slice(0, 2).join(" and ") + " to your map. You use " + (names.length > 1 ? "them" : "it") + " a lot.");
    };
    applyLayout(settings.values.layout || "orbit", true);
    tickStageClock();
    setInterval(tickStageClock, 15000);
    window.__friday = { bubbles: bubbles, orb: orb, applyLayout: applyLayout, applyLook: applyLook, voice: voice };
    if (settings.values.iconId) applyAppIcon(settings.values.iconId);
    renderChips();

    neural = new FridayNeural(document.getElementById("neural-canvas"));
    if (window.__friday) window.__friday.neural = neural;
    neural.onOpen = function (panel) { openPanel(panel); };

    document.getElementById("orb-canvas").addEventListener("click", function () {
      if (document.querySelector(".panel.open")) return;
      toggleListen();
    });

    (function bindLookSwipe() {
      var zone = document.getElementById("orb-swipe");
      if (!zone) return;
      var x0 = 0, y0 = 0, t0 = 0, moved = false;
      function start(ev) {
        var p = ev.touches ? ev.touches[0] : ev;
        x0 = p.clientX; y0 = p.clientY; t0 = Date.now(); moved = false;
      }
      function move(ev) {
        var p = ev.touches ? ev.touches[0] : ev;
        if (Math.hypot(p.clientX - x0, p.clientY - y0) > 12) moved = true;
      }
      function end(ev) {
        var p = (ev.changedTouches && ev.changedTouches[0]) || ev;
        var dx = p.clientX - x0, dy = p.clientY - y0;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.15) {
          ev.preventDefault();
          cycleLook(dx < 0 ? 1 : -1);
          return;
        }
        if (ev.type === "touchend") { window.__lastTouchEnd = Date.now(); }
        else if (window.__lastTouchEnd && Date.now() - window.__lastTouchEnd < 800) return;
        if (!moved && Date.now() - t0 < 450) {
          if (document.querySelector(".panel.open")) return;
          if (ev.type === "touchend" && ev.cancelable) ev.preventDefault();
          toggleListen();
        }
      }
      zone.addEventListener("touchstart", start, { passive: true });
      zone.addEventListener("touchmove", move, { passive: true });
      zone.addEventListener("touchend", end);
      zone.addEventListener("mousedown", start);
      zone.addEventListener("mousemove", move);
      zone.addEventListener("mouseup", end);
    })();

    document.getElementById("btn-settings").onclick = function () { openPanel("settings"); };
    document.getElementById("btn-chat").onclick = function () { openPanel("chat"); };
    document.getElementById("btn-neural").onclick = function () { openPanel("neural"); };
    document.querySelectorAll("[data-close]").forEach(function (b) {
      b.addEventListener("click", closePanels);
    });
    document.getElementById("btn-edit-done").onclick = function () { bubbles.setEdit(false); };
    document.getElementById("btn-edit-reset").onclick = function () { bubbles.resetLayout(); };
    var rl = document.getElementById("btn-settings-reset-layout");
    if (rl) rl.onclick = function () { bubbles.resetLayout(); toast("Layout reset. Every bubble has its own spot."); };

    document.getElementById("composer").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var input = document.getElementById("chat-input");
      var text = input.value.trim();
      input.value = "";
      if (text) handleUtterance(text, { showChat: true });
    });
    document.getElementById("note-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      tools.addNote(document.getElementById("note-text").value);
      document.getElementById("note-text").value = "";
      renderNotes();
    });
    document.getElementById("memory-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      chat.addMemory(document.getElementById("memory-text").value);
      document.getElementById("memory-text").value = "";
      renderMemory();
    });
    document.getElementById("timer-start").onclick = function () {
      var m = parseInt(document.getElementById("timer-min").value, 10) || 0;
      var s = parseInt(document.getElementById("timer-sec").value, 10) || 0;
      if (m * 60 + s <= 0) { toast("Set some minutes or seconds first."); return; }
      var nm = document.getElementById("timer-name").value.trim();
      life.startTimer(m * 60 + s, nm);
      document.getElementById("timer-name").value = "";
      var tb = document.getElementById("timers-box"); tb._key = null; life.renderTimers(tb);
    };
    document.getElementById("timer-cancel").onclick = function () {
      FridayStorage.set("timers", []);
      var tb = document.getElementById("timers-box"); tb._key = null; life.renderTimers(tb);
      toast("All timers cancelled.");
    };
    var tq = document.getElementById("timer-quick");
    if (tq) [1, 3, 5, 10, 15, 30, 60].forEach(function (min) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "life-tab"; b.textContent = min < 60 ? min + " min" : "1 hr";
      b.onclick = function () { life.startTimer(min * 60, ""); var tb = document.getElementById("timers-box"); tb._key = null; life.renderTimers(tb); };
      tq.appendChild(b);
    });
    var oc = document.getElementById("btn-open-countdowns");
    if (oc) oc.onclick = function () { openPanel("countdowns"); };
    window.addEventListener("friday:tick", function () {
      var p = document.getElementById("panel-timer");
      if (p && p.classList.contains("open")) life.renderTimers(document.getElementById("timers-box"));
    });
    ["friday:lists", "friday:bills", "friday:countdowns", "friday:notes", "friday:timers"].forEach(function (ev) {
      window.addEventListener(ev, function () { if (ev === "friday:timers") { var tb = document.getElementById("timers-box"); if (tb) tb._key = null; } });
    });
    var ms = document.getElementById("memory-search");
    if (ms) ms.addEventListener("input", renderMemory);
    var mf = document.getElementById("memory-filter");
    if (mf) mf.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-f]");
      if (!b) return;
      memFilter = b.getAttribute("data-f");
      mf.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
      renderMemory();
    });
    document.getElementById("btn-eyes").onclick = function () { eyes.open(""); };
    document.getElementById("btn-photo-again").onclick = function () { eyes.open(""); };
    document.getElementById("photo-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var q = document.getElementById("photo-q").value.trim();
      if (!q || !lastPhoto) return;
      document.getElementById("photo-q").value = "";
      var ans = document.getElementById("photo-answer");
      if (ans) ans.textContent = "Looking…";
      window.FridayBrain.ask([
        { role: "system", content: "You are " + (profile.assistantName || "Friday") + ". Answer about the photo in two to four short spoken sentences, no lists or markdown." },
        { role: "user", content: [{ type: "text", text: q }, { type: "image_url", image_url: { url: lastPhoto } }] }
      ], { purpose: "vision", temperature: 0.4, max_tokens: 400 }).then(function (t) {
        t = window.FridayGroq.cleanSpoken(t);
        if (ans) ans.textContent = t;
        speakLine(t);
      }, function () { if (ans) ans.textContent = "My vision is busy right now. Try again in a minute."; });
    });
    document.getElementById("money-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var text = document.getElementById("money-text").value.trim();
      if (!text) return;
      closePanels();
      handleUtterance(text);
    });

    var presets = document.getElementById("bubble-presets");
    bubbles.presets().forEach(function (p) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn";
      btn.textContent = p.label || p.kind;
      btn.addEventListener("click", function () {
        bubbles.add(p);
        closePanels();
        bubbles.setEdit(true);
      });
      presets.appendChild(btn);
    });

    var selectedKind = "link";
    var iconPick = document.getElementById("custom-icon-pick");
    function renderCustomIcons() {
      if (!iconPick || !window.FridayBubbleIcons) return;
      iconPick.innerHTML = "";
      Object.keys(FridayBubbleIcons).forEach(function (kind) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = kind === selectedKind ? "on" : "";
        btn.setAttribute("data-kind", kind);
        btn.setAttribute("aria-label", kind);
        btn.innerHTML = FridayBubbleIcons[kind];
        btn.addEventListener("click", function () {
          selectedKind = kind;
          renderCustomIcons();
        });
        iconPick.appendChild(btn);
      });
    }
    renderCustomIcons();

    var schemeList = document.getElementById("app-scheme-list");
    if (schemeList && window.FridayAppSchemes) {
      FridayAppSchemes.forEach(function (app) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn";
        btn.textContent = app.name;
        btn.addEventListener("click", function () {
          document.getElementById("custom-label").value = app.name;
          document.getElementById("custom-url").value = app.url;
          selectedKind = app.kind || "link";
          renderCustomIcons();
        });
        schemeList.appendChild(btn);
      });
    }

    document.getElementById("btn-custom-bubble").onclick = function () {
      var label = document.getElementById("custom-label").value.trim() || "App";
      var url = normalizeEnteredUrl(document.getElementById("custom-url").value);
      if (!url) { toast("Add a link or app scheme first."); return; }
      bubbles.add({ kind: selectedKind || "link", label: label, gold: true, size: "lg", action: "url", url: url, custom: true });
      document.getElementById("custom-label").value = "";
      document.getElementById("custom-url").value = "";
      selectedKind = "link";
      renderCustomIcons();
      closePanels();
      bubbles.setEdit(true);
    };

    window.addEventListener("friday:daddy", function () { bubbles.syncDaddy(); });
    window.addEventListener("friday:memory", function () {
      if (bubbles) bubbles.refreshSuggestions();
    });

    document.getElementById("setup-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var key = document.getElementById("setup-key").value.trim();
      if (!key) return;
      FridayStorage.setApiKey(key);
      document.getElementById("setup-key").value = "";
      showSetup(false);
      toast("Key saved on this phone.");
    });

    if (!FridayStorage.hasApiKey()) showSetup(true);

    life.restore();
    setTimeout(warmUp, 1200);
    maybeBackupReminder();
    window.addEventListener("online", function () { toast("Back online."); });
    window.addEventListener("offline", function () { toast("Offline. Lists, timers and notes still work."); });
    var diagBtn = document.getElementById("btn-diag");
    if (diagBtn) diagBtn.onclick = function () { runDiagnostics(false); };
    var diagAgain = document.getElementById("btn-diag-again");
    if (diagAgain) diagAgain.onclick = function () { runDiagnostics(false); };
    applyNight();
    setInterval(applyNight, 60000);
    maybeWhatsNew();

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") { if (orb) orb.stop(); }
      else if (orb && !document.querySelector(".panel.open")) orb.start();
    });

    if (IS_NATIVE) {
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState !== "visible") {
          // Mid-conversation: stay awake for a while in the background, then sleep.
          if (keepInBackground()) return;
          if (voice.listening || voice.speaking) { try { voice.releaseMic(); } catch (e) {} }
          else { try { voice.releaseMic(); } catch (e) {} }
          document.getElementById("listen-dot").classList.remove("on");
          return;
        }
        // Back from another app: a listen left over from the background may have been cut off by iOS,
        // so start a fresh one (hands-free picks it up below) instead of waiting on a dead one.
        if (endBackgroundWindow(false) && voice.listening) { try { voice.releaseMic(); } catch (e) {} }
        if (window.FridayNative && FridayNative.notify.refresh) FridayNative.notify.refresh().then(function () { if (settings && settings._refreshPhone) settings._refreshPhone(); });
        busy = false;
        if (continueLeaveQueue()) return;
        if (!FridayStorage.hasApiKey() || document.querySelector(".panel.open")) return;
        setTimeout(function () {
          if (pendingMessage || voice.listening || voice.speaking || busy) return;
          if (recapDue()) { runRecap(); return; }
          if (handsFreeOn()) { handsFree = true; beginListen(); }
        }, 600);
      });
    }

    if (handsFree && FridayStorage.hasApiKey()) {
      setCaption("Listening…");
      setTimeout(function () { beginListen(); }, 600);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }

    // ---------- 3.0 ----------
    if (extras) {
      bedside = new extras.Bedside({
        weather: function () { return bedsideWx; },
        onTalk: function () { toggleListen(); },
        onDim: function () { if (orb) orb.stop(); },
        onWake: function () { if (orb && !orb.running && !document.querySelector(".panel.open") && document.visibilityState !== "hidden") orb.start(); },
        busy: function () { return busy || voice.speaking || voice.listening; }
      });
      if (window.__friday) window.__friday.bedside = bedside;
      var bb = document.getElementById("btn-bedside");
      if (bb) bb.onclick = function () { openBedside(); };
      window.addEventListener("friday:habits", function () { refreshOpen(); });
      window.addEventListener("friday:spending", function () { refreshOpen(); });
    }
    ["touchstart", "mousedown", "keydown"].forEach(function (ev) { document.addEventListener(ev, noteActivity, { passive: true }); });
    document.addEventListener("touchend", function () { if (voice && voice.unlockAudio) voice.unlockAudio(); }, { passive: true });
    window.addEventListener("friday:lowpower", function (e) {
      applyPower();
      if (e.detail && e.detail.on && !applyPower._told) { applyPower._told = true; toast("Low Power Mode noticed. Using the lighter orb."); }
    });
    setInterval(applyPower, 5000);
    applyPower();
    window.addEventListener("friday:bills", scheduleLifeAlerts);
    window.addEventListener("friday:countdowns", scheduleLifeAlerts);
    scheduleLifeAlerts();
    if (window.FridayNative && FridayNative.isApp() && FridayNative.notify.refresh) {
      FridayNative.notify.refresh().then(function (on) { if (on) scheduleLifeAlerts(); if (settings && settings._refreshPhone) settings._refreshPhone(); });
    }
    // keep contact names fresh (no prompt if already allowed)
    if (window.FridayNative && window.FridayNative.contacts.available() && window.FridayNative.contacts.syncedAt() && Date.now() - window.FridayNative.contacts.syncedAt() > 3 * 864e5) {
      setTimeout(function () { window.FridayNative.contacts.sync(); }, 5000);
    }
    var CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (CapApp) {
      try { CapApp.addListener("appUrlOpen", function (e) { handleLink(e && e.url); }); } catch (e) {}
      try { var lu = CapApp.getLaunchUrl(); if (lu && lu.then) lu.then(function (r) { if (r && r.url) handleLink(r.url); }, function () {}); } catch (e) {}
    }
    var qlink = cfg.queryParam("link");
    if (qlink) setTimeout(function () { handleLink(qlink); }, 900);

    setTimeout(maybeGreet, 700);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
// build 5 (v3.1)
