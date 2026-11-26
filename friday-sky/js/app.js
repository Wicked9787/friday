/* Friday app bootstrap: orb, voice, chat, bubbles, panels, phone handoff. */
(function () {
  "use strict";

  var cfg = window.FRIDAY_CONFIG;
  var profile = cfg.getProfile();
  window.__fridayProfile = profile;
  var settingsData = window.FridayLoadSettings();

  var orb, voice, chat, bubbles, tools, settings, neural, life, eyes, bedside;
  var extras = window.FridayExtras || null;
  var APP_VERSION = "4.2.2";
  var APP_LABEL = "Remote";
  function shownName() { try { return window.FRIDAY_CONFIG.shownName(profile); } catch (e) { return (profile && profile.assistantName) || "Friday"; } }
  function fillShownName() {
    var n = shownName(), reed = profile && profile.id === "batsie";
    document.querySelectorAll(".sc-shown").forEach(function (e) { e.textContent = n; });
    document.querySelectorAll(reed ? ".only-sky" : ".only-reed").forEach(function (e) { e.hidden = true; });
  }
  var IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  var handsFree = cfg.queryParam("listen") === "1" || (IS_NATIVE && settingsData.handsFree !== false && settingsData.mood !== "headache");
  function headacheOn() { var v = FridayStorage.get("settings", null) || (settings && settings.values) || settingsData || {}; return v.mood === "headache"; }
  function handsFreeOn() { var v = (settings && settings.values) || settingsData || {}; return v.handsFree !== false && !headacheOn(); }
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
    setTimeout(function () { syncWidget(); }, 0);
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
    immersive: { cyN: 0.50, radiusK: 0.42 },
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
    // While typing with the Pill bar, her orb stays up top even if the bubbles re-arrange.
    if (typing && orb) {
      var tv = sv();
      if (tv.talkStyle !== "dock" && tv.hideOrbTyping !== true) { orb.setFrame({ cyN: 0.2, radiusK: 0.17 }); return; }
    }
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
    if (typing) exitTyping();
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
    if (id === "private") renderPrivate();
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
  /* 3.5.7: she never hands anything to the Shortcut on her own. If she can't do it in the app,
     she asks first. "Yes" hands it over, "no" leaves it, anything else just moves on. */
  var pendingShortcut = null; // { items: [{ kind, value }], at }
  var SC_LEAD = "^(?:(?:hey |ok |okay )?(?:friday|jarvis|reed)[, ]+)?";
  var SC_YES = new RegExp(SC_LEAD + "(?:yes|yeah|yea|yep|yup|sure|ok|okay|do it|go ahead|please do|please|yes please|go for it|hand it over|send it|use (?:the |my )?shortcut)(?:,? (?:please|thanks|thank you|friday|reed))?[.!]*$", "i");
  var SC_NO = new RegExp(SC_LEAD + "(?:no|nope|nah|no thanks|no thank you|don'?t|never ?mind|leave it|skip it|cancel|forget it|not now)(?:,? (?:thanks|thank you|friday|reed))?[.!]*$", "i");
  function cantLine() { var h = honorific(); return "I can't do that one in the app" + (h ? ", " + h : "") + "."; }
  async function offerShortcut(items, line, quiet) {
    pendingShortcut = { items: items, at: Date.now() };
    emitActivity("shortcut", "Asked before using the Shortcut");
    if (quiet) return;
    chat._push("assistant", line);
    setCaption(line);
    await voice.speak(line, profile);
  }
  async function goShortcut(cmd, opts, lead) {
    if (opts && opts.collect) { opts.collect.push({ kind: "shortcut", value: cmd }); return; }
    await offerShortcut([{ kind: "shortcut", value: cmd }], (lead === undefined ? cantLine() : lead) + (lead === "" ? "" : " ") + "Want me to hand it to your Shortcut?");
  }
  // Called at the top of every request while she's waiting on a yes or no.
  async function answerShortcut(text) {
    if (!pendingShortcut) return false;
    if (Date.now() - pendingShortcut.at > 120000) { pendingShortcut = null; return false; }
    var t = String(text || "").replace(/[\u2019]/g, "'").trim();
    var items = pendingShortcut.items;
    if (SC_YES.test(t)) {
      pendingShortcut = null;
      chat._push("user", text);
      var ok = "Handing it to your Shortcut.";
      chat._push("assistant", ok); setCaption(ok);
      await voice.speak(ok, profile);
      runLeaveQueue(items);
      return true;
    }
    if (SC_NO.test(t)) {
      pendingShortcut = null;
      chat._push("user", text);
      var nope = "Okay, I'll leave it.";
      chat._push("assistant", nope); setCaption(nope);
      await voice.speak(nope, profile);
      var urls = items.filter(function (it) { return it.kind === "url"; });
      if (urls.length) runLeaveQueue(urls);
      return true;
    }
    pendingShortcut = null; // they moved on to something else
    return false;
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
    window.__fridayLastUrl = url;
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
    if (headacheOn()) return; // 3.5.1: no briefing or greeting while she has a headache
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
    var opts0 = {};
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
        if (st.healthBrief && window.FridayNative && FridayNative.kit.health && !opts0.healthDone) {
          opts0.healthDone = true;
          FridayNative.kit.health().then(function (hr) {
            if (hr.ok && (hr.sleepMinutes || hr.steps)) {
              var hh = Math.floor(hr.sleepMinutes / 60), mm = hr.sleepMinutes % 60;
              body += (hr.sleepMinutes ? " You slept " + (hh ? hh + " hour" + (hh === 1 ? "" : "s") : "") + (hh && mm ? " and " : "") + (mm ? mm + " minutes" : "") + "." : "") + (hr.steps ? " " + hr.steps.toLocaleString() + " steps so far." : "");
            }
          }).then(cont, cont);
          return;
        }
        cont();
        function cont() {
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
        }
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
      if (h.role === "assistant" && h.sources && h.sources.length) { var sc = srcChips(h.sources); sc.className = "msg-srcs"; thread.appendChild(sc); }
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
    // 4.0: grouped by type (right now, preferences, facts, shared moments)
    var TY = (window.FridayMemory && window.FridayMemory.TYPES) || {};
    var grouped = memFilter === "all" && !q && window.FridayMemory;
    if (grouped) {
      var order = { context: 0, preference: 1, fact: 2, event: 3 };
      items.forEach(function (x) { window.FridayMemory.normalize(x.m); });
      items.sort(function (a, b) { return ((order[a.m.type] || 0) - (order[b.m.type] || 0)) || ((b.m.pinned ? 1 : 0) - (a.m.pinned ? 1 : 0)) || String(b.m.at || "").localeCompare(String(a.m.at || "")); });
    }
    var lastType = null;
    items.forEach(function (x) {
      if (grouped && x.m.type !== lastType) {
        lastType = x.m.type;
        var hd = document.createElement("div");
        hd.className = "sgroup-h"; hd.style.margin = "14px 4px 6px";
        hd.textContent = (TY[lastType] || "Memories") + (lastType === "context" ? " (clears itself)" : "");
        box.appendChild(hd);
      }
      var card = document.createElement("div");
      card.className = "list-card mem-card";
      var p = document.createElement("p");
      p.textContent = x.m.text;
      var meta = document.createElement("div");
      meta.className = "meta";
      var when = "";
      try { when = new Date(x.m.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch (e) {}
      var tyName = x.m.type && TY[x.m.type] ? (x.m.type === "context" ? "Temporary" : TY[x.m.type].replace(/s$/, "").replace(/^Shared moment$/, "Shared moment")) : "";
      var until = x.m.type === "context" && x.m.expiresAt ? " · until " + new Date(x.m.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
      meta.textContent = (tyName && !grouped ? tyName + " · " : "") + when + until + (x.m.auto ? " · learned on her own" : "") + (x.m.pinned ? " · pinned" : "");
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
      var pOn = window.FridayPersona && window.FridayPersona.on(profile);
      sum.textContent = chat.memory.length + " things remembered." + (smry ? " She also keeps a short summary of your older chats so she remembers past conversations." : "") +
        (pOn ? window.FridayPersona.say(" Her conclusions about her own personality aren't kept here; they're in Settings → Mood & Display → Her own personality.") : "");
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
    // 3.4: private messages stop here: no brain, no chat, no memory, no activity log.
    if (privateCompose && Date.now() - privateCompose.at > 120000) privateCompose = null;
    var pcmd = window.FridayPrivate ? privateCommand(text) : null;
    if (pcmd || privateCompose) {
      setCaption("🔒 Private");
      busy = true;
      try { await handlePrivate(text, pcmd, opts); } finally { busy = false; if (neural) neural.setActive(null); }
      return;
    }
    if (!opts.part && pendingShortcut && await answerShortcut(text)) return;
    setCaption(text);
    if (!opts.part) emitActivity("listening", "Heard: " + text.slice(0, 70));
    // 3.5.3: robot jobs go straight to the robot, in one piece ("open YouTube and search …" isn't split
    // into separate steps). Without "robot," she decides herself when a request needs tapping in another app.
    var robotCmd = window.FridayRobot ? window.FridayRobot.detect(text) : null;
    if (!robotCmd && !opts.part && window.FridayRobot && window.FridayRobot.isPaired() && window.FridayRobot.looksLikeAppTask(text)) {
      if (neural) neural.setActive("thinking");
      if (await window.FridayRobot.shouldUse(text)) robotCmd = { kind: "task", goal: text, auto: true };
    }
    if (!opts.part && extras && !robotCmd) {
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
    document.getElementById("neural-caption").textContent = shownName().toUpperCase() + " · THINKING";
    try {
      if (robotCmd) {
        chat._push("user", text);
        var sayR = function (line) { setCaption(line); voice.queue(line, profile); };
        if (robotCmd.auto) sayR("I'll have the robot do that.");
        var rr;
        try { rr = await window.FridayRobot.handle(robotCmd, profile, sayR); }
        catch (re) { rr = { text: "The robot ran into a problem: " + String((re && re.message) || re).slice(0, 120) }; }
        var rline = (rr && rr.text) || "Done.";
        chat._push("assistant", rline);
        sayR(rline);
        renderChat();
        emitActivity("thinking", "Robot: " + rline.slice(0, 60));
        await voice.whenDone();
        return;
      }
      var camCmd = cameraCommand(text) || (/^(?:hey \w+ )?(?:please )?(?:take|snap) (?:a |me a )?(?:picture|photo|pic|selfie|video)(?: please)?$/i.test(text.replace(/[.!?,]/g, "").trim()) ? "open camera" : null);
      // 3.5.2: the camera inside the app (Settings → Phone → In the app → Camera in the app)
      if (camCmd === "open camera" && sv().cameraInApp === true && window.FridayNative && FridayNative.kit.camera) {
        setCaption("Opening the camera.");
        var cr0 = await FridayNative.kit.camera(/video/i.test(text) ? "video" : "photo");
        if (cr0.ok) {
          if (cr0.photo) { lastPhoto = cr0.photo; lastPhotoAt = Date.now(); }
          var cl0 = cr0.result === "saved" ? (cr0.kind === "video" ? "Video saved to your Photos." : "Saved to your Photos. Ask me \u201cwhat is this?\u201d and I'll take a look.") : "Okay.";
          setCaption(cl0);
          await voice.speak(cl0.replace(/\u201c|\u201d/g, ""), profile);
          return;
        }
      }
      // "what is this?" right after taking a picture in her camera
      if (lastPhoto && lastPhotoAt && Date.now() - lastPhotoAt < 600000 && /^(?:hey \w+ )?(?:what(?:'s| is) (?:this|that|it)|what am i looking at|what do you see|look at (?:this|that|it|the picture|the photo)|can you see (?:this|it)|tell me about (?:this|the) (?:picture|photo))\b/i.test(text.replace(/[’]/g, "'").trim())) {
        chat._push("user", text);
        setCaption("Looking…");
        emitActivity("vision", "Looked at your photo");
        var va = await window.FridayBrain.ask([
          { role: "system", content: "You are " + (profile.assistantName || "Friday") + ". Answer about the photo in two to four short spoken sentences, no lists or markdown." },
          { role: "user", content: [{ type: "text", text: text }, { type: "image_url", image_url: { url: lastPhoto } }] }
        ], { purpose: "vision", max_tokens: 300 });
        va = window.FridayGroq ? window.FridayGroq.cleanSpoken(va || "") : String(va || "");
        chat._push("assistant", va);
        setCaption(va);
        await voice.speak(va, profile);
        return;
      }
      if (camCmd) {
        if (!opts.collect) chat._push("user", text);
        await goShortcut(camCmd, opts, camCmd === "cameras" ? "I can't pull up the cameras in the app." : "I can't open the camera in the app.");
        return;
      }
      if (refreshCommand(text)) {
        chat._push("user", text);
        await FridayRefresh.run(opts);
        return;
      }
      var myLink = linkByName(text);
      if (myLink) {
        if (myLink.ready === "refresh") { chat._push("user", text); await FridayRefresh.run(opts); return; }
        if (bubbles) { bubbles.noteUsage("url:" + myLink.url); bubbles.refreshSuggestions(); }
        setCaption("Opening " + myLink.name + ".");
        goUrl(myLink.url, opts);
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
      if (/\b(weather|forecast|temperature outside|how (hot|cold) is it|is it (going to )?(rain|snow)|will it (rain|snow)|do i need (a |an )?(umbrella|jacket|coat))\b/.test(low) && !/\b(inside|indoors|in here|in the house|thermostat)\b/.test(low) && !/\b(in|for) (?!the morning|tomorrow|today|tonight)[a-z]+/.test(low.replace(/^.*?(weather|forecast)/, "$1"))) {
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
          emitActivity(ph.tool === "home" || ph.tool === "tv" ? "home" : ph.tool === "battery" ? "core" : ph.tool === "music" || ph.tool === "call" ? "voice" : "calendar", ph.say.slice(0, 70));
          // music is playing now: stop the hands-free conversation so she doesn't listen to the song
          if (ph.tool === "music" && ph.playing && !opts.part) handsFree = false;
          // when music starts, the music is the answer: she doesn't talk over it
          if (!(ph.tool === "music" && ph.playing)) await voice.speak(ph.say, profile);
          if (ph.url) goUrl(ph.url, opts);
          return;
        }
      }
      var act = life ? life.handle(text) : null;
      if (!act && isDiagAsk(low)) {
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
        if (act.shortcut) {
          if (opts.collect) opts.collect.push({ kind: "shortcut", value: act.shortcut });
          else await offerShortcut([{ kind: "shortcut", value: act.shortcut }], "Want me to also put it on your iPhone with your Shortcut?");
        }
        if (act.steps && act.steps.length) await runMany(act.steps, null, opts);
        return;
      }
      // 3.5.7: a bubble she can't do in the app: ask before using the Shortcut
      if (opts.bubble) {
        chat._push("user", text);
        await goShortcut(text, opts);
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
      } else if ((result.kind === "phone" || result.kind === "messages") && result.command) {
        var phSay = result.kind === "phone" && opts.collect ? cantLine() : result.text;
        setCaption(phSay);
        await voice.speak(phSay, profile);
        if (bubbles) bubbles.noteAppMentions(text);
        if (bubbles) bubbles.refreshSuggestions();
        if (opts.collect) opts.collect.push({ kind: "shortcut", value: result.command });
        else if (result.kind === "phone") await offerShortcut([{ kind: "shortcut", value: result.command }], "", true); // she already asked
        else await offerShortcut([{ kind: "shortcut", value: result.command }], "Want me to send it with your Shortcut?");
        if (result.kind === "messages" && !opts.collect) showMessagesButton(result.command);
      } else if (result.kind === "memory") {
        setCaption(result.text || "");
        renderMemory();
        if (bubbles) bubbles.refreshSuggestions();
        await voice.speak(result.text, profile);
      } else {
        setCaption(result.text || "");
        renderChat();
        if (result.research && result.research.sources && result.research.sources.length) showSources(result.research.sources); else hideSources();
        if (!opts.collect && /\bshortcut\b[^.!]*\?\s*$/i.test(result.text || "")) offerShortcut([{ kind: "shortcut", value: text }], "", true);
        if (result.pictures && window.FridayPictures) {
          // 3.5.2: real photos in their own panel, with her answer on top
          window.FridayPictures.render(document.getElementById("pics-box"), result.pictures, result.text, openUrl);
          openPanel("pictures");
        }
        else {
          // 3.5.5: no picture words, but photos would help (like "best tools"): show a few under her answer
          hidePics();
          picturesFor(text, result.text || "").then(function (pl) { showPics(pl, result.text || ""); }, function () {});
        }
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
      noteTalked();
      if (neural) neural.setActive(null);
      document.getElementById("neural-caption").textContent = shownName().toUpperCase() + " · THINKING";
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
    if (collect.length) {
      var scN = collect.filter(function (it) { return it.kind === "shortcut"; }).length;
      if (!scN) { runLeaveQueue(collect); orb.setTalking("idle", 0); return; }
      await offerShortcut(collect, (scN === 1 ? "I couldn't do one of those in the app. Want me to hand it" : "I couldn't do " + scN + " of those in the app. Want me to hand them") + " to your Shortcut?");
      return;
    }
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
      if (!opts.collect) { await goShortcut(ex.partner.command, opts, "I can't send that one from the app."); return; }
      var line = "Sending that to " + ex.partner.to + ".";
      chat._push("assistant", line);
      setCaption(line);
      await voice.speak(line, profile);
      goShortcut(ex.partner.command, opts);
      return;
    }
    if (ex.textSend) {
      chat._push("user", text);
      if (!opts.collect) { await goShortcut(ex.textSend.command, opts, "I can't send that one from the app."); return; }
      var tl = "Texting " + ex.textSend.to.replace(/[^\w' -]+/g, "").trim() + ".";
      chat._push("assistant", tl);
      setCaption(tl);
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
    if (L.action === "pl") { onPrivateLink(String((L.query && L.query.d) || "")); return; }
    if (L.action === "msg") {
      var plp = window.FridayPrivate ? window.FridayPrivate.findPayload(L.text) : "";
      if (plp) { onPrivateLink(plp); return; }
      onIncomingMessage(L);
      return;
    }
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
        N.notify.at(key, b.name + " bill is due today", (b.amount ? D.money(b.amount) + ". " : "") + "Tell " + shownName() + " when it's paid.", at);
      });
      if (s.countdownAlerts !== false) D.countdowns().forEach(function (c) {
        var n = D.countdownDays(c);
        if (n == null || n < 0 || n > 60) return;
        var at = nine(n), key = "cd:" + (c.id || c.name) + ":" + at.toDateString();
        keys.push(key);
        N.notify.at(key, c.name + " is today!", "Counting down with " + shownName() + ".", at);
      });
      FridayStorage.set("alertKeys", keys);
    }, 800);
  }
  async function turnOnNotifications() {
    var N = window.FridayNative;
    if (!N || !N.notify.available()) { toast("Notifications work in the installed app."); return false; }
    var ok = await N.notify.ask();
    FridayStorage.set("notifyAsked", true);
    toast(ok ? "Notifications are on." : "Notifications are off. Turn them on in iPhone Settings, " + shownName() + ", Notifications.");
    if (ok) scheduleLifeAlerts();
    return ok;
  }
  window.__fridayTurnOnNotifications = turnOnNotifications;

  // ---------- 3.3: refresh my apps (LocalDevVPN comes on, then your installer opens) ----------
  // No Shortcut needed: LocalDevVPN's own link turns the VPN on and then opens the installer.
  var INSTALLERS = ["altload", "altstore", "sidestore"];
  var INSTALLER_NAMES = { altload: "AltLoad", altstore: "AltStore", sidestore: "SideStore" };
  var FridayRefresh = {
    scheme: async function () {
      var N = window.FridayNative;
      var apps = N && N.kit && N.kit.canOpen ? await N.kit.canOpen(INSTALLERS.concat(["localdevvpn"])) : null;
      if (apps) {
        FridayStorage.set("hasLocalDevVPN", apps.localdevvpn !== false);
        for (var i = 0; i < INSTALLERS.length; i++) if (apps[INSTALLERS[i]]) { FridayStorage.set("installerScheme", INSTALLERS[i]); return INSTALLERS[i]; }
      }
      return FridayStorage.get("installerScheme", "") || "altload";
    },
    url: async function () { return "localdevvpn://enable?scheme=" + (await FridayRefresh.scheme()); },
    name: function () { var sc = FridayStorage.get("installerScheme", "") || "altload"; return INSTALLER_NAMES[sc] || "your installer"; },
    run: async function (opts) {
      opts = opts || {};
      var url = await FridayRefresh.url();
      FridayStorage.set("refreshLast", Date.now());
      FridayRefresh.schedule(true);
      if (bubbles && !opts.fromBubble) { var rb = bubbles.list.filter(function (b) { return /^localdevvpn:/i.test(b.url || ""); })[0]; if (rb) bubbles.bumpUsage(rb); }
      var line = "Turning on LocalDevVPN and opening " + FridayRefresh.name() + ". Tap Refresh All when it opens.";
      if (FridayStorage.get("hasLocalDevVPN", true) === false) line = "I can't find LocalDevVPN on this iPhone, so I'm opening " + FridayRefresh.name() + " instead.";
      if (FridayStorage.get("hasLocalDevVPN", true) === false) url = (FridayStorage.get("installerScheme", "") || "altload") + "://";
      setCaption(line);
      if (!opts.fromBubble && !opts.fromNote) {
        chat._push("assistant", line);
        try { voice.speak("On it. Tap Refresh All when it opens.", profile); } catch (e) {}
      }
      if (opts.collect) { goUrl(url, opts); return url; }
      await new Promise(function (r) { setTimeout(r, opts.fromBubble ? 150 : 900); });
      goUrl(url, opts);
      return url;
    },
    // Reminder on your iPhone every few days at the hour you pick. Tapping it does the refresh.
    schedule: async function (force) {
      var N = window.FridayNative;
      var s = (settings && settings.values) || settingsData || {};
      var every = +s.refreshEvery || 0;
      if (!N || !N.notify || !N.notify.available()) return false;
      await N.notify.cancel("refresh-apps");
      await N.notify.cancel("refresh-apps-2");
      if (!every || !N.notify.allowed()) return false;
      var hour = +s.refreshHour || 10;
      var last = +FridayStorage.get("refreshLast", 0) || Date.now();
      if (!FridayStorage.get("refreshLast", 0)) FridayStorage.set("refreshLast", last);
      var at = new Date(last + every * 86400000);
      at.setHours(hour, 0, 0, 0);
      var soon = new Date(); soon.setMinutes(soon.getMinutes() + 2);
      if (at < soon) { at = new Date(); at.setHours(hour, 0, 0, 0); if (at < soon) at.setDate(at.getDate() + 1); }
      var title = "Time to refresh your apps";
      var body = "Tap here and " + shownName() + " turns on LocalDevVPN and opens " + FridayRefresh.name() + ".";
      await N.notify.at("refresh-apps", title, body, at, { action: "refresh-apps" });
      var again = new Date(at.getTime() + 86400000);
      await N.notify.at("refresh-apps-2", "Your apps still need a refresh", body, again, { action: "refresh-apps" });
      return at;
    }
  };
  window.FridayRefresh = FridayRefresh;
  function refreshCommand(text) {
    var t = String(text || "").toLowerCase().replace(/[.!?,]/g, "").trim();
    if (/^(?:hey \w+ )?(?:please )?(?:refresh|re-?sign|renew)(?: all)? (?:my |the |all my |all the )?(?:apps|sideloaded apps|app)(?: please)?$/.test(t)) return true;
    if (/^(?:hey \w+ )?(?:please )?(?:open|launch|pull up|start)(?: up)? (?:the |my )?(?:altload|alt load|altstore|alt store|sidestore|side store)(?: app)?(?: please)?$/.test(t)) return true;
    if (/^(?:hey \w+ )?(?:turn on|start|connect) (?:the )?(?:vpn|localdevvpn|local dev vpn) and (?:open|refresh) /.test(t)) return true;
    return false;
  }
  // "open <name>" for links you added in Settings, Connections.
  function linkByName(text) {
    var m = String(text || "").toLowerCase().replace(/[.!?,]/g, "").match(/^(?:hey \w+ )?(?:please )?(?:open|launch|pull up|go to|start)(?: up)? (?:the |my )?(.+?)(?: app| link)?(?: please)?$/);
    if (!m) return null;
    var want = m[1].trim();
    var list = FridayStorage.get("connections", []) || [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (!c || c.type === "agent" || !c.url) continue;
      if (String(c.name || "").toLowerCase().trim() === want) return c;
    }
    return null;
  }

  // ---------- 3.0: battery savers for the orb ----------
  var lastActivity = Date.now();
  function applyPower() {
    if (!orb || !orb.setPower) return;
    var s = (settings && settings.values) || settingsData || {};
    var active = busy || (voice && (voice.speaking || voice.listening));
    if (active) lastActivity = Date.now();
    var rest = s.restingOrb !== false && !active && Date.now() - lastActivity > 60000;
    var night = (s.nightOrb !== false && !!(window.FridayNight && window.FridayNight.isNight())) || headacheOn();
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
  // 3.5.2: the robot keeps her awake while it works in another app, then lets go.
  window.FridayKeepAlive = function (on) { try { voice.keepAlive(!!on); } catch (e) {} };
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
    if (typing) exitTyping();
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

  // ---------- 3.5.6: StandBy widget files (Files → On My iPhone → Friday → Widget) ----------
  var widgetT = 0, widgetLookDone = "", lastTalkAt = +FridayStorage.get("lastTalkAt", 0) || 0;
  function syncWidget(now) {
    var N = window.FridayNative;
    if (!N || !N.kit || !N.kit.writeShared || !IS_NATIVE) return;
    clearTimeout(widgetT);
    widgetT = setTimeout(async function () {
      var s0 = sv(), look = s0.look || "N";
      var hist = (chat && chat.history) || [];
      var last = null;
      for (var i = hist.length - 1; i >= 0; i--) { var m = hist[i]; if (m && m.role === "assistant" && typeof m.content === "string" && m.content.trim()) { last = m.content.trim(); break; } }
      var info = {
        name: profile.assistantName || "Friday",
        scheme: (profile.assistantName || "Friday").toLowerCase() === "reed" ? "jarvis" : (profile.assistantName || "Friday").toLowerCase(),
        look: look,
        lookName: (cfg.LOOKS && cfg.LOOKS[look] && (cfg.LOOKS[look].name || cfg.LOOKS[look].label)) || look,
        talkedAt: lastTalkAt || 0,
        reply: s0.widgetReply === true && last ? last.slice(0, 220) : "",
        brain: (window.FridayBrain && FridayBrain.lastUsed && FridayBrain.lastUsed()) || "",
        mood: s0.mood || "normal",
        updated: Date.now()
      };
      await N.kit.writeShared("friday-widget.json", { text: JSON.stringify(info) });
      var key = look + ":" + (s0.render || "max");
      if (widgetLookDone !== key && window.FridayOrb && FridayOrb.frames) {
        var fr = FridayOrb.frames(look, 360, 4);
        for (var k = 0; k < fr.length; k++) await N.kit.writeShared("orb-" + k + ".jpg", { base64: fr[k] });
        if (fr.length) widgetLookDone = key;
      }
    }, now ? 50 : 4000);
  }
  function noteTalked() { lastTalkAt = Date.now(); FridayStorage.set("lastTalkAt", lastTalkAt); syncWidget(); }
  window.__fridaySyncWidget = syncWidget;

  // ---------- 3.5.2: pictures with answers ----------
  // After she answers, a tiny AI step decides if photos would help and names the exact things
  // (so "what are the best tools?" shows those tools). Free photos come from Openverse, then Wikimedia Commons.
  var PIC_HINT = /\b(show|picture|pictures|photo|photos|image|images|pic|pics|look like|looks like|tools?|how (?:do|to|can|should|would)|best way|types? of|kinds? of|build|make|fix|install|repair|diy|what is a|what's a|which|recipe|plant|flower|dog|cat|bird|car|truck|house|room|outfit)\b/i;
  var picsTimer = 0, threadPics = null;
  function httpGet(url) {
    var h = window.FridayBrain && FridayBrain.http ? FridayBrain.http : function (u, i) { return fetch(u, i); };
    return h(url, { method: "GET", headers: { Accept: "application/json" } }).then(function (r) { return r.ok ? r.json() : null; }, function () { return null; });
  }
  async function imagesFor(q, n) {
    var out = [];
    var ov = await httpGet("https://api.openverse.org/v1/images/?q=" + encodeURIComponent(q) + "&page_size=" + (n + 2) + "&mature=false");
    ((ov && ov.results) || []).forEach(function (r) {
      if (out.length < n && r && (r.thumbnail || r.url)) out.push({ thumb: r.thumbnail || r.url, full: r.url || r.thumbnail, title: r.title || q, src: r.foreign_landing_url || r.url });
    });
    if (out.length < n) {
      var wc = await httpGet("https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=" + (n + 2) + "&prop=imageinfo&iiprop=url&iiurlwidth=600&gsrsearch=" + encodeURIComponent(q + " filetype:bitmap"));
      var pages = (wc && wc.query && wc.query.pages) || {};
      Object.keys(pages).forEach(function (k) {
        var p = pages[k], ii = p && p.imageinfo && p.imageinfo[0];
        if (out.length < n && ii && (ii.thumburl || ii.url)) out.push({ thumb: ii.thumburl || ii.url, full: ii.thumburl || ii.url, title: String(p.title || q).replace(/^File:/, "").replace(/\.[a-z]+$/i, ""), src: ii.descriptionurl || ii.url });
      });
    }
    return out;
  }
  async function picturesFor(question, answer) {
    var s0 = sv();
    if (s0.pictures === false || !answer || !window.FridayBrain || !FridayStorage.hasApiKey()) return [];
    if (!PIC_HINT.test(question) && String(answer).length < 260) return [];
    var picks = "";
    try {
      picks = await FridayBrain.ask([
        { role: "system", content: "You choose photos to show next to a voice assistant's answer. If photos would really help (physical things, tools, materials, parts, steps of a build or repair, places, animals, plants, food, products, or the user asked to see something), reply with 1 to 3 short image search queries of 2 to 5 words, one per line, most useful first. Name the specific things from the answer, like \"circular saw\" or \"stair stringer\". If photos would not help (feelings, opinions, advice, math, schedules, news, small talk), reply NONE. Reply with nothing else." },
        { role: "user", content: "Question: " + String(question).slice(0, 400) + "\nAnswer: " + String(answer).slice(0, 1400) }
      ], { purpose: "small", max_tokens: 60, temperature: 0, noBackup: false, quietLog: true });
    } catch (e) { return []; }
    var qs = String(picks || "").split(/\n+/).map(function (x) { return x.replace(/^[\s\-*\d.)"']+|["']+$/g, "").trim(); })
      .filter(function (x) { return x && !/^none\b/i.test(x) && x.length <= 60; }).slice(0, 3);
    if (!qs.length) return [];
    var per = qs.length === 1 ? 6 : qs.length === 2 ? 3 : 2, all = [], seen = {};
    var lists = await Promise.all(qs.map(function (q) { return imagesFor(q, per).catch(function () { return []; }); }));
    lists.forEach(function (l) { l.forEach(function (im) { if (!seen[im.thumb]) { seen[im.thumb] = 1; all.push(im); } }); });
    return all.slice(0, 6);
  }
  function picStrip(list) {
    var box = document.createElement("div");
    list.forEach(function (im) {
      var img = document.createElement("img");
      img.src = im.thumb; img.alt = im.title; img.loading = "lazy"; img.referrerPolicy = "no-referrer";
      img.onerror = function () { img.remove(); };
      img.addEventListener("click", function (ev) { ev.stopPropagation(); openPic(im); });
      box.appendChild(img);
    });
    return box;
  }
  function openPic(im) {
    var v = document.getElementById("pic-view");
    if (!v) return;
    document.getElementById("pic-view-img").src = im.full || im.thumb;
    document.getElementById("pic-view-title").textContent = im.title || "";
    var a = document.getElementById("pic-view-src");
    a.href = im.src || im.full;
    a.onclick = function (ev) { ev.preventDefault(); ev.stopPropagation(); openUrl(im.src || im.full); };
    v.hidden = false;
  }
  // 4.0: sources under her answer. ✓ = backs a verified point; dimmed = weak site. Tap to open.
  var srcsTimer = 0;
  function srcChips(list) {
    var box = document.createElement("div");
    (list || []).slice(0, 6).forEach(function (s) {
      if (!s || !s.url) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "src-chip" + (s.verified ? " ok" : "") + (s.tier === "low" || s.unconfirmed ? " weak" : "");
      b.textContent = (s.verified ? "✓ " : s.unconfirmed ? "? " : "") + (s.domain || s.title || "source");
      b.title = s.title || s.url;
      b.onclick = function (e) { e.stopPropagation(); openUrl(s.url); };
      box.appendChild(b);
    });
    return box;
  }
  function hideSources() {
    clearTimeout(srcsTimer);
    var el = document.getElementById("srcs");
    if (el) { el.hidden = true; el.innerHTML = ""; }
  }
  function showSources(list) {
    var el = document.getElementById("srcs");
    if (!el || !list || !list.length) { hideSources(); return; }
    el.innerHTML = "";
    var ch = srcChips(list);
    while (ch.firstChild) el.appendChild(ch.firstChild);
    el.hidden = !el.childNodes.length;
    clearTimeout(srcsTimer);
    srcsTimer = setTimeout(hideSources, 120000);
  }
  function hidePics() {
    clearTimeout(picsTimer);
    var el = document.getElementById("pics");
    if (el) { el.hidden = true; el.innerHTML = ""; }
  }
  function showPics(list, answer) {
    if (!list || !list.length) return;
    var el = document.getElementById("pics");
    if (el) {
      el.innerHTML = "";
      var strip = picStrip(list);
      while (strip.firstChild) el.appendChild(strip.firstChild);
      el.hidden = false;
      clearTimeout(picsTimer);
      picsTimer = setTimeout(hidePics, 120000);
    }
    threadPics = { text: answer, list: list };
    if (typing) renderThread();
  }
  window.__fridayPics = { picturesFor: picturesFor, show: showPics, hide: hidePics, imagesFor: imagesFor };

  // ---------- 3.4: private line (locked messages between Friday and Jarvis) ----------
  // Private messages never reach her AI brain, chat history, memory or the activity log,
  // and she reads them only with an iPhone voice, so the words stay on the phone.
  var privateCompose = null;
  function partnerInfo() {
    var pc = extras ? extras.partnerCfg(profile) : { names: [], display: "", contact: "", prefix: "" };
    return pc;
  }
  function privateCommand(text) {
    var pc = partnerInfo();
    var t = String(text || "").trim().replace(/[’]/g, "'").replace(/^(hey |ok |okay )?(friday|jarvis|reed)[, ]+/i, "").replace(/^(please |can you |could you )/i, "");
    var names = (pc.names || []).map(function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
    if (names.length) {
      var N = "(?:" + names.join("|") + ")";
      var pats = [
        new RegExp("^(?:privately )?(?:tell|message|text) " + N + " privately(?: that| to)?[,:]?\\s*(.*)$", "i"),
        new RegExp("^privately (?:tell|message|text) " + N + "(?: that| to)?[,:]?\\s*(.*)$", "i"),
        new RegExp("^(?:send )?(?:a )?private (?:message|text|note) (?:to|for) " + N + "(?: saying| that says)?[,:]?\\s*(.*)$", "i"),
        new RegExp("^send " + N + " (?:a )?private (?:message|text|note)(?: saying| that says)?[,:]?\\s*(.*)$", "i")
      ];
      for (var i = 0; i < pats.length; i++) {
        var m = t.match(pats[i]);
        if (m) return { kind: "send", body: (m[1] || "").trim().replace(/[.!]+$/, "") };
      }
    }
    var r = t.match(/^(?:reply privately|private reply|reply in private)(?: saying| with)?[,:]?\s*(.*)$/i);
    if (r) return { kind: "send", body: (r[1] || "").trim().replace(/[.!]+$/, "") };
    if (/^(?:open |show |read |check |play )?(?:my |the )?private (?:messages|inbox|line|texts)(?: please)?$/i.test(t) || /^(?:any|do i have any) (?:new )?private messages\??$/i.test(t)) return { kind: "open" };
    if (/^(?:start|set up|setup|pair) (?:the |a |our )?private line$|^pair (?:with )?(?:friday|jarvis|reed)$/i.test(t)) return { kind: "pair" };
    return null;
  }
  function capFirst(x) { x = String(x || ""); return x.charAt(0).toUpperCase() + x.slice(1); }
  async function privateSay(line) {
    setCaption(line);
    try { await voice.speakPrivate(line, profile); } catch (e) {}
  }
  function showPrivateSetup() {
    openPanel("settings");
    setTimeout(function () { if (window.__fridaySettingsShow) { var el = window.__fridaySettingsShow("accord-private"); if (el) try { el.scrollIntoView({ block: "start" }); } catch (e) {} } }, 200);
  }
  // Opens the text to the other phone (you tap Send). Falls back to the Messages app (never the Shortcut).
  async function composeToPartner(body) {
    var pc = partnerInfo(), N = window.FridayNative;
    if (!pc.contact) return { ok: false, reason: "no-contact" };
    if (N && N.isApp() && N.kit && N.kit.available() && (!window.FridayPhone || window.FridayPhone.inAppTexts())) {
      var num = await N.contacts.numberFor(pc.contact);
      if (num) {
        var r = await N.kit.text(num.number, body);
        if (r.ok) return { ok: true, result: r.result };
      }
    }
    window.__fridayLastSms = body;
    var a = document.getElementById("open-messages-btn");
    if (a) a.remove();
    a = document.createElement("a");
    a.id = "open-messages-btn";
    a.href = "sms:&body=" + encodeURIComponent(body);
    a.textContent = "Open in Messages";
    a.setAttribute("style", "position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 150px);transform:translateX(-50%);z-index:9999;padding:12px 22px;border-radius:999px;background:rgba(20,20,20,.85);border:1px solid rgba(214,180,110,.5);color:#e9d3a0;font:600 15px -apple-system,system-ui,sans-serif;text-decoration:none");
    document.body.appendChild(a);
    setTimeout(function () { if (a.parentNode) a.remove(); }, 30000);
    return { ok: true, result: "web" };
  }
  async function sendPrivateKey() {
    var PL = window.FridayPrivate, pc = partnerInfo();
    if (!PL || !PL.available()) return { ok: false, reason: "no-crypto" };
    var payload = await PL.myKeyPayload();
    var r = await composeToPartner(PL.textFor(payload, pc.prefix, "key"));
    if (r.ok && r.result !== "cancelled") await PL.markSent();
    if (settings && settings._syncPrivate) settings._syncPrivate();
    return r;
  }
  window.__fridayPrivateSendKey = sendPrivateKey;
  async function sendPrivate(body) {
    var PL = window.FridayPrivate, pc = partnerInfo(), who = pc.display || PL.theirs();
    var st = PL ? await PL.status() : { paired: false };
    if (!st.paired) { await privateSay("You and " + who + " need to pair the private line first. I'll open it for you."); showPrivateSetup(); return; }
    if (!st.verified) { await privateSay("Check the 4 safety words with " + who + " first, then tap The words match."); showPrivateSetup(); return; }
    var sealed = await PL.seal(capFirst(body));
    await PL.addToInbox({ dir: "out", text: capFirst(body), id: sealed.msg.id, at: sealed.msg.at, state: "ready" });
    if (panelOpen("private")) renderPrivate();
    await privateSay("Here's your private message to " + who + ". Tap Send.");
    var r = await composeToPartner(PL.textFor(sealed.payload, pc.prefix, "msg"));
    var list = await PL.inbox();
    list.forEach(function (x) { if (x.id === sealed.msg.id) x.state = r.result === "cancelled" ? "not sent" : "sent"; });
    await PL.saveInbox(list);
    if (panelOpen("private")) renderPrivate();
    if (r.result === "sent") await privateSay("Sent privately.");
    else if (r.result === "cancelled") await privateSay("Okay, I didn't send it.");
  }
  async function handlePrivate(text, cmd, opts) {
    var pc = partnerInfo(), who = pc.display || (window.FridayPrivate ? window.FridayPrivate.theirs() : "them");
    opts = opts || {};
    if (!cmd && privateCompose) {
      privateCompose = null;
      if (/^(cancel|never ?mind|stop|forget it|no)\.?$/i.test(text.trim())) { await privateSay("Okay, cancelled."); return; }
      await sendPrivate(text);
      return;
    }
    if (cmd.kind === "open") { openPanel("private"); var n = (await window.FridayPrivate.inbox()).filter(function (x) { return x.dir === "in"; }).length; await privateSay(n ? "Here are your private messages." : "No private messages yet."); return; }
    if (cmd.kind === "pair") { showPrivateSetup(); await privateSay("Here's the private line. Tap Pair to send your key to " + who + "."); return; }
    if (!cmd.body) {
      privateCompose = { at: Date.now() };
      await privateSay("Okay. What's the private message for " + who + "?");
      if (IS_NATIVE && !opts.typed && !voice.listening) { handsFree = true; beginListen(); }
      return;
    }
    await sendPrivate(cmd.body);
  }
  function panelOpen(id) { var el = document.getElementById("panel-" + id); return !!(el && el.classList.contains("open")); }
  async function renderPrivate() {
    var PL = window.FridayPrivate, box = document.getElementById("private-list");
    if (!PL || !box) return;
    var pc = partnerInfo(), who = pc.display || PL.theirs();
    var st = await PL.status(), list = await PL.inbox();
    var stEl = document.getElementById("private-panel-status");
    if (stEl) stEl.textContent = !st.paired ? "Not paired yet. Tap Private line settings to pair with " + PL.theirs() + "." : (st.verified ? "Locked end to end with " + who + ". Only your two phones can read these." : "Paired. Check the safety words with " + who + " in Private line settings before sending.");
    var inp = document.getElementById("private-text");
    if (inp) inp.placeholder = "Private message to " + who;
    box.innerHTML = "";
    if (!list.length) { var e = document.createElement("div"); e.className = "pl-empty"; e.textContent = "No private messages yet."; box.appendChild(e); return; }
    list.slice(-60).forEach(function (m) {
      var d = document.createElement("div");
      d.className = m.dir === "in" ? "pl-them" : "pl-me";
      d.textContent = m.text;
      var w = document.createElement("div");
      w.className = "pl-when";
      var dt = new Date(m.at || Date.now());
      w.textContent = dt.toLocaleDateString([], { month: "short", day: "numeric" }) + ", " + dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + (m.dir === "out" && m.state && m.state !== "sent" ? " · " + m.state : "");
      d.appendChild(w);
      box.appendChild(d);
    });
    box.scrollTop = box.scrollHeight;
  }
  async function onPrivateLink(d) {
    var PL = window.FridayPrivate;
    if (!PL || !d) return;
    var pc = partnerInfo(), who = pc.display || PL.theirs();
    if (d.indexOf("k.") === 0) {
      var r = await PL.receiveKey(d.slice(2));
      if (!r.ok) { if (r.reason !== "own-key") await privateSay("That private line key didn't look right. Ask " + who + " to send it again."); return; }
      if (settings && settings._syncPrivate) settings._syncPrivate();
      showPrivateSetup();
      if (r.needReply) {
        await privateSay(PL.theirs() + " sent a private line key. I'll open a text with my key so " + PL.theirs() + " can finish pairing. Tap Send.");
        await sendPrivateKey();
      }
      await privateSay("Your safety words are " + r.words.join(", ") + ". Check that " + who + " sees the same 4 words, then tap The words match.");
      return;
    }
    if (d.indexOf("m.") === 0) {
      var o = await PL.open(d);
      if (!o.ok) {
        if (o.reason === "seen") { openPanel("private"); return; }
        await privateSay(o.reason === "not-paired" ? "A private message came in, but this phone isn't paired yet. Open the private line to pair." : "A private message came in, but I couldn't unlock it. You two may need to pair again.");
        return;
      }
      await PL.addToInbox({ dir: "in", text: o.msg.m, id: o.msg.id, at: o.msg.at || Date.now() });
      toast("Private message from " + who);
      emitActivity("speaking", "Private message");
      if (bedside && bedside.on) bedside.message(who, "Private message");
      pendingMessage = true;
      var tries = 0;
      (function go() {
        if ((busy || voice.speaking || document.visibilityState === "hidden") && tries++ < 40) { setTimeout(go, 700); return; }
        if (voice.listening) { try { voice.stopListen().catch(function () {}); } catch (e) {} document.getElementById("listen-dot").classList.remove("on"); }
        openPanel("private");
        try { chime(); } catch (e) {}
        setCaption("Private message from " + who);
        setTimeout(function () {
          voice.speakPrivate("Private message from " + who + ". " + o.msg.m, profile).then(function () {
            pendingMessage = false;
          });
        }, 700);
      })();
    }
  }
  window.__fridayPrivate = { onLink: onPrivateLink, render: renderPrivate, send: sendPrivate, sendKey: sendPrivateKey };
  function bindPrivate() {
    var f = document.getElementById("private-form");
    if (f) f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var inp = document.getElementById("private-text"), t = String((inp && inp.value) || "").trim();
      if (!t) return;
      inp.value = "";
      sendPrivate(t);
    });
    var su = document.getElementById("btn-private-setup");
    if (su) su.onclick = showPrivateSetup;
    var cl = document.getElementById("btn-private-clear");
    if (cl) cl.onclick = function () {
      if (!confirm("Clear the private messages on this phone? This can't be undone.")) return;
      window.FridayPrivate.clearInbox().then(renderPrivate);
    };
    window.addEventListener("friday:private", function () { if (panelOpen("private")) renderPrivate(); });
  }

  // ---------- 3.3: talk bar (Pill bar or Glass dock) and typing on the main screen ----------
  var typing = false, typingIdle = 0, typedQuiet = false, threadPending = null;
  function sv() { return (settings && settings.values) || settingsData || {}; }
  function applyTalkbar() {
    var v = sv(), b = document.body;
    b.classList.add("talkbar-on");
    b.classList.toggle("talk-dock", v.talkStyle === "dock");
    b.classList.toggle("talk-pill", v.talkStyle !== "dock");
    b.classList.toggle("no-suggestions", v.suggestions === false);
    b.classList.toggle("hide-orb-typing", v.hideOrbTyping === true);
    var inp = document.getElementById("tb-input");
    if (inp) inp.placeholder = "Type to " + shownName();
    var ci = document.getElementById("chat-input"); if (ci) ci.placeholder = "Message " + shownName();
    var mt = document.getElementById("memory-text"); if (mt) mt.placeholder = "Something " + shownName() + " should remember";
    if (typing) placeOrbForTyping();
    if (bubbles) bubbles.layout();
    syncLive();
  }
  function liveOn() { return !!(handsFree || (voice && voice.listening)); }
  function syncLive() {
    var el = document.getElementById("tb-live");
    if (el) {
      var on = liveOn() && !typing;
      el.classList.toggle("on", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
      el.setAttribute("aria-label", typing ? "Back to talking" : (on ? "Live listening is on. Tap to stop" : "Live listening is off. Tap to start"));
    }
    syncRing();
  }
  // The orb is the button. No ring: her orb itself grows, shrinks and rests to show what she's doing.
  function syncRing() {
    var r = document.getElementById("orb-ring");
    if (r) r.classList.remove("on");
  }
  // The bar, chips and typed thread use the Size setting's zoom, so the keyboard height is divided by it.
  function setKb(px) {
    var z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-zoom")) || 1;
    document.documentElement.style.setProperty("--kb", Math.max(0, Math.round((px || 0) / z)) + "px");
  }
  var nativeKb = false;
  function placeOrbForTyping() {
    if (!orb) return;
    var v = sv();
    if (v.talkStyle !== "dock" && v.hideOrbTyping !== true) orb.setFrame({ cyN: 0.2, radiusK: 0.17 });
    else if (bubbles) bubbles.setRevealed(bubbles.revealed);
  }
  function enterTyping() {
    if (typing) { bumpTyping(); return; }
    typing = true;
    handsFree = false;
    if (voice && voice.listening) {
      document.getElementById("listen-dot").classList.remove("on");
      voice.stopListen().catch(function () {});
    }
    if (orb && !busy && !(voice && voice.speaking)) orb.setTalking("idle", 0);
    document.body.classList.add("typing");
    placeOrbForTyping();
    renderThread();
    syncLive();
    bumpTyping();
  }
  function exitTyping() {
    if (!typing) return;
    typing = false;
    clearTimeout(typingIdle);
    document.body.classList.remove("typing");
    var inp = document.getElementById("tb-input");
    if (inp && document.activeElement === inp) inp.blur();
    if (bubbles) bubbles.setRevealed(bubbles.revealed);
    else applyLayout(sv().layout || "orbit", true);
    setKb(0);
    syncLive();
  }
  function bumpTyping() {
    clearTimeout(typingIdle);
    typingIdle = setTimeout(function () {
      var inp = document.getElementById("tb-input");
      if (typing && document.activeElement !== inp && !busy && !(voice && voice.speaking) && !(inp && inp.value)) exitTyping();
    }, 90000);
  }
  function renderThread() {
    var box = document.getElementById("type-thread");
    if (!box) return;
    var hist = ((chat && chat.history) || []).filter(function (m) { return m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim(); });
    var items = hist.slice(-4).map(function (m) { return { role: m.role, text: m.content, sources: m.sources }; });
    if (threadPending) {
      var last = items[items.length - 1];
      if (!last || last.role !== "user" || last.text !== threadPending) items.push({ role: "user", text: threadPending });
      items = items.slice(-4);
    }
    box.innerHTML = "";
    items.forEach(function (m) {
      var d = document.createElement("div");
      d.className = m.role === "user" ? "tt-me" : "tt-her";
      d.textContent = m.text;
      box.appendChild(d);
      if (m.role === "assistant" && m.sources && m.sources.length) { var ts = srcChips(m.sources); ts.className = "tt-srcs"; box.appendChild(ts); }
      if (m.role === "assistant" && threadPics && threadPics.text && m.text === threadPics.text) {
        var st = picStrip(threadPics.list);
        st.className = "tt-pics";
        box.appendChild(st);
      }
    });
    if (threadPending) {
      var dots = document.createElement("div");
      dots.className = "tt-dots";
      dots.textContent = "•••";
      box.appendChild(dots);
    }
    box.scrollTop = box.scrollHeight;
  }
  async function sendTyped() {
    var inp = document.getElementById("tb-input");
    var text = String((inp && inp.value) || "").trim();
    if (!text) return;
    inp.value = "";
    enterTyping();
    threadPending = (privateCompose || (window.FridayPrivate && privateCommand(text))) ? "🔒 Private message" : text;
    renderThread();
    typedQuiet = sv().speakTyped !== true;
    try { await handleUtterance(text, { typed: true }); }
    catch (e) {}
    finally {
      typedQuiet = false;
      threadPending = null;
      handsFree = false;
      renderThread();
      bumpTyping();
    }
  }
  function liveTap() {
    if (typing) { exitTyping(); handsFree = true; beginListen(); syncLive(); return; }
    if (liveOn() || (voice && voice.speaking) || busy) toggleListen();
    else { handsFree = true; beginListen(); }
    syncLive();
  }
  function orbTap() {
    if (sv().orbTalk === false) return;
    if (typing) { exitTyping(); handsFree = true; beginListen(); syncLive(); return; }
    toggleListen();
    syncLive();
  }
  function bindTalkbar() {
    var inp = document.getElementById("tb-input");
    var form = document.getElementById("tb-form");
    if (form) form.addEventListener("submit", function (ev) { ev.preventDefault(); sendTyped(); });
    var send = document.getElementById("tb-send");
    if (send) send.addEventListener("click", function () { sendTyped(); if (inp) inp.focus(); });
    if (inp) {
      inp.addEventListener("focus", function () { enterTyping(); });
      inp.addEventListener("blur", function () { bumpTyping(); });
    }
    var tt = document.getElementById("tb-type");
    if (tt) tt.addEventListener("click", function () { enterTyping(); if (inp) inp.focus(); });
    var live = document.getElementById("tb-live");
    if (live) live.addEventListener("click", liveTap);
    ["tb-camera", "tb-look"].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.addEventListener("click", function () { if (eyes) eyes.open(""); });
    });
    // 3.5.2: the installed app reports the real keyboard height; the web page falls back to visualViewport.
    if (window.FridayNative && FridayNative.kit && FridayNative.kit.onKeyboard) {
      nativeKb = FridayNative.kit.onKeyboard(function (h) {
        setKb(typing ? h : 0);
        if (window.scrollY) window.scrollTo(0, 0);
      });
    }
    if (window.visualViewport) {
      var vv = window.visualViewport;
      var onVV = function () {
        if (nativeKb) { if (window.scrollY) window.scrollTo(0, 0); return; }
        if (!typing) { setKb(0); return; }
        var kb = window.innerHeight - vv.height - vv.offsetTop;
        setKb(kb > 60 ? kb : 0);
        if (vv.offsetTop > 0 || window.scrollY) window.scrollTo(0, 0);
      };
      vv.addEventListener("resize", onVV);
      vv.addEventListener("scroll", onVV);
    }
    // Typed replies are text only unless "Speak typed replies" is on.
    var sp = voice.speak.bind(voice), qu = voice.queue.bind(voice);
    voice.speak = function () { if (typedQuiet) return Promise.resolve(); return sp.apply(null, arguments); };
    voice.queue = function () { if (typedQuiet) return; return qu.apply(null, arguments); };
    window.__fridayApplyTalkbar = applyTalkbar;
    applyTalkbar();
    setInterval(syncLive, 400);
  }

  var lastPhoto = null, lastPhotoAt = 0;

  function chime() {
    if (headacheOn()) return;
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
    applyHeadache();
  }

  // ---------- 3.5.1: headache mode ----------
  // Dims the screen (and the phone's real brightness in the app), slows and quiets her voice,
  // and pauses hands-free, chimes, briefings and greetings. The brightness goes back when it ends.
  var headacheWas = null;
  function applyHeadache() {
    var on = headacheOn();
    document.body.classList.toggle("headache", on);
    if (on === headacheWas) return;
    var first = headacheWas === null;
    headacheWas = on;
    var N = window.FridayNative;
    if (on) {
      if (handsFree) handsFree = false;
      if (N && N.brightness) N.brightness(0.12).then(function (prev) {
        if (prev != null && FridayStorage.get("headacheBrightness", null) == null) FridayStorage.set("headacheBrightness", prev);
      });
      try { applyPower(); } catch (e) {}
    } else if (!first) {
      var prev = FridayStorage.get("headacheBrightness", null);
      FridayStorage.set("headacheBrightness", null);
      if (N && N.brightness && prev != null) N.brightness(prev);
      handsFree = handsFreeOn();
      try { applyPower(); } catch (e) {}
    }
  }
  window.addEventListener("friday:mood", function () { applyHeadache(); });

  // ---------- diagnostics ----------
  // 4.2.1: the ways people ask for diagnostics ("can you run diagnostics", "run a diagnostic check please",
  // "hey Friday, diagnose yourself", "check your systems")
  function isDiagAsk(low) {
    var t = String(low || "").toLowerCase().replace(/[’]/g, "'").replace(/[.!?,]+/g, " ").replace(/\s+/g, " ").trim()
      .replace(/^(?:hey |ok |okay )?(?:friday|f r i d a y|jarvis|reed) /, "")
      .replace(/^(?:please |can you |could you |would you |will you |go ahead and |i want you to |i need you to )+/, "")
      .replace(/(?: please| now| for me| real quick| quickly)+$/, "").trim();
    return /^(?:(?:run|do|start|perform|give me|show me|show|open)\s+)?(?:a |an |the |your |some |my )?(?:full |quick |complete |whole )?(?:system |systems |self |self-)?(?:diagnostics?|diagnostic (?:check|test|scan|report)|system check|systems check|self[- ]?check|self[- ]?test|health check|check ?up|status check)(?: on (?:yourself|your ?self|your systems|everything|the app))?$/.test(t) ||
      /^check (?:yourself|your ?self|your systems|all (?:of )?your systems)(?: out)?$/.test(t) ||
      /^diagnose (?:yourself|your ?self|your systems|the app)$/.test(t) ||
      /^(?:are )?(?:all )?(?:of )?your systems (?:ok|okay|good|working|running)$/.test(t);
  }

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
      // 4.2.2: the Groq chat models that are still offered (Llama 3.1 8B and 3.3 70B were shut down in August 2026)
      var want = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.6-27b"];
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
    // 4.2: the safety copy in the Keychain (so an update can't wipe her)
    var vi = FridayStorage.vaultInfo ? FridayStorage.vaultInfo() : null;
    if (vi && vi.native) {
      var hhmm = function (t) { return new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); };
      add(!!vi.savedAt && !vi.hold, vi.hold ? "Safety copy couldn't be read; kept untouched" : vi.savedAt ? "Safety copy saved " + hhmm(vi.savedAt) + " (" + vi.items + " parts of her)" : "Safety copy: saving soon");
      if (vi.restoredAt) add(true, "Brought back from the safety copy " + hhmm(vi.restoredAt) + " after an update wiped her storage");
    }
    if (window.FridayTV && FridayTV.available()) add(true, FridayTV.isSetUp() ? "Apple TV remote: paired" : "Apple TV remote: not paired (Settings → Lights)");
    var u = FridayStorage.get("usage.brain", null);
    if (u && u.date === new Date().toDateString()) add(true, "Today: " + (u.total || 0) + " replies, " + (u.tts || 0) + " AI voice clips");
    var box = document.getElementById("diag-list");
    if (box) { box.innerHTML = ""; lines.forEach(function (l) { var d = document.createElement("div"); d.className = "diag-row" + (l.charAt(0) === "✗" ? " bad" : ""); d.textContent = l; box.appendChild(d); }); }
    openPanel("diag");
    var summary = problems ? "Diagnostics done. I found " + problems + " thing" + (problems > 1 ? "s" : "") + " to look at; they're on screen." : "All systems normal" + (honorific() ? ", " + honorific() : "") + ".";
    setCaption(summary);
    if (speak && chat) chat._push("assistant", summary);   // asked out loud: her answer shows in the chat too
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
    // 3.5.2: nothing to set up in Settings for this one, so the gold button just closes the card.
    document.getElementById("btn-wn-shortcut").onclick = done;
  }

  function showSetup(on) {
    document.getElementById("setup").classList.toggle("open", !!on);
  }

  function init() {
    // 4.0: an acronym name (F.R.I.D.A.Y.) is shown as written; plain names keep the lowercase style
    var shown0 = shownName(), styled = /\./.test(shown0) ? shown0 : shown0.toLowerCase();
    document.getElementById("caption-name").textContent = styled;
    document.getElementById("caption-name").classList.toggle("as-written", styled !== styled.toLowerCase());
    document.getElementById("setup-name").textContent = styled;
    document.title = shown0;
    fillShownName();

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
            shownName().toUpperCase() + " · " + String(kind).toUpperCase();
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
          handleUtterance(act.command, { bubble: true });
        } else if (act.type === "url" && /^localdevvpn:\/\/enable/i.test(act.url || "")) FridayRefresh.run({ fromBubble: true });
        else if (act.type === "url") openUrl(act.url);
      },
      onAddRequest: function () { openPanel("add-bubble"); },
      onLayout: function (mode, revealed) { applyOrbFrame(mode, revealed); },
      frameFor: function (mode) { return LAYOUT_FRAMES[mode] || LAYOUT_FRAMES.orbit; }
    });
    // 3.3: a fresh start once. She begins with a few bubbles and adds what you use; your old set is saved.
    if (!FridayStorage.get("learnDefault33", false)) {
      FridayStorage.set("learnDefault33", true);
      if (!bubbles.learning()) bubbles.setLearning(true);
    }

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
    window.__friday = { bubbles: bubbles, orb: orb, applyLayout: applyLayout, applyLook: applyLook, voice: voice,
      chat: chat, typing: function () { return typing; }, enterTyping: enterTyping, exitTyping: exitTyping, sendTyped: sendTyped, liveOn: liveOn, openPanel: openPanel };
    if (settings.values.iconId) applyAppIcon(settings.values.iconId);
    renderChips();
    bindTalkbar();
    bindPrivate();
    setTimeout(function () { syncWidget(); }, 6000);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") syncWidget(true); });
    var pv = document.getElementById("pic-view");
    if (pv) pv.addEventListener("click", function () { pv.hidden = true; });

    neural = new FridayNeural(document.getElementById("neural-canvas"));
    if (window.__friday) window.__friday.neural = neural;
    neural.onOpen = function (panel) { openPanel(panel); };

    document.getElementById("orb-canvas").addEventListener("click", function () {
      if (document.querySelector(".panel.open")) return;
      orbTap();
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
          orbTap();
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
      FridayNative.notify.refresh().then(function (on) { if (on) { scheduleLifeAlerts(); FridayRefresh.schedule(); } if (settings && settings._refreshPhone) settings._refreshPhone(); });
    }
    // 3.3: tapping the refresh reminder does the refresh; the dark keyboard is set once
    if (window.FridayNative) {
      FridayNative.notify.onTap(function (extra) {
        if (extra && extra.action === "refresh-apps") setTimeout(function () { FridayRefresh.run({ fromNote: true }); }, 700);
      });
      if (FridayNative.kit.darkKeyboard) FridayNative.kit.darkKeyboard();
      // Max but smart: the orb eases off if the phone gets warm, and comes back when it cools
      if (FridayNative.kit.watchHeat) FridayNative.kit.watchHeat(function (st) {
        window.__fridayHeat = st;
        if (orb && orb.setThermal) orb.setThermal(st);
      });
      FridayRefresh.scheme();
      if (FridayNative.home && FridayNative.home.devices && FridayNative.home.available()) setTimeout(function () { FridayNative.home.devices(); }, 3000);
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

  // 4.1: wait (briefly) for her keys to load from the Keychain before starting
  function start() {
    var ready = (window.FridayStorage && FridayStorage.keysReady) || Promise.resolve();
    var once = false, go = function () { if (once) return; once = true; init(); };
    Promise.race([ready, new Promise(function (r) { setTimeout(r, 2500); })]).then(go, go);
    // 4.2: say so when an update had wiped her and she put everything back from the safety copy,
    // or (if only the brain list was missing) when she put back the brains
    Promise.resolve(ready).then(function () {
      var S0 = window.FridayStorage, note = S0 && S0.takeRestoreNote ? S0.takeRestoreNote() : null;
      var n = S0 && S0.restoredBrains ? S0.restoredBrains() : 0;
      var msg = note ? "The update wiped my storage, so I put everything back from my safety copy: memories, chats, settings and brains." :
        n > 0 ? "Brought back " + n + " brain" + (n === 1 ? "" : "s") + " after the update. No need to add them again." : "";
      if (msg) setTimeout(function () { try { toast(msg); } catch (e) {} }, 3000);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
// build 5 (v3.1)
