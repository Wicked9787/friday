/* Friday app bootstrap: orb, voice, chat, bubbles, panels, phone handoff. */
(function () {
  "use strict";

  var cfg = window.FRIDAY_CONFIG;
  var profile = cfg.getProfile();
  var settingsData = window.FridayLoadSettings();

  var orb, voice, chat, bubbles, tools, settings, neural;
  var IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  var handsFree = cfg.queryParam("listen") === "1" || IS_NATIVE;
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
    double: { cyN: 0.44, radiusK: 0.24 },
    spiral: { cyN: 0.30, radiusK: 0.24 },
    home: { cyN: 0.22, radiusK: 0.18 },
    list: { cyN: 0.28, radiusK: 0.22 },
    sheet: { cyN: 0.25, radiusK: 0.2 }
  };

  function applyOrbFrame(mode, revealed) {
    var m = (mode === "orbonly" && revealed) ? "dock" : (mode || "orbit");
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
    else applyOrbFrame(id, id !== "orbonly");
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
  }

  function openPanel(id) {
    closePanels();
    var el = document.getElementById("panel-" + id);
    if (el) el.classList.add("open");
    if (id === "neural") {
      if (neural) neural.start();
    } else if (neural) neural.stop();
    if (id === "chat") renderChat();
    if (id === "notes") renderNotes();
    if (id === "memory") renderMemory();
  }

  function closePanels() {
    document.querySelectorAll(".panel.open").forEach(function (p) { p.classList.remove("open"); });
    if (neural) neural.stop();
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

  function runShortcut(command) {
    var url = shortcutUrl(command);
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
        "&longitude=" + pos.lon + "&current=temperature_2m,weather_code&temperature_unit=fahrenheit";
      return fetch(url).then(function (r) { return r.json(); }).then(function (data) {
        var t = data && data.current ? Math.round(data.current.temperature_2m) : null;
        var code = data && data.current ? data.current.weather_code : null;
        var phrase = WMO[code] || "the weather you'd expect";
        return { temp: t, phrase: phrase, fallback: pos.fallback, label: pos.label || "Cumberland Gap" };
      });
    });
  }

  function weatherSentence() {
    return fetchWeather().then(function (w) {
      var where = w.fallback ? ("In " + w.label + ", it's ") : "It's ";
      if (w.temp == null) return "I couldn't get the weather just now.";
      return where + w.temp + "° and " + w.phrase + ".";
    }).catch(function () {
      return "I couldn't get the weather just now.";
    });
  }

  function todayNotesAndTimers() {
    var bits = [];
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
    if (tools && tools._timer && tools._remain > 0) {
      var m = Math.floor(tools._remain / 60), s = tools._remain % 60;
      bits.push("A timer is running, with " + (m ? (m + " minutes ") : "") + s + " seconds left.");
    }
    if (!bits.length) bits.push("No notes or timers for today.");
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
      var hello = "Good morning" + (honorific() ? ", " + honorific() : "") + ". " + clockPhrase(now);
      weatherSentence().then(function (wx) {
        speakLine(hello + " " + wx + " " + todayNotesAndTimers());
      });
      return;
    }
    if (s.wakeGreeting !== false) speakLine(wakeLine());
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

  function renderMemory() {
    tools.renderList(document.getElementById("memory-list"), chat.memory, function (i) {
      chat.removeMemory(i);
      renderMemory();
    });
  }

  async function handleUtterance(text, opts) {
    opts = opts || {};
    text = String(text || "").trim();
    if (!text) {
      setCaption("Tap to talk");
      return;
    }
    setCaption(text);
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
      var result = await chat.ask(text);
      if (result.kind === "timer") {
        tools.startTimer(result.seconds);
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
        runShortcut(result.command);
        if (result.kind === "messages") showMessagesButton(result.command);
      } else if (result.kind === "memory") {
        setCaption(result.text || "");
        renderMemory();
        if (bubbles) bubbles.refreshSuggestions();
        await voice.speak(result.text, profile);
      } else {
        setCaption(result.text || "");
        renderChat();
        if (bubbles && bubbles.noteAppMentions(text)) bubbles.refreshSuggestions();
        await voice.speak(result.text, profile);
      }
    } catch (err) {
      var msg = (err && err.message) || "Something went wrong.";
      setCaption(msg);
      toast(msg);
    } finally {
      busy = false;
      if (neural) neural.setActive(null);
      document.getElementById("neural-caption").textContent = (profile.assistantName || "Friday").toUpperCase() + " · THINKING";
      if (handsFree && !voice.listening) {
        setTimeout(function () { beginListen(); }, 400);
      } else if (!voice.speaking) {
        orb.setTalking("idle", 0);
      }
    }
  }

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
    handsFree = true;
    beginListen();
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
      onState: function () {},
      onSilence: function () { if (voice.listening) endListen(); }
    });
    voice.setVoiceURI(settingsData.voiceURI || "");

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

    bubbles = new FridayBubbles({
      el: document.getElementById("bubbles"),
      profile: profile,
      onAction: function (act) {
        if (act.type === "panel") openPanel(act.panel);
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
      onAddBubble: function (spec) {
        bubbles.add(spec);
        closePanels();
        bubbles.setEdit(true);
        toast("Added to the map.");
      }
    });

    applyLayout(settings.values.layout || "orbit", true);
    window.__friday = { bubbles: bubbles, orb: orb, applyLayout: applyLayout, applyLook: applyLook };
    if (settings.values.iconId) applyAppIcon(settings.values.iconId);
    renderChips();

    neural = new FridayNeural(document.getElementById("neural-canvas"));

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
      tools.startTimer(m * 60 + s);
    };
    document.getElementById("timer-cancel").onclick = function () { tools.cancelTimer(); };
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

    if (IS_NATIVE) {
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState !== "visible") return;
        if (!FridayStorage.hasApiKey() || document.querySelector(".panel.open")) return;
        setTimeout(function () {
          if (!voice.listening && !voice.speaking && !busy) { handsFree = true; beginListen(); }
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

    setTimeout(maybeGreet, 700);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
// build 2
