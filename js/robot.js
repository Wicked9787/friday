/* Friday 3.5.2 — the robot (iCTRL).
   iCTRL is a separate app on the phone that can tap, type and read the screen in other apps.
   It listens only on the phone itself (127.0.0.1:8200). Friday pairs with it once (you tap Allow
   on the robot's notification), then sends it one step at a time while an AI decides the next step.

   Safety rules built in here, not just in the prompt:
   - Before tapping anything like Send, Pay, Buy, Delete, Post or Confirm, she stops and asks you.
   - She never types passwords, passcodes or card numbers.
   - Every task has a step limit and a time limit, and "stop the robot" cancels it.
   - Holding both volume buttons always stops the robot too (that's iOS, not us). */
(function (root) {
  "use strict";

  var HOST = "http://127.0.0.1:8200";
  var KEY_STORE = "robotKey";
  var MAX_STEPS = 16;
  var MAX_MS = 150000;           // 2.5 minutes, inside the default 3-minute background window
  var RISKY = /\b(send|pay|buy|purchase|place order|order now|checkout|check out|confirm|delete|remove|erase|post|publish|share|transfer|submit|subscribe|sign up|log ?out|sign out|reset|unfollow|block|report|call|facetime)\b/i;
  var SECRET = /\b(password|passcode|pass code|pin\b|card number|cvv|cvc|security code|social security|ssn|routing|account number|one[- ]time code|verification code)\b/i;

  var enc = new TextEncoder();
  var dec = new TextDecoder();
  var subtle = root.crypto && root.crypto.subtle;

  var running = null;            // { cancel: bool }
  var pending = null;            // a paused task waiting for "yes" / "no"

  function store() { return root.FridayStorage; }
  function activity(t) { try { if (root.FridayBrain && root.FridayBrain.activity) root.FridayBrain.activity("robot", t); } catch (e) {} }
  function keepAlive(on) { try { if (root.FridayKeepAlive) root.FridayKeepAlive(on); } catch (e) {} }

  // ---------- bytes ----------
  function hex(u8) { var s = ""; for (var i = 0; i < u8.length; i++) s += (u8[i] < 16 ? "0" : "") + u8[i].toString(16); return s; }
  function unhex(s) { s = String(s || ""); var o = new Uint8Array(s.length / 2); for (var i = 0; i < o.length; i++) o[i] = parseInt(s.substr(i * 2, 2), 16); return o; }
  function b64(u8) { var s = ""; for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function unb64(s) { var b = atob(String(s || "")); var o = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; }
  function cat() { var n = 0, i; for (i = 0; i < arguments.length; i++) n += arguments[i].length; var o = new Uint8Array(n), p = 0; for (i = 0; i < arguments.length; i++) { o.set(arguments[i], p); p += arguments[i].length; } return o; }
  function be(n, bytes) { var o = new Uint8Array(bytes); for (var i = bytes - 1; i >= 0; i--) { o[i] = n % 256; n = Math.floor(n / 256); } return o; }

  async function hmacKey(key) { return subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); }
  async function hmac(key, data) { return new Uint8Array(await subtle.sign("HMAC", await hmacKey(key), data)); }
  // PRF-CTR keystream, exactly like iCTRL's reference client: block_i = HMAC(key, nonce || be32(i)).
  async function keystreamXor(key, nonce, data) {
    var k = await hmacKey(key), out = new Uint8Array(data.length), blocks = Math.ceil(data.length / 32), jobs = [];
    for (var i = 0; i < blocks; i++) jobs.push(subtle.sign("HMAC", k, cat(nonce, be(i, 4))));
    var ks = await Promise.all(jobs);
    for (var b = 0; b < blocks; b++) {
      var blk = new Uint8Array(ks[b]), off = b * 32;
      for (var j = 0; j < 32 && off + j < data.length; j++) out[off + j] = data[off + j] ^ blk[j];
    }
    return out;
  }

  // ---------- HTTP (native, so the app's web page isn't blocked) ----------
  function nativeHttp() {
    var C = root.Capacitor;
    try { return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.CapacitorHttp || null; } catch (e) { return null; }
  }
  async function request(method, path, body, timeoutMs) {
    var H = nativeHttp(), url = HOST + path;
    if (H) {
      var r = await H.request({ url: url, method: method, headers: { "Content-Type": "application/json" }, data: body || undefined, connectTimeout: 4000, readTimeout: timeoutMs || 45000 });
      var d = r && r.data;
      if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) {} }
      return { status: +(r && r.status) || 0, data: d };
    }
    var res = await fetch(url, { method: method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    var t = await res.text(), j = t;
    try { j = JSON.parse(t); } catch (e2) {}
    return { status: res.status, data: j };
  }

  // ---------- pairing + calls ----------
  function savedKey() { var k = store().get(KEY_STORE, null); return k && k.key && k.tok ? k : null; }

  async function isRunning() {
    try { var r = await request("GET", "/whoami", null, 4000); return r.status === 200; }
    catch (e) { return false; }
  }

  async function pair(name) {
    if (!subtle) throw new Error("This phone's web view can't do the robot's encryption.");
    // Blocks until you tap Allow on the robot's notification (or it times out).
    var r = await request("POST", "/pair", { client_name: name || "Friday", plain: true }, 95000);
    if (r.status !== 200 || !r.data || !r.data.token) throw new Error("The robot didn't allow pairing" + (r.data && r.data.error ? ": " + (r.data.error.message || r.data.error) : "."));
    var key = unhex(r.data.token);
    var tok = hex(new Uint8Array(await subtle.digest("SHA-256", key)).subarray(0, 4));
    store().set(KEY_STORE, { key: hex(key), tok: tok, at: new Date().toISOString() });
    return true;
  }

  var rpcId = 1;
  async function call(method, params, timeoutMs) {
    var rec = savedKey();
    if (!rec) { var e0 = new Error("not paired"); e0.code = 401; throw e0; }
    var key = unhex(rec.key);
    var body = enc.encode(JSON.stringify({ jsonrpc: "2.0", method: method, params: params || {}, id: rpcId++ }));
    var nonce = root.crypto.getRandomValues(new Uint8Array(16));
    var ts = Math.floor(Date.now() / 1000);
    var kEnc = await hmac(key, cat(enc.encode("ictrl-v1|enc-req"), nonce));
    var kMac = await hmac(key, cat(enc.encode("ictrl-v1|mac"), nonce));
    var ct = await keystreamXor(kEnc, nonce, body);
    var tag = await hmac(kMac, cat(enc.encode("v1"), unhex(rec.tok), be(ts, 8), nonce, ct));
    var r = await request("POST", "/rpc", { v: 1, tok: rec.tok, ts: ts, nonce: hex(nonce), ct: b64(ct), tag: hex(tag) }, timeoutMs || 45000);
    if (r.status === 401) { store().set(KEY_STORE, null); var e1 = new Error("not paired"); e1.code = 401; throw e1; }
    if (r.status !== 200 || !r.data || !r.data.ct) { var e2 = new Error("robot error " + r.status + (r.data && r.data.error ? ": " + JSON.stringify(r.data.error).slice(0, 160) : "")); e2.code = r.status; throw e2; }
    var respCt = unb64(r.data.ct);
    var expect = hex(await hmac(kMac, cat(enc.encode("resp"), nonce, respCt)));
    if (expect !== String(r.data.tag || "").toLowerCase()) throw new Error("The robot's reply didn't check out, so I ignored it.");
    var kResp = await hmac(key, cat(enc.encode("ictrl-v1|enc-resp"), nonce));
    var out = JSON.parse(dec.decode(await keystreamXor(kResp, nonce, respCt)));
    if (out.error) { var e3 = new Error(out.error.message || "robot error"); e3.rpc = out.error; throw e3; }
    return out.result;
  }

  // ---------- the step-by-step loop ----------
  function trimJSON(v, max) {
    var s;
    try { s = JSON.stringify(v, function (k, x) { return (k === "frame_raw" || k === "image" || k === "data") ? undefined : x; }); } catch (e) { s = String(v); }
    return s.length > max ? s.slice(0, max) + "…(cut)" : s;
  }
  function parseStep(text) {
    var m = String(text || "").match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch (e) { return null; }
  }

  var ALLOWED = ["resolve_app", "launch_app", "activate_app", "find_element", "tap", "type", "page", "swipe", "home", "open_url", "screen_text", "read", "done", "ask"];

  function systemPrompt(profile) {
    var me = (profile && profile.assistantName) || "Friday";
    var owner = (profile && profile.ownerName) || "the user";
    return [
      "You are " + me + "'s hands. You operate " + owner + "'s iPhone through iCTRL, one step at a time, to finish the task.",
      "Each turn you get the task, the steps so far with their results, and the current screen (iCTRL page_source JSON). Reply with ONE JSON object and nothing else:",
      '{"action": "<one of: resolve_app, launch_app, activate_app, find_element, tap, type, page, swipe, home, open_url, screen_text, read, done, ask>", "params": {...}, "why": "<5-10 words>", "say": "<only for done/ask: one or two short spoken sentences>", "come_back": <true|false, only for done>}',
      "Params: resolve_app {text: every name the app goes by, separated by |}; launch_app/activate_app {bundle_id}; find_element {element_id: label, match: \"contains\" optional, element_type optional} returns a ref; tap {ref} or {x, y}; type {text, submit optional, clear optional}; page/swipe {direction: up|down|left|right}; open_url {url}; screen_text {} when the tree is thin; read {} just re-reads the screen.",
      "Rules: open apps with resolve_app then launch_app, never by tapping home-screen icons. Read before acting. Tap by ref from find_element. Never repeat an action just to be safe; a success reply means it worked. Typing appends unless clear is true.",
      "Safety: never tap a final Send, Pay, Buy, Place order, Confirm, Delete or Post yourself — use ask with a short question first unless the step says it was already approved. Never type passwords, passcodes, PINs, card numbers or verification codes; use ask to have " + owner + " do that part. Stop at captchas and say so. Don't open or read private things that weren't asked for.",
      "Finish with done as soon as the task is complete, or if it can't be done, with say explaining briefly. come_back true means return to " + me + " afterwards; use false when " + owner + " will want to stay in the app (for example: open something to watch or read).",
      "Write say like you're talking out loud, in " + me + "'s voice: short, natural, no lists."
    ].join("\n");
  }

  function hostOf(info) {
    if (!info) return null;
    return (info.system && info.system.foreground_app) || info.foreground_app || null;
  }

  async function step(ctx, act) {
    var a = String(act.action || "").trim(), p = act.params || {};
    if (a === "read") return { note: "re-read" };
    if (a === "tap" && p.ref) {
      var label = ctx.refs[p.ref] || "";
      if (RISKY.test(label) && !ctx.approved) return { needsOk: "I'm about to tap \"" + label + "\". Should I go ahead?" };
    }
    if (a === "find_element" && p.element_id && RISKY.test(String(p.element_id)) && !ctx.approved) {
      // finding is fine; the check happens at the tap
    }
    if (a === "type") {
      var field = ctx.lastField || "";
      if (SECRET.test(field) || SECRET.test(String(act.why || ""))) return { needsUser: "That part needs a password or code, so you'll have to type it yourself." };
    }
    var method = a === "read" ? "page_source" : a;
    var res = await call(method, p, a === "screen_text" ? 25000 : 30000);
    if (a === "find_element" && res) {
      if (res.ref) ctx.refs[res.ref] = String(p.element_id || res.label || "");
      ctx.lastField = String(p.element_id || "") + " " + String(res.element_type || "") + (res.is_secure ? " password" : "");
    }
    if (a === "tap") ctx.approved = false; // an approval covers one tap only
    return res;
  }

  async function loop(ctx, say) {
    var started = Date.now();
    while (ctx.history.length < MAX_STEPS) {
      if (running && running.cancel) return { text: "Okay, I stopped the robot.", stopped: true };
      if (Date.now() - started > MAX_MS) return { text: "That was taking too long, so I stopped. I got " + ctx.history.length + " steps in." };

      var act = ctx.next;
      ctx.next = null;
      if (!act) {
        var screen;
        try { screen = await call("page_source", { visible_only: true, max_children: 50 }, 25000); }
        catch (e) { screen = { error: String(e.message || e) }; }
        var past = ctx.history.slice(-8).map(function (h, i) { return (i + 1) + ". " + h.action + " " + trimJSON(h.params, 160) + " -> " + h.result; }).join("\n") || "(none yet)";
        var out = await root.FridayBrain.ask([
          { role: "system", content: systemPrompt(ctx.profile) },
          { role: "user", content: "Task: " + ctx.goal + (ctx.approvedNote ? "\n" + ctx.approvedNote : "") + "\n\nSteps so far:\n" + past + "\n\nCurrent screen:\n" + trimJSON(screen, 7000) }
        ], { temperature: 0.1, max_tokens: 500, reasoning_effort: "low" });
        act = parseStep(out);
        if (!act || ALLOWED.indexOf(String(act.action)) < 0) {
          ctx.bad = (ctx.bad || 0) + 1;
          if (ctx.bad > 2) return { text: "I couldn't work out the next step there, so I stopped." };
          continue;
        }
      }

      if (act.action === "done") return { text: act.say || "Done.", comeBack: act.come_back !== false };
      if (act.action === "ask") { pending = ctx; ctx.next = null; return { text: act.say || "What should I do next?", paused: true }; }

      var r;
      try { r = await step(ctx, act); }
      catch (e) {
        if (e && e.code === 401) return { text: "The robot forgot our pairing. Say \"pair with the robot\" and tap Allow on its notification." };
        r = { error: String((e && e.message) || e).slice(0, 200) };
      }
      if (r && r.needsOk) { ctx.next = act; pending = ctx; return { text: r.needsOk, paused: true }; }
      if (r && r.needsUser) { return { text: r.needsUser }; }

      var summary = r && r.error ? "ERROR " + r.error : trimJSON(r && { ok: true, ref: r.ref, label: r.label, hint: r.hint, moved: r.moved, settle: r.settle && r.settle.stable, error: r.error, bundle_id: r.bundle_id, candidates: r.candidates || r.results }, 300);
      ctx.history.push({ action: act.action, params: act.params || {}, result: summary });
      activity(act.action + (act.why ? ": " + act.why : ""));
      if (say && act.why && ctx.history.length === 1) say("On it.");
    }
    return { text: "I hit my step limit, so I stopped. You may need to finish the last bit." };
  }

  async function finish(ctx, result) {
    if (result && result.comeBack && ctx.host) {
      try { await call("activate_app", { bundle_id: ctx.host }, 10000); } catch (e) {}
    }
  }

  async function run(goal, profile, say) {
    if (running) return { text: "The robot's already working on something. Say \"stop the robot\" to cancel it." };
    if (!(await isRunning())) return { text: "The robot isn't on. Open the iCTRL app, mount if it asks, and tap Start Server, then ask me again." };
    if (!savedKey()) {
      if (say) say("First I need to pair with the robot. Tap Allow on its notification.");
      try { await pair((profile && profile.assistantName) || "Friday"); }
      catch (e) { return { text: (e && e.message) || "Pairing didn't work." }; }
    }
    var ctx = { goal: goal, profile: profile, history: [], refs: {}, host: null, approved: false };
    try { ctx.host = hostOf(await call("device_info", {}, 15000)); } catch (e) {}
    return go(ctx, say);
  }

  async function go(ctx, say) {
    running = { cancel: false };
    keepAlive(true);
    var result;
    try { result = await loop(ctx, say); }
    catch (e) { result = { text: "The robot ran into a problem: " + String((e && e.message) || e).slice(0, 120) }; }
    finally { running = null; keepAlive(false); }
    if (!result.paused) await finish(ctx, result);
    return result;
  }

  async function answer(yes, say) {
    var ctx = pending;
    pending = null;
    if (!ctx) return null;
    if (!yes) return { text: "Okay, I won't. I stopped there." };
    ctx.approved = true;
    ctx.approvedNote = "The owner approved the step you asked about. Do it now, then continue.";
    return go(ctx, say);
  }

  // ---------- what you can say ----------
  var RE_PAIR = /\b(pair|connect|link|hook)\b.*\b(robot|ictrl)\b|\b(robot|ictrl)\b.*\b(pair|connect)\b/i;
  var RE_STATUS = /^(is )?(the )?(robot|ictrl)( on| running| working| ready| status)?\??$|^(is|are) (the )?(robot|ictrl) (on|running|working|ready)\??$|^robot status$/i;
  var RE_STOP = /^(stop|cancel|kill|end)( the)? (robot|ictrl)\b|^(robot|ictrl),? (stop|cancel)\b/i;
  var RE_FORGET = /^(forget|unpair|disconnect)( the)? (robot|ictrl)\b/i;
  var RE_TASK = /^(?:hey )?(?:robot|ictrl)[,:!]?\s+(.{3,})$|\b(?:use|have|get|tell|let) (?:the )?(?:robot|ictrl) (?:to )?(.{3,})$/i;
  var RE_YES = /^(yes|yeah|yep|yup|sure|ok|okay|do it|go ahead|go for it|confirm|send it|please do)\b/i;
  var RE_NO = /^(no|nope|nah|don'?t|cancel|stop|never ?mind|wait)\b/i;

  function detect(text) {
    var t = String(text || "").trim().replace(/[.!]+$/, "");
    if (pending && RE_YES.test(t)) return { kind: "yes" };
    if (pending && RE_NO.test(t)) return { kind: "no" };
    if (RE_STOP.test(t)) return { kind: "stop" };
    if (RE_FORGET.test(t)) return { kind: "forget" };
    if (RE_PAIR.test(t)) return { kind: "pair" };
    if (RE_STATUS.test(t)) return { kind: "status" };
    var m = t.match(RE_TASK);
    if (m) return { kind: "task", goal: (m[1] || m[2] || "").trim() };
    return null;
  }

  async function handle(cmd, profile, say) {
    if (cmd.kind === "yes" || cmd.kind === "no") return answer(cmd.kind === "yes", say);
    if (cmd.kind === "stop") {
      pending = null;
      if (running) { running.cancel = true; return { text: "Stopping the robot." }; }
      return { text: "The robot isn't doing anything right now." };
    }
    if (cmd.kind === "forget") { store().set(KEY_STORE, null); pending = null; return { text: "Okay, I forgot the robot. Say \"pair with the robot\" to connect again." }; }
    if (cmd.kind === "status") {
      var on = await isRunning();
      if (!on) return { text: "The robot is off. Open iCTRL and tap Start Server to turn it on." };
      return { text: savedKey() ? "The robot is on and we're paired. Just say robot, then what you want done." : "The robot is on, but we're not paired yet. Say \"pair with the robot\"." };
    }
    if (cmd.kind === "pair") {
      if (!(await isRunning())) return { text: "The robot isn't on. Open iCTRL and tap Start Server first." };
      if (say) say("Tap Allow on the robot's notification.");
      try { await pair((profile && profile.assistantName) || "Friday"); return { text: "We're paired. Say robot, then what you want me to do." }; }
      catch (e) { return { text: (e && e.message) || "Pairing didn't work." }; }
    }
    if (cmd.kind === "task") {
      if (!cmd.goal) return { text: "What should the robot do?" };
      return run(cmd.goal, profile, say);
    }
    return null;
  }

  // ---------- 3.5.3: using the robot without saying "robot" ----------
  // Cheap word check first; only if it looks like a job inside another app do we ask the robot
  // if it's on and ask a small AI "does this need someone to tap around in an app?".
  var APPS = "youtube|you tube|spotify|tiktok|tik tok|instagram|facebook|messenger|snapchat|netflix|hulu|disney|max|prime video|amazon|settings|safari|chrome|google maps|maps|google|uber|lyft|doordash|door dash|grubhub|instacart|cash app|cashapp|venmo|paypal|twitter|threads|reddit|discord|whatsapp|telegram|gmail|outlook|app store|photos|pinterest|roku|roku smart home|aidot|ai dot|home app|walmart|target|ebay|etsy|zillow|duolingo|chatgpt|capcut|shazam|soundcloud|pandora|twitch|kick|linkedin|signal|clock|calculator|files|wallet|weather app|music app|podcasts|books|news";
  var RE_APP = new RegExp("\\b(" + APPS + ")\\b|\\b[a-z0-9][\\w'&.+-]{1,20} app\\b", "i");
  var RE_OPEN_AND = /\b(open|launch|go to|go into|pull up)\s+(?:the |my )?\S+(?:\s\S+)?\s+(and|then)\b/i;
  var RE_DOING = /\b(search|look up|find|play|watch|put on|post|like|follow|unfollow|scroll|order|add|buy|book|turn on|turn off|enable|disable|switch|change|set|clear|delete|open|go to|check|show|send|reply|subscribe|save|download|upload|share|type|tap|click|start|stop|pause|skip|request|call me an?)\b/i;
  var RE_DIRECT = /\b(lights?|lamps?|bulbs?|alarm|timer|remind|reminder|thermostat|temperature inside|forecast|weather)\b/i;

  function looksLikeAppTask(text) {
    var t = String(text || "");
    if (t.length < 8 || /\?\s*$/.test(t) && !RE_OPEN_AND.test(t)) return false;
    if (RE_DIRECT.test(t) && !RE_APP.test(t.replace(RE_DIRECT, ""))) return false;
    if (/^(?:please )?(?:open|launch|go to|pull up|start)\s+(?:the |my )?[\w'&.+ -]{1,30}?(?: app)?[.!]?$/i.test(t.trim()) && !RE_OPEN_AND.test(t)) return false; // just opening an app: she does that herself
    if (RE_OPEN_AND.test(t)) return true;
    return RE_APP.test(t) && RE_DOING.test(t);
  }

  async function shouldUse(text) {
    if (!savedKey() || running) return false;
    if (!(await isRunning())) return false;
    try {
      var out = await root.FridayBrain.ask([
        { role: "system", content: "Answer with only YES or NO. YES if doing this request needs someone to operate another app's screen on the iPhone: open an app and then tap, type, search, scroll or change something inside it (for example: search for something on YouTube, play a song on Spotify, turn on Low Power Mode in Settings, check an order in Amazon). NO if it's a question or conversation, if it only opens an app with nothing to do inside it, or if it's something with its own direct command: home lights and devices, alarms, timers, reminders, the calendar, texts, calls, weather, notes, lists, or playing music from the Apple Music library." },
        { role: "user", content: String(text || "") }
      ], { purpose: "small", temperature: 0, max_tokens: 200, reasoning_effort: "low", noBackup: true });
      return /^\W*yes\b/i.test(String(out || ""));
    } catch (e) { return false; }
  }

  root.FridayRobot = {
    looksLikeAppTask: looksLikeAppTask, shouldUse: shouldUse,
    detect: detect, handle: handle, run: run, pair: pair, call: call,
    isRunning: isRunning, isPaired: function () { return !!savedKey(); },
    hasPending: function () { return !!pending; }, busy: function () { return !!running; }
  };
})(window);
