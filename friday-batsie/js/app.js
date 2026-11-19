/* Friday app bootstrap: orb, voice, chat, bubbles, panels, phone handoff. */
(function () {
  "use strict";

  var cfg = window.FRIDAY_CONFIG;
  var profile = cfg.getProfile();
  var settingsData = window.FridayLoadSettings();

  var orb, voice, chat, bubbles, tools, settings, neural;
  var handsFree = cfg.queryParam("listen") === "1";
  var busy = false;

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

  function tickClock() {
    var el = document.getElementById("clock");
    var d = new Date();
    el.textContent = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function shortcutUrl(command) {
    var name = encodeURIComponent(settings.shortcutName());
    var text = encodeURIComponent(command);
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

  function openUrl(url) {
    if (!url) return;
    location.href = url;
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
      } else if (result.kind === "phone") {
        setCaption(result.text);
        await voice.speak(result.text, profile);
        runShortcut(result.command);
      } else {
        setCaption(result.text || "");
        renderChat();
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
    if (voice.speaking) voice.stopSpeak();
    if (voice.listening) endListen();
    else beginListen();
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
      onState: function () {}
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
      onAddRequest: function () { openPanel("add-bubble"); }
    });

    settings = new FridaySettings({
      profile: profile,
      voice: voice,
      onLook: function (id) { orb.setLook(id); toast("Look changed."); },
      onReset: function () { toast("Reset. Reloading."); setTimeout(function () { location.reload(); }, 400); },
      onToast: toast
    });

    neural = new FridayNeural(document.getElementById("neural-canvas"));

    document.getElementById("orb-canvas").addEventListener("click", function () {
      if (document.querySelector(".panel.open")) return;
      toggleListen();
    });

    document.getElementById("btn-settings").onclick = function () { openPanel("settings"); };
    document.getElementById("btn-chat").onclick = function () { openPanel("chat"); };
    document.getElementById("btn-neural").onclick = function () { openPanel("neural"); };
    document.querySelectorAll("[data-close]").forEach(function (b) {
      b.addEventListener("click", closePanels);
    });
    document.getElementById("btn-edit-done").onclick = function () { bubbles.setEdit(false); };
    document.getElementById("btn-edit-reset").onclick = function () { bubbles.resetLayout(); };

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
    document.getElementById("btn-custom-bubble").onclick = function () {
      var label = document.getElementById("custom-label").value.trim() || "Link";
      var url = document.getElementById("custom-url").value.trim();
      if (!url) { toast("Add a link first."); return; }
      bubbles.add({ kind: "link", label: label, gold: true, size: "lg", action: "url", url: url });
      closePanels();
      bubbles.setEdit(true);
    };

    window.addEventListener("friday:daddy", function () { bubbles.syncDaddy(); });

    document.getElementById("setup-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var key = document.getElementById("setup-key").value.trim();
      if (!key) return;
      FridayStorage.setApiKey(key);
      document.getElementById("setup-key").value = "";
      showSetup(false);
      toast("Key saved on this phone.");
    });

    tickClock();
    setInterval(tickClock, 10000);

    if (!FridayStorage.hasApiKey()) showSetup(true);

    if (handsFree && FridayStorage.hasApiKey()) {
      setCaption("Listening…");
      setTimeout(function () { beginListen(); }, 600);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
