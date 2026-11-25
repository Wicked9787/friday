/* 4.2: Apple TV remote.
   She pairs with your Apple TV once (a 4-digit code shows on the TV), then presses its buttons over your
   home Wi-Fi with Apple's own remote protocol, the same way the iPhone's Apple TV Remote does. With
   HDMI-CEC on (it usually is), the TV turns on and off and changes volume with the Apple TV.
   Two ways to use it: the remote on Settings → Lights, and by voice ("pause the TV", "turn the TV up").
   Nothing goes to the internet; the pairing keys stay in this iPhone's Keychain. */
(function (root) {
  "use strict";

  function P() {
    var C = root.Capacitor;
    try { return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.FridayAtv && C.Plugins.FridayAtv.press ? C.Plugins.FridayAtv : null; } catch (e) { return null; }
  }
  function S() { return root.FridayStorage; }
  function available() { return !!P(); }
  function saved() { try { return (S() && S().get("atv", null)) || null; } catch (e) { return null; } }
  function save(o) { try { S().set("atv", o); } catch (e) {} }
  function isSetUp() { var s = saved(); return !!(s && s.paired); }

  async function call(fn, args) {
    var p = P();
    if (!p) return { ok: false, status: "unavailable" };
    try { return (await p[fn](args || {})) || {}; } catch (e) { return { ok: false, status: "error", error: String((e && e.message) || e) }; }
  }
  function status() { return call("status"); }
  function press(button, times, action) { return call("press", { button: button, times: times || 1, action: action || "click" }); }
  function swipe(dir) { return call("swipe", { dir: dir }); }
  function power(on) { return call("power", on == null ? {} : { on: !!on }); }
  function skip(back, seconds) { return call("skip", { dir: back ? "back" : "forward", seconds: seconds || 10 }); }
  function mute() { return call("mute"); }
  function scan() { return call("scan", { seconds: 4 }); }
  function connect(id) { return call("connect", id ? { id: id } : {}); }
  function pin(code) { return call("pin", { pin: code }); }
  function forget() { save(null); return call("forget"); }
  // for backup files (only when keys are included): the pairing itself, so the remote works again without a code
  async function exportPairing() { var r = await call("exportPairing"); return r && r.creds ? { id: r.id, name: r.name || "", creds: r.creds } : null; }
  async function importPairing(p) { if (!p || !p.id || !p.creds) return false; var r = await call("importPairing", p); return !!(r && r.ok); }

  // Wait a moment for the connection to settle so she can say if something's wrong.
  async function settle(ms) {
    var until = Date.now() + (ms || 4000), st = await status();
    while (Date.now() < until && (st.status === "connecting" || st.status === "disconnected")) {
      await new Promise(function (r) { setTimeout(r, 350); });
      st = await status();
    }
    if (st.status === "connected" && st.paired) {
      var s = saved() || {};
      if (!s.paired || s.id !== st.id || (st.name && s.name !== st.name)) save({ id: st.id || s.id || "", name: st.name || s.name || "Apple TV", paired: true, at: s.at || Date.now() });
    }
    return st;
  }

  function trouble(st) {
    var s = st && st.status;
    if (s === "localNetworkDenied") return "I'm not allowed on your home network. Turn on Local Network for me in iPhone Settings, Privacy & Security, Local Network.";
    if (s === "pairing") return "The Apple TV wants the code again. Open Settings, Lights, and pair it there.";
    if (s === "notfound") return "I can't find the Apple TV on your Wi-Fi. Is your phone on the home Wi-Fi?";
    if (s === "error" || s === "disconnected") return "I couldn't reach the Apple TV. Is your phone on the home Wi-Fi?";
    return "";
  }

  // ---------- voice ----------
  var TV = "(?:the |my )?(?:apple )?(?:tv|television)";
  var WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twice: 2, once: 1 };
  var WORDS2 = { fifteen: 15, twenty: 20, thirty: 30, forty: 40, sixty: 60 };
  function num(x, d, max) { if (x == null || x === "") return d; var n = WORDS[x] || WORDS2[x] || parseInt(x, 10); return isFinite(n) && n > 0 ? Math.min(n, max || 15) : d; }
  function clean(raw) {
    return String(raw || "").toLowerCase().replace(/[’]/g, "'").replace(/[.!?,]+/g, " ").replace(/\s+/g, " ").trim()
      .replace(/^(?:hey |ok |okay )?(?:friday|f r i d a y|jarvis|reed) /, "").replace(/^(?:please |can you |could you |would you )+/, "").replace(/ please$/, "").trim();
  }
  function parse(raw) {
    var t = clean(raw), m;
    if (!t || !/\b(tv|television|show|movie|episode|remote)\b/.test(t)) return null;
    // power
    if ((m = t.match(new RegExp("^(?:turn|switch|power) (on|off) " + TV + "$"))) || (m = t.match(new RegExp("^(?:turn|switch|power) " + TV + " (on|off)$")))) return { fn: "power", on: m[1] === "on" };
    if (new RegExp("^wake(?: up)? " + TV + "(?: up)?$").test(t)) return { fn: "power", on: true };
    if (new RegExp("^(?:put )?" + TV + " to sleep$").test(t)) return { fn: "power", on: false };
    // mute
    if ((m = t.match(new RegExp("^(un)?mute " + TV + "$")))) return { fn: "mute", un: !!m[1] };
    // volume (the Apple TV passes it to the TV)
    if ((m = t.match(new RegExp("^(?:turn|crank) " + TV + "(?: volume)? (up|down)(?: (?:by )?(\\w+)(?: notches| steps| clicks)?)?$"))) ||
        (m = t.match(new RegExp("^turn (up|down) " + TV + "(?: volume)?(?: (?:by )?(\\w+)(?: notches| steps| clicks)?)?$"))) ||
        (m = t.match(new RegExp("^" + TV + " volume (up|down)(?: (\\w+))?$")))) return { fn: "volume", up: m[1] === "up", times: num(m[2], 3) };
    if ((m = t.match(new RegExp("^(?:make )?" + TV + " (louder|quieter|softer)$")))) return { fn: "volume", up: m[1] === "louder", times: 3 };
    // play / pause
    if ((m = t.match(/^(pause|play|resume|unpause) (?:the |my )?(?:apple )?(tv|television|show|movie|episode)$/))) return { fn: "playpause", pause: m[1] === "pause" };
    // buttons
    var B = { up: "up", down: "down", left: "left", right: "right", ok: "select", okay: "select", select: "select", enter: "select", back: "back", "go back": "back", home: "tv", "go home": "tv", menu: "back" };
    if ((m = t.match(/^(?:press |hit |click )?(up|down|left|right|ok|okay|select|enter|back|go back|home|go home|menu)(?: (\w+) times| (twice|once))? on (?:the |my )?(?:apple )?(?:tv|television|remote)$/))) return { fn: "press", button: B[m[1]], times: num(m[2] || m[3], 1) };
    if ((m = t.match(/^(?:apple )?(?:tv|television) (up|down|left|right|ok|okay|select|enter|back|go back|home|go home|menu)(?: (\w+) times| (twice))?$/))) return { fn: "press", button: B[m[1]], times: num(m[2] || m[3], 1) };
    // skip ("go back on the TV" is the back button above; "go back 30 seconds on the TV" skips)
    if ((m = t.match(/^(?:skip|jump) (back|backward|forward|ahead)(?: (\w+) seconds)? (?:on|in) (?:the |my )?(?:apple )?(?:tv|television|show|movie|episode)$/)) ||
        (m = t.match(/^go (back|backward|forward|ahead) (\w+) seconds (?:on|in) (?:the |my )?(?:apple )?(?:tv|television|show|movie|episode)$/))) return { fn: "skip", back: /^back/.test(m[1]), seconds: num(m[2], 10, 60) };
    if ((m = t.match(/^(rewind|fast forward) (?:the |my )?(?:apple )?(?:tv|television|show|movie|episode)$/))) return { fn: "skip", back: m[1] === "rewind", seconds: 10 };
    return null;
  }

  async function run(cmd) {
    var r, say;
    if (cmd.fn === "power") { r = await power(cmd.on); say = cmd.on ? "Turning on the TV." : "Turning off the TV."; }
    else if (cmd.fn === "mute") { r = await mute(); say = cmd.un ? "Sound's back on." : "TV muted."; }
    else if (cmd.fn === "volume") { r = await press(cmd.up ? "volumeup" : "volumedown", cmd.times); say = cmd.up ? "Turned the TV up." : "Turned the TV down."; }
    else if (cmd.fn === "playpause") { r = await press("playpause"); say = cmd.pause ? "Paused." : "Playing."; }
    else if (cmd.fn === "skip") { r = await skip(cmd.back, cmd.seconds); say = (cmd.back ? "Went back " : "Skipped ahead ") + cmd.seconds + " seconds."; }
    else if (cmd.fn === "press") { r = await press(cmd.button, cmd.times); say = "Done."; }
    else return null;
    if (r && r.ok === false) return { say: trouble(r) || "I couldn't reach the Apple TV.", tool: "tv" };
    var st = await settle(cmd.fn === "skip" || cmd.fn === "mute" ? 1500 : 3500);
    var bad = st.status === "connected" ? "" : trouble(st);
    return { say: bad || say, tool: "tv" };
  }

  // Called by her in-app commands. null = not a TV command (or no Apple TV here): carry on as before.
  async function handle(raw) {
    if (!available()) return null;
    var cmd = parse(raw);
    if (!cmd) return null;
    if (!isSetUp()) return { say: "Pair your Apple TV with me first: Settings, Lights, Apple TV remote. It takes one code from the TV.", tool: "tv" };
    return run(cmd);
  }

  // ---------- the remote on Settings → Lights ----------
  function $(id) { return document.getElementById(id); }
  function bindRemote() {
    var box = $("atv-remote");
    if (!box || box.__bound) return;
    box.__bound = true;
    var stEl = $("atv-status"), cur = $("atv-current"), nameEl = $("atv-name"), setup = $("atv-setup"), list = $("atv-list"), pinRow = $("atv-pin-row");
    function say(t) { if (stEl) stEl.textContent = t || ""; }
    function show() {
      var s = saved();
      if (cur) cur.textContent = !available() ? "In the app only" : s && s.paired ? s.name || "Apple TV" : "Not paired";
      if (nameEl) nameEl.textContent = s && s.name ? s.name : "Apple TV";
      box.classList.toggle("atv-off", !(s && s.paired));
      if (setup && !(s && s.paired)) setup.hidden = false;
      var fg = $("btn-atv-forget"); if (fg) fg.hidden = !(s && s.paired);
    }
    show();
    if (!available()) { say("The Apple TV remote works in the installed app."); return; }

    function tap(fn) {
      return function (ev) {
        if (ev) ev.preventDefault();
        if (!isSetUp()) { say("Pair your Apple TV first (below)."); if (setup) setup.hidden = false; return; }
        Promise.resolve(fn()).then(function (r) {
          if (r && r.ok === false) say(trouble(r) || "Couldn't reach the Apple TV.");
          else if (r && r.status && r.status !== "connected" && r.status !== "connecting") { var tr = trouble(r); if (tr) say(tr); }
          else say("");
        });
      };
    }
    box.querySelectorAll("[data-atv]").forEach(function (b) {
      var a = b.getAttribute("data-atv");
      var fn = a === "skipback" ? function () { return skip(true, 10); } : a === "skipfwd" ? function () { return skip(false, 10); } :
        a === "mute" ? mute : a === "power" ? function () { return power(); } : function () { return press(a); };
      b.addEventListener("click", tap(fn));
    });

    // the touch area: swipe to move, tap to select, press and hold for a long select
    var pad = $("atv-pad"), start = null, holdT = null, held = false;
    if (pad) {
      pad.addEventListener("pointerdown", function (ev) {
        if (ev.target.closest && ev.target.closest("button")) return;
        start = { x: ev.clientX, y: ev.clientY, t: Date.now() }; held = false;
        try { pad.setPointerCapture(ev.pointerId); } catch (e) {}
        pad.classList.add("atv-touch");
        clearTimeout(holdT);
        holdT = setTimeout(function () { if (start) { held = true; tap(function () { return press("select", 1, "hold"); })(); } }, 650);
      });
      pad.addEventListener("pointermove", function (ev) {
        if (!start) return;
        if (Math.abs(ev.clientX - start.x) > 14 || Math.abs(ev.clientY - start.y) > 14) clearTimeout(holdT);
      });
      function end(ev) {
        clearTimeout(holdT);
        pad.classList.remove("atv-touch");
        if (!start) return;
        var dx = ev.clientX - start.x, dy = ev.clientY - start.y, s0 = start;
        start = null;
        if (held) return;
        if (Math.abs(dx) < 14 && Math.abs(dy) < 14) { if (Date.now() - s0.t < 650) tap(function () { return press("select"); })(); return; }
        var dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
        tap(function () { return swipe(dir); })();
      }
      pad.addEventListener("pointerup", end);
      pad.addEventListener("pointercancel", function () { clearTimeout(holdT); start = null; pad.classList.remove("atv-touch"); });
      pad.addEventListener("touchmove", function (ev) { ev.preventDefault(); }, { passive: false });
    }

    var pick = $("atv-pick");
    if (pick) pick.addEventListener("click", function () { if (setup) setup.hidden = !setup.hidden; });

    // pairing
    var pending = null;
    function waitFor(want, ms) {
      var until = Date.now() + ms;
      return new Promise(function (resolve) {
        (function loop() {
          status().then(function (st) {
            if (want.indexOf(st.status) >= 0 || Date.now() > until) resolve(st);
            else setTimeout(loop, 400);
          });
        })();
      });
    }
    async function begin(id, name) {
      say("Connecting to " + (name || "the Apple TV") + "…");
      if (pinRow) pinRow.hidden = true;
      var r = await connect(id);
      if (r.status === "notfound") { say(trouble(r)); return; }
      var st = await waitFor(["pairing", "connected", "error", "localNetworkDenied"], 15000);
      if (st.status === "pairing") {
        pending = { id: id || st.id, name: name || st.name };
        if (pinRow) pinRow.hidden = false;
        var pi = $("atv-pin"); if (pi) { pi.value = ""; try { pi.focus(); } catch (e) {} }
        say("Type the 4-digit code showing on your TV.");
        return;
      }
      if (st.status === "connected") { await settle(500); show(); say("Paired with " + (st.name || name || "your Apple TV") + ". Try the buttons."); if (setup) setup.hidden = true; return; }
      say(trouble(st) || "The Apple TV didn't answer. Try again.");
    }
    var find = $("btn-atv-find");
    if (find) find.addEventListener("click", async function () {
      find.disabled = true; say("Looking for Apple TVs on your Wi-Fi… (tap Allow if iPhone asks about your local network)");
      if (list) list.innerHTML = "";
      var r = await scan();
      find.disabled = false;
      var devs = (r && r.devices) || [];
      if (!devs.length) { say("No Apple TV found. Make sure this phone is on the same Wi-Fi as the Apple TV, then try again."); return; }
      say(devs.length === 1 ? "Found it. Tap it to pair." : "Tap your Apple TV to pair.");
      devs.forEach(function (d) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "btn"; b.textContent = d.name + (d.paired ? " (paired)" : "");
        b.addEventListener("click", function () { begin(d.id, d.name); });
        if (list) list.appendChild(b);
      });
    });
    var pb = $("btn-atv-pin");
    if (pb) pb.addEventListener("click", async function () {
      var code = String(($("atv-pin") || {}).value || "").replace(/\D/g, "");
      if (code.length !== 4) { say("The code on the TV has 4 digits."); return; }
      pb.disabled = true; say("Pairing…");
      await pin(code);
      var st = await waitFor(["connected", "error"], 15000);
      pb.disabled = false;
      if (st.status === "connected") {
        await settle(500);
        if (pinRow) pinRow.hidden = true;
        show(); if (setup) setup.hidden = true;
        say("Paired with " + (st.name || (pending && pending.name) || "your Apple TV") + ". Try the buttons, or say “pause the TV”.");
      } else say(st.error ? "That didn't work (" + st.error + "). Tap Find my Apple TV and try again." : "That didn't work. Tap Find my Apple TV and try again.");
    });
    var fg = $("btn-atv-forget");
    if (fg) fg.addEventListener("click", async function () {
      await forget(); show(); say("Forgot the Apple TV on this phone. You can also remove it on the TV: Settings, Remotes and Devices.");
    });
  }

  root.FridayTV = {
    available: available, isSetUp: isSetUp, parse: parse, handle: handle, run: run,
    press: press, swipe: swipe, power: power, skip: skip, mute: mute, status: status, scan: scan, connect: connect, pin: pin, forget: forget,
    exportPairing: exportPairing, importPairing: importPairing,
    bindRemote: bindRemote
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindRemote);
  else bindRemote();
})(window);
