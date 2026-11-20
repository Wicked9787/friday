/* Friday 3.0 extras: multi-task commands, routines, messages to your partner,
   spending log, habits, translator, nightly recap and the charging display.
   Everything here runs on the phone. Only the translator asks the AI. */
(function (root) {
  "use strict";

  function S() { return root.FridayStorage; }
  function D() { return root.FridayLifeData || {}; }
  function fire(n, detail) { try { root.dispatchEvent(new CustomEvent(n, { detail: detail })); } catch (e) {} }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function cap(t) { t = String(t || "").trim(); return t.charAt(0).toUpperCase() + t.slice(1); }
  function norm(t) {
    return String(t || "").toLowerCase().replace(/[’]/g, "'").replace(/[.!?]+$/g, "")
      .replace(/^(hey |ok |okay )?(friday|jarvis)[, ]+/, "")
      .replace(/^(please |can you |could you |would you )/, "").replace(/\s+/g, " ").trim();
  }
  function money(n) { return D().money ? D().money(n) : "$" + (Math.round(n * 100) / 100); }
  function ymd(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function settings() { return S().get("settings", {}) || {}; }
  function joinWords(a) { return a.length < 2 ? (a[0] || "") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }
  function esc(x) { return String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  var WORDNUM = { a: 1, an: 1, one: 1, another: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  function toNum(w) { if (w == null || w === "") return 1; var n = parseFloat(w); if (!isNaN(n)) return n; return WORDNUM[String(w).trim()] || 1; }

  // ---------- multi-task: "lights to 40%, add milk and set a timer for 10 minutes" ----------
  // Only splits where the next words start a new command, so "add milk and eggs" stays one task.
  var VERB = "(?:turn|set|add|put|remind|play|pause|resume|stop|skip|start|text|message|tell|let \\w+ know|call|facetime|open|launch|dim|brighten|cancel|remove|delete|take a note|make a note|note that|schedule|what's|whats|what is|what are|what time|what day|what date|where is|where's|who is|who's|when is|when's|is it|will it|how's|how is|how much|how many|how far|how long|check|read me|give me|show|mark|log|track|translate|run|i spent|i paid|i drank|i worked out|increase|decrease|raise|lower|change|switch|close|look up|search|navigate|get directions|send|enable|disable|bedside|charging mode|good night|good morning)";
  var SPLITS = [
    /\s*;\s*/,
    new RegExp("\\s*,?\\s+(?:and then|then|and also|after that)\\s+(?=" + VERB + "\\b)", "i"),
    new RegExp("\\s*,?\\s+(?:and|&)\\s+(?=" + VERB + "\\b)", "i"),
    new RegExp(",\\s+(?=" + VERB + "\\b)", "i")
  ];
  function splitCommands(text) {
    var raw = String(text || "").trim().replace(/[’]/g, "'");
    if (!raw) return [];
    if (/^(translate|how do (you|i) say|how would (you|i) say)\b/i.test(norm(raw))) return [raw];
    var parts = [raw];
    SPLITS.forEach(function (re) {
      var out = [];
      parts.forEach(function (p) { p.split(new RegExp(re.source, "gi")).forEach(function (x) { out.push(x); }); });
      parts = out;
    });
    var res = [];
    parts.forEach(function (p) {
      p = String(p || "").trim().replace(/^(and|then|also)\s+/i, "").replace(/[,;]+$/, "").trim();
      if (!p) return;
      if (res.length && p.split(/\s+/).length < 2) { res[res.length - 1] += " and " + p; return; }
      res.push(p);
    });
    return res.length ? res : [raw];
  }

  // ---------- routines ----------
  var DEFAULT_ROUTINES = [
    { id: "home", phrase: "I'm home", steps: [], builtin: "home" },
    { id: "leaving", phrase: "I'm leaving", steps: [], builtin: "leaving" },
    { id: "movie", phrase: "Movie time", steps: ["Set the lights to 20%", "Turn on the Apple TV", "Turn on do not disturb"] }
  ];
  function routines() {
    var r = S().get("routines", null);
    return Array.isArray(r) ? r : JSON.parse(JSON.stringify(DEFAULT_ROUTINES));
  }
  function saveRoutines(r) { S().set("routines", r); fire("friday:routines"); }
  var HOME_RE = /^(?:i'?m|i am|im) (?:back )?home(?: now)?$|^(?:i'?m|i am|im) back$|^home now$|^honey,? i'?m home$|^(?:i )?just got (?:back|home)$/;
  var LEAVE_RE = /^(?:i'?m|i am|im) (?:leaving|heading out|going out|off|out of here)(?: now)?$|^(?:leaving|heading out) now$|^see you later$/;
  function matchRoutine(text) {
    var t = norm(text).replace(/^(?:start|run|do|begin|activate) (?:the |my )?/, "").replace(/ routine$/, "");
    var list = routines();
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (r.builtin === "home" && HOME_RE.test(t)) return r;
      if (r.builtin === "leaving" && LEAVE_RE.test(t)) return r;
      var p = norm(r.phrase || "");
      if (p && (t === p || t === "it's " + p || t === "its " + p || t === p + " mode")) return r;
    }
    return null;
  }

  // ---------- messages to your partner (sent as a text, read out by their app) ----------
  function partnerCfg(profile) {
    var s = settings();
    var isB = profile && profile.id === "batsie";
    var names = String(s.partnerNames || (isB ? "Sky, Daddy" : "Batsie")).split(",").map(function (x) { return x.trim(); }).filter(Boolean);
    var mine = (profile && profile.assistantName) || "Friday";
    return {
      names: names,
      display: names[0] || "",
      contact: String(s.partnerContact || (isB ? "DADDY!!" : names[0]) || "").trim(),
      prefix: "From " + mine + ":",
      on: s.partnerMessages !== false
    };
  }
  function partnerMessage(text, profile) {
    var cfg = partnerCfg(profile);
    if (!cfg.on || !cfg.names.length || !cfg.contact) return null;
    var t = String(text || "").trim().replace(/[’]/g, "'").replace(/^(hey |ok |okay )?(friday|jarvis)[, ]+/i, "").replace(/^(please |can you |could you )/i, "");
    var N = "(" + cfg.names.map(esc).join("|") + ")";
    var pats = [
      new RegExp("^(?:tell|let) " + N + " know (?:that )?(.+)$", "i"),
      new RegExp("^tell " + N + " (?:that |to )?(.+)$", "i"),
      new RegExp("^(?:message|send) " + N + "(?: a message)?(?: saying| that says|:)?\\s+(.+)$", "i"),
      new RegExp("^send (?:a )?message to " + N + "(?: saying| that says|:)?\\s+(.+)$", "i")
    ];
    for (var i = 0; i < pats.length; i++) {
      var m = t.match(pats[i]);
      if (!m) continue;
      var body = cap(m[2].trim().replace(/[.!]+$/, ""));
      if (!body) return null;
      return { to: cfg.display, contact: cfg.contact, text: body, command: "text " + cfg.contact + " saying " + cfg.prefix + " " + body };
    }
    return null;
  }
  function parseQuery(q) {
    var out = {};
    String(q || "").split("&").forEach(function (kv) {
      var i = kv.indexOf("=");
      if (i < 0) return;
      try { out[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, " ")); } catch (e) {}
    });
    return out;
  }
  // friday://msg?text=From%20Jarvis%3A%20dinner's%20ready  ->  { action: "msg", text: "dinner's ready", app: "Jarvis" }
  function parseLink(url) {
    var m = String(url || "").match(/^([a-z][a-z0-9+.-]*):\/\/([a-z-]*)\/?(?:\?(.*))?$/i);
    if (!m) return null;
    var action = (m[2] || "").toLowerCase(), q = parseQuery(m[3]);
    if (action === "msg" || action === "message") {
      var txt = String(q.text || q.t || "").trim();
      var pm = txt.match(/^(?:💬\s*)?from (friday|jarvis)\s*:\s*/i);
      if (pm) txt = txt.slice(pm[0].length);
      // texts or emails handed over by an automation: friday://msg?kind=text&from=Mom&text=...
      var kind = String(q.kind || (pm ? "partner" : (q.from ? "text" : "partner"))).toLowerCase();
      return txt ? { action: "msg", text: txt.trim(), app: pm ? cap(pm[1].toLowerCase()) : "", from: String(q.from || "").trim(), kind: kind } : null;
    }
    return { action: action, query: q };
  }

  // ---------- spending log ----------
  function spending() { var x = S().get("spending", []); return Array.isArray(x) ? x : []; }
  function saveSpending(x) { S().set("spending", x.slice(-1000)); fire("friday:spending"); }
  function spendTotals() {
    var now = new Date(), list = spending(), today = ymd(now), mk = today.slice(0, 7);
    var wk = new Date(now); wk.setHours(0, 0, 0, 0); wk.setDate(wk.getDate() - ((wk.getDay() + 6) % 7));
    var lmk = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
    var t = { today: 0, week: 0, month: 0, lastMonth: 0 };
    list.forEach(function (e) {
      var d = new Date(e.at), k = ymd(d);
      if (k === today) t.today += e.amount;
      if (d >= wk) t.week += e.amount;
      if (k.slice(0, 7) === mk) t.month += e.amount;
      if (k.slice(0, 7) === lmk) t.lastMonth += e.amount;
    });
    return t;
  }
  function topSpending() {
    var mk = ymd().slice(0, 7), by = {};
    spending().forEach(function (e) { if (ymd(new Date(e.at)).slice(0, 7) === mk) { var k = e.what.toLowerCase(); by[k] = (by[k] || 0) + e.amount; } });
    return Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).slice(0, 3).map(function (k) { return k + " " + money(by[k]); });
  }
  var AMT = "\\$?\\s?(\\d+(?:[.,]\\d{1,2})?)(?:\\s?(?:dollars|bucks))?";
  function handleSpending(t) {
    var m = t.match(new RegExp("^(?:i )?(?:just )?(?:spent|paid|dropped) " + AMT + " (?:on|for|at) (.+)$")) ||
            t.match(new RegExp("^(?:log|add|track) (?:an? )?(?:expense|purchase)(?: of)? " + AMT + " (?:on|for|at) (.+)$")) ||
            t.match(new RegExp("^(?:log|add) " + AMT + " (?:for|on) (.+)$"));
    if (m) {
      var amt = Math.round(parseFloat(m[1].replace(",", ".")) * 100) / 100;
      var what = cap(m[2].replace(/^(the|a|an|some) /, ""));
      var list = spending();
      list.push({ id: uid(), amount: amt, what: what, at: new Date().toISOString() });
      saveSpending(list);
      return { say: "Logged " + money(amt) + " for " + what.toLowerCase() + ". That's " + money(spendTotals().month) + " this month.", tool: "spending" };
    }
    m = t.match(/^(?:how much (?:money )?(?:did|have) i spen[dt]|what (?:did|have) i spen[dt]|(?:show |what's |whats )?my spending|spending total)(?: so far)?(?: (today|this week|this month|last month))?(?: so far)?$/);
    if (m) {
      var per = m[1] || "this month", tt = spendTotals();
      var val = per === "today" ? tt.today : per === "this week" ? tt.week : per === "last month" ? tt.lastMonth : tt.month;
      var top = per === "this month" ? topSpending() : [];
      return { say: "You've spent " + money(val) + " " + per + "." + (top.length ? " The most went to " + joinWords(top) + "." : ""), panel: "money", tool: "spending" };
    }
    if (/^(?:undo|delete|remove|cancel) (?:the |my )?last (?:expense|purchase|spending)$/.test(t)) {
      var l2 = spending(), last = l2.pop();
      if (!last) return { say: "There's nothing in your spending log yet." };
      saveSpending(l2);
      return { say: "Removed " + money(last.amount) + " for " + last.what.toLowerCase() + ".", tool: "spending" };
    }
    return null;
  }

  // ---------- habits and water ----------
  function habits() {
    var h = S().get("habits", null);
    if (!h || !Array.isArray(h.list)) h = { list: [{ id: "water", name: "Water", goal: 8, unit: "glass" }], log: {} };
    if (!h.log || typeof h.log !== "object") h.log = {};
    return h;
  }
  function saveHabits(h) {
    var keys = Object.keys(h.log).sort();
    while (keys.length > 120) delete h.log[keys.shift()];
    S().set("habits", h);
    fire("friday:habits");
  }
  function hCount(h, id, day) { return ((h.log[day || ymd()] || {})[id]) || 0; }
  function addHabit(h, id, n) { var d = ymd(); h.log[d] = h.log[d] || {}; h.log[d][id] = Math.max(0, (h.log[d][id] || 0) + n); return h.log[d][id]; }
  function streak(h, hb) {
    var n = 0, d = new Date();
    if (hCount(h, hb.id, ymd(d)) < hb.goal) d.setDate(d.getDate() - 1);
    while (hCount(h, hb.id, ymd(d)) >= hb.goal && n < 400) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function units(u, n) { if (!u) return ""; return n === 1 ? u : (/(s|sh|ch|x)$/.test(u) ? u + "es" : u + "s"); }
  function findHabit(h, name) {
    name = norm(name).replace(/^(my|the|a) /, "");
    return h.list.filter(function (x) { var n = x.name.toLowerCase(); return n === name || n === name.replace(/s$/, "") || n + "s" === name; })[0] || null;
  }
  function habitLine(h, hb) {
    var c = hCount(h, hb.id), s = streak(h, hb);
    var tail = s > 1 ? ", " + s + " day streak" : "";
    if (hb.goal > 1) return hb.name + ": " + c + " of " + hb.goal + (hb.unit ? " " + units(hb.unit, hb.goal) : "") + tail;
    return hb.name + ": " + (c >= hb.goal ? "done" : "not yet") + tail;
  }
  var DID = [
    [/^(?:i )?(?:just )?(?:worked out|exercised|did my workout|went to the gym)(?: today)?$/, "Workout"],
    [/^(?:i )?(?:just )?meditated(?: today)?$/, "Meditation"],
    [/^(?:i )?(?:just )?(?:went for a walk|walked)(?: today)?$/, "Walk"],
    [/^(?:i )?(?:just )?(?:went for a run|ran)(?: today)?$/, "Run"],
    [/^(?:i )?(?:just )?stretched(?: today)?$/, "Stretching"],
    [/^(?:i )?(?:just )?journaled(?: today)?$/, "Journal"],
    [/^(?:i )?(?:just )?took my vitamins(?: today)?$/, "Vitamins"]
  ];
  function bump(h, hb, n) {
    var c = addHabit(h, hb.id, n);
    saveHabits(h);
    var s = streak(h, hb);
    if (hb.goal > 1) {
      return c >= hb.goal ? "That's " + c + " " + units(hb.unit, c) + ". You hit your " + hb.name.toLowerCase() + " goal today!" + (s > 1 ? " " + s + " days in a row." : "")
        : "Got it. That's " + c + " of " + hb.goal + (hb.unit ? " " + units(hb.unit, hb.goal) : "") + " today.";
    }
    return "Nice. " + hb.name + " done for today." + (s > 1 ? " That's " + s + " days in a row." : "");
  }
  function handleHabits(t) {
    var h = habits(), m, hb;
    m = t.match(/^(?:i )?(?:just )?(?:drank|had|finished|log|add|logged) (a|an|another|one|two|three|four|five|\d+)?\s*(?:more )?(?:glass(?:es)?|bottles?|cups?)?\s*(?:of )?water$/);
    if (m) {
      hb = findHabit(h, "water");
      if (!hb) { hb = { id: "water", name: "Water", goal: 8, unit: "glass" }; h.list.push(hb); }
      return { say: bump(h, hb, toNum(m[1])), tool: "habits" };
    }
    if (/^(?:how much water (?:have i had|did i drink|today|so far)(?: today)?|how'?s my water(?: today)?)$/.test(t)) {
      hb = findHabit(h, "water");
      if (!hb) return { say: "I'm not tracking water yet. Just tell me when you drink a glass." };
      return { say: "You've had " + hCount(h, hb.id) + " of " + hb.goal + " glasses today.", tool: "habits" };
    }
    m = t.match(/^(?:track|add) (?:a |the )?(?:new )?habit(?: called| named)? (.+?)(?: (\d+) times? a day)?$/) || t.match(/^start tracking (?:my )?(.+?)(?: (\d+) times? a day)?$/);
    if (m) {
      var name = cap(m[1].replace(/^(my|a|an|the) /, ""));
      if (findHabit(h, name)) return { say: "I'm already tracking " + name.toLowerCase() + "." };
      h.list.push({ id: uid(), name: name, goal: Math.max(1, parseInt(m[2], 10) || 1), unit: "" });
      saveHabits(h);
      return { say: "I'm tracking " + name.toLowerCase() + " now. Just tell me when you've done it.", panel: "habits", tool: "habits" };
    }
    m = t.match(/^(?:stop tracking|delete the habit|remove the habit) (?:my )?(.+?)(?: habit)?$/);
    if (m) {
      hb = findHabit(h, m[1]);
      if (!hb) return null;
      h.list = h.list.filter(function (x) { return x.id !== hb.id; });
      saveHabits(h);
      return { say: "I stopped tracking " + hb.name.toLowerCase() + ".", tool: "habits" };
    }
    for (var i = 0; i < DID.length; i++) {
      if (DID[i][0].test(t)) {
        hb = findHabit(h, DID[i][1]);
        if (!hb) { hb = { id: uid(), name: DID[i][1], goal: 1, unit: "" }; h.list.push(hb); }
        return { say: bump(h, hb, 1), tool: "habits" };
      }
    }
    m = t.match(/^(?:i )?(?:just )?(?:did|finished|completed|done with|logged|log) (?:my |the )?(.+?)(?: for today| today)?$/);
    if (m) {
      hb = findHabit(h, m[1]);
      if (hb) return { say: bump(h, hb, 1), tool: "habits" };
    }
    if (/^(?:my habits|how are my habits(?: doing)?|habit (?:check|streaks?|status)|how am i doing on my habits|show (?:me )?my habits)$/.test(t)) {
      if (!h.list.length) return { say: "You're not tracking any habits yet.", panel: "habits" };
      return { say: h.list.map(function (x) { return habitLine(h, x); }).join(". ") + ".", panel: "habits", tool: "habits" };
    }
    return null;
  }

  // ---------- translator ----------
  var LANGS = { spanish: "es-MX", french: "fr-FR", german: "de-DE", italian: "it-IT", portuguese: "pt-BR", japanese: "ja-JP", chinese: "zh-CN", mandarin: "zh-CN", cantonese: "zh-HK", korean: "ko-KR", arabic: "ar-SA", hindi: "hi-IN", russian: "ru-RU", vietnamese: "vi-VN", tagalog: "fil-PH", filipino: "fil-PH", polish: "pl-PL", dutch: "nl-NL", greek: "el-GR", turkish: "tr-TR", hebrew: "he-IL", swedish: "sv-SE", thai: "th-TH", indonesian: "id-ID", ukrainian: "uk-UA" };
  var LANG_RE = Object.keys(LANGS).join("|");
  var TR = [
    new RegExp("^(?:can you |please )?(?:translate|say) [\"“']?(.+?)[\"”']? (?:in|into|to) (" + LANG_RE + ")(?: for me)?$", "i"),
    new RegExp("^how (?:do|would|can) (?:you|i) say [\"“']?(.+?)[\"”']? in (" + LANG_RE + ")$", "i"),
    new RegExp("^what(?:'s| is) [\"“']?(.+?)[\"”']? in (" + LANG_RE + ")$", "i")
  ];
  function parseTranslate(text) {
    var t = String(text || "").trim().replace(/[’]/g, "'").replace(/^(hey |ok |okay )?(friday|jarvis)[, ]+/i, "").replace(/[?.!]+$/, "");
    var m = t.match(new RegExp("^translate (?:to|into) (" + LANG_RE + ")[:,]?\\s+(.+)$", "i"));
    if (m) return { text: m[2].trim(), language: cap(m[1].toLowerCase()), code: LANGS[m[1].toLowerCase()] };
    for (var i = 0; i < TR.length; i++) {
      m = t.match(TR[i]);
      if (m) return { text: m[1].trim(), language: cap(m[2].toLowerCase()), code: LANGS[m[2].toLowerCase()] };
    }
    return null;
  }

  // ---------- nightly recap ----------
  function recapBits() {
    var d = D(), today = ymd(), bits = [], tom = [];
    var l = d.lists ? d.lists() : null, done = 0;
    if (l && l.items) Object.keys(l.items).forEach(function (k) {
      (l.items[k] || []).forEach(function (it) { if (it.done && it.doneAt && ymd(new Date(it.doneAt)) === today) done++; });
    });
    if (done) bits.push("You checked off " + done + " thing" + (done === 1 ? "" : "s") + " today.");
    var bl = d.bills ? d.bills() : [];
    var paid = bl.filter(function (b) { return b.paidAt && ymd(new Date(b.paidAt)) === today; }).map(function (b) { return "your " + b.name + " bill"; });
    if (paid.length) bits.push("You paid " + joinWords(paid) + ".");
    var tt = spendTotals();
    if (tt.today > 0) bits.push("You spent " + money(tt.today) + " today, " + money(tt.month) + " so far this month.");
    var h = habits();
    var hl = h.list.map(function (hb) {
      var c = hCount(h, hb.id);
      if (!c) return null;
      return hb.goal > 1 ? hb.name.toLowerCase() + " " + c + " of " + hb.goal : hb.name.toLowerCase() + " done";
    }).filter(Boolean);
    if (hl.length) bits.push("Habits: " + hl.join(", ") + ".");
    var notes = root.__fridayTools ? root.__fridayTools.notes() : [];
    var nt = notes.filter(function (n) { return n && n.at && ymd(new Date(n.at)) === today; }).length;
    if (nt) bits.push("You made " + nt + " note" + (nt === 1 ? "" : "s") + ".");
    bl.forEach(function (b) {
      var s = d.billStatus ? d.billStatus(b) : null;
      if (s && !s.paid && (s.days === 0 || s.days === 1)) tom.push("your " + b.name + " bill is due " + (s.days === 0 ? "today" : "tomorrow"));
    });
    (d.countdowns ? d.countdowns() : []).forEach(function (c) { if (d.countdownDays && d.countdownDays(c) === 1) tom.push(c.name + " is tomorrow"); });
    var todo = l && l.items ? (l.items["to-do"] || []).filter(function (x) { return !x.done; }).length : 0;
    if (todo) tom.push(todo + " thing" + (todo === 1 ? " is" : "s are") + " still on your to-do list");
    return { today: bits, tomorrow: tom };
  }

  // ---------- 3.1: "text Mom I'm on my way" goes straight to the Shortcut (no AI step) ----------
  function textSend(text) {
    var raw = String(text || "").trim().replace(/[\u2019]/g, "'").replace(/^(hey |ok |okay )?(friday|jarvis)[, ]+/i, "").replace(/^(please |can you |could you )/i, "").replace(/[.!]+$/, "");
    if (/\b(draft|write|compose|reword|rewrite|help me)\b/i.test(raw)) return null;
    var m = raw.match(/^(?:send (?:a )?(?:text|message) to|text|message)\s+(.+)$/i);
    if (!m) return null;
    var rest = m[1], who = null, body = null;
    var sm = rest.match(/^(.+?)\s+(?:saying|that says|and say|to say)\s+(.+)$/i);
    var N = root.FridayNative, names = N ? N.contacts.names() : [];
    if (sm) { who = sm[1]; body = sm[2]; }
    else {
      var words = rest.split(/\s+/);
      if (names.length) {
        for (var k = Math.min(3, words.length - 1); k >= 1; k--) {
          var cand = words.slice(0, k).join(" ");
          if (N.contacts.resolve(cand.replace(/^(my|the)\s+/i, ""))) { who = cand; body = words.slice(k).join(" "); break; }
        }
      }
      if (!who && words.length >= 2) { who = words[0]; body = words.slice(1).join(" "); }
    }
    if (!who || !body) return null;
    who = who.replace(/^(my|the)\s+/i, "");
    var exact = names.length ? (N.contacts.resolve(who) || who) : who;
    return { to: exact, body: cap(body), command: "text " + exact + " saying " + cap(body) };
  }

  // ---------- one entry point for all of the above ----------
  /* Returns null, or { say, panel, tool, translate, routine, partner, recap, bedside } */
  function handle(text, profile) {
    var t = norm(text);
    if (!t) return null;
    var r;
    if (/^(?:start |turn on |open |go to |switch to )?(?:bedside|charging|nightstand|night stand|clock|standby|stand by) (?:mode|display|screen|clock)$/.test(t)) return { bedside: "open" };
    if (/^(?:exit|close|stop|leave|turn off|end) (?:the )?(?:bedside|charging|nightstand|night stand|clock|standby|stand by) (?:mode|display|screen|clock)$/.test(t)) return { bedside: "close" };
    if (/^(?:sync|update|refresh|load|import) (?:my |the )?contacts$/.test(t)) return { contacts: "sync" };
    if (/^(?:nightly recap|night recap|evening recap|recap(?: my day)?|(?:give me |run )?(?:my )?(?:nightly |daily )?recap|how was my day|wrap up (?:my|the) day|end of day recap)$/.test(t)) return { recap: true };
    var pm = partnerMessage(text, profile);
    if (pm) return { partner: pm };
    var ts = textSend(text);
    if (ts) return { textSend: ts };
    var tr = parseTranslate(text);
    if (tr) return { translate: tr };
    if ((r = handleSpending(t))) return r;
    if ((r = handleHabits(t))) return r;
    var rt = matchRoutine(text);
    if (rt) return { routine: rt };
    return null;
  }

  // ---------- panels ----------
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function renderSpending(box) {
    if (!box) return;
    box.innerHTML = "";
    var tt = spendTotals();
    box.appendChild(el("h2", "life-h2", "Spending"));
    var sum = el("div", "life-sum");
    sum.textContent = "Today " + money(tt.today) + " · This week " + money(tt.week) + " · This month " + money(tt.month);
    box.appendChild(sum);
    var list = spending().slice(-12).reverse();
    if (!list.length) box.appendChild(el("p", "hint", "Say “I spent $20 on gas” and she’ll keep a running total."));
    list.forEach(function (e) {
      var row = el("div", "life-item");
      var d = new Date(e.at);
      row.appendChild(el("span", "life-text", e.what + " · " + money(e.amount)));
      row.appendChild(el("span", "spend-date", (d.getMonth() + 1) + "/" + d.getDate()));
      var x = el("button", "life-del", "×");
      x.setAttribute("aria-label", "Delete");
      x.onclick = function () { saveSpending(spending().filter(function (y) { return y.id !== e.id; })); renderSpending(box); };
      row.appendChild(x);
      box.appendChild(row);
    });
  }

  function renderHabits(box) {
    if (!box) return;
    box.innerHTML = "";
    var h = habits();
    if (!h.list.length) box.appendChild(el("p", "hint", "Say “track a habit called reading” to add one."));
    h.list.forEach(function (hb) {
      var row = el("div", "habit-row");
      var c = hCount(h, hb.id);
      var left = el("div", "habit-main");
      left.appendChild(el("div", "habit-name", hb.name));
      var s = streak(h, hb);
      left.appendChild(el("div", "habit-sub", (hb.goal > 1 ? c + " of " + hb.goal + (hb.unit ? " " + units(hb.unit, hb.goal) : "") : (c >= 1 ? "Done today" : "Not yet today")) + (s > 1 ? " · " + s + " day streak" : "")));
      var bar = el("div", "habit-bar");
      var fill = el("div", "habit-fill");
      fill.style.width = Math.min(100, Math.round(100 * c / hb.goal)) + "%";
      bar.appendChild(fill);
      left.appendChild(bar);
      row.appendChild(left);
      var minus = el("button", "btn sm", "−"), plus = el("button", "btn gold sm", "+");
      minus.onclick = function () { var hh = habits(); addHabit(hh, hb.id, -1); saveHabits(hh); renderHabits(box); };
      plus.onclick = function () { var hh = habits(); addHabit(hh, hb.id, 1); saveHabits(hh); renderHabits(box); };
      row.appendChild(minus);
      row.appendChild(plus);
      box.appendChild(row);
    });
    box.appendChild(el("p", "hint", "Say “I drank a glass of water”, “I worked out”, or “I did my reading”. “Stop tracking reading” removes one."));
  }

  function renderRoutines(box) {
    if (!box) return;
    box.innerHTML = "";
    var list = routines();
    list.forEach(function (r, idx) {
      var card = el("div", "routine-card");
      var phrase = el("input");
      phrase.type = "text";
      phrase.value = r.phrase || "";
      phrase.placeholder = "What you say, like “movie time”";
      phrase.setAttribute("aria-label", "Routine phrase");
      if (r.builtin) { phrase.readOnly = true; phrase.className = "readonly"; }
      var steps = el("textarea");
      steps.value = (r.steps || []).join("\n");
      steps.placeholder = r.builtin === "home" ? "Optional, one per line, like: Set the lights to 70%" : r.builtin === "leaving" ? "Optional, one per line, like: Turn off the lights" : "One command per line";
      steps.setAttribute("aria-label", "Routine steps");
      var sub = el("div", "sub", r.builtin === "home" ? "She also welcomes you home." : r.builtin === "leaving" ? "She also gives you a weather heads-up if rain is likely." : "");
      function save() {
        var l = routines();
        l[idx].phrase = r.builtin ? l[idx].phrase : phrase.value.trim();
        l[idx].steps = steps.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
        saveRoutines(l);
      }
      phrase.onchange = save;
      steps.onchange = save;
      card.appendChild(phrase);
      card.appendChild(steps);
      if (sub.textContent) card.appendChild(sub);
      if (!r.builtin) {
        var del = el("button", "btn danger sm", "Delete");
        del.type = "button";
        del.onclick = function () { var l = routines(); l.splice(idx, 1); saveRoutines(l); renderRoutines(box); };
        card.appendChild(del);
      }
      box.appendChild(card);
    });
    var add = el("button", "btn gold", "Add a routine");
    add.type = "button";
    add.onclick = function () { var l = routines(); l.push({ id: uid(), phrase: "", steps: [] }); saveRoutines(l); renderRoutines(box); };
    box.appendChild(add);
  }

  // ---------- charging display ----------
  function Bedside(opts) {
    this.opts = opts || {};
    this.on = false;
    this.el = null;
    this._dimT = 0;
    this._tick = 0;
    this._lock = null;
    this._drift = 0;
  }
  Bedside.prototype._build = function () {
    if (this.el) return;
    var self = this;
    var root_ = el("div", "bedside");
    root_.id = "bedside";
    root_.setAttribute("aria-label", "Charging display");
    var exit = el("button", "bedside-exit", "✕");
    exit.setAttribute("aria-label", "Exit charging display");
    exit.onclick = function (e) { e.stopPropagation(); self.close(); };
    var clock = el("div", "bedside-clock");
    clock.appendChild(el("div", "bs-time"));
    clock.appendChild(el("div", "bs-date"));
    var info = el("div", "bedside-info");
    info.appendChild(el("div", "bs-wx"));
    info.appendChild(el("div", "bs-next"));
    info.appendChild(el("div", "bs-msg"));
    info.appendChild(el("div", "bs-cap"));
    var faint = el("div", "bedside-faint");
    faint.appendChild(el("div", "bs-ftime"));
    root_.appendChild(exit);
    root_.appendChild(clock);
    root_.appendChild(info);
    root_.appendChild(faint);
    root_.addEventListener("click", function (e) {
      if (root_.classList.contains("dim")) { self.wake(); return; }
      if (e.target.closest(".bedside-clock") || e.target.closest(".bedside-info")) { self.wake(); return; }
      if (self.opts.onTalk) self.opts.onTalk();
      self.wake();
    });
    document.body.appendChild(root_);
    this.el = root_;
  };
  Bedside.prototype._render = function () {
    if (!this.el) return;
    var now = new Date();
    var h = now.getHours() % 12 || 12, m = String(now.getMinutes()).padStart(2, "0");
    var time = h + ":" + m;
    var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    this.el.querySelector(".bs-time").textContent = time;
    this.el.querySelector(".bs-ftime").textContent = time;
    this.el.querySelector(".bs-date").textContent = days[now.getDay()] + ", " + months[now.getMonth()] + " " + now.getDate();
    var wx = this.opts.weather ? this.opts.weather() : "";
    this.el.querySelector(".bs-wx").textContent = wx || "";
    this.el.querySelector(".bs-next").textContent = this._next();
    // keep the faint clock moving a little so nothing burns into the screen
    if (now.getSeconds() === 0 || !this._drift) {
      this._drift = 1;
      var f = this.el.querySelector(".bedside-faint");
      f.style.transform = "translate(" + Math.round(Math.random() * 40 - 20) + "px," + Math.round(Math.random() * 120 - 60) + "px)";
    }
  };
  Bedside.prototype._next = function () {
    var d = D(), out = [];
    var tl = d.timers ? d.timers() : [];
    if (tl.length) {
      var t = tl.slice().sort(function (a, b) { return a.end - b.end; })[0];
      out.push("⏱ " + t.name + " " + (d.fmtLeft ? d.fmtLeft(Math.max(0, (t.end - Date.now()) / 1000)) : ""));
    }
    var bl = (d.bills ? d.bills() : []).map(function (b) { return { b: b, s: d.billStatus(b) }; }).filter(function (x) { return !x.s.paid && x.s.days >= 0 && x.s.days <= 3; }).sort(function (a, b) { return a.s.days - b.s.days; });
    if (bl.length) out.push(bl[0].b.name + " bill due " + (d.spokenDays ? d.spokenDays(bl[0].s.days) : ""));
    var cds = (d.countdowns ? d.countdowns() : []).map(function (c) { return { c: c, n: d.countdownDays(c) }; }).filter(function (x) { return x.n != null && x.n >= 0; }).sort(function (a, b) { return a.n - b.n; });
    if (cds.length) out.push(cds[0].c.name + " " + (d.spokenDays ? d.spokenDays(cds[0].n) : ""));
    return out.slice(0, 2).join("  ·  ");
  };
  Bedside.prototype.open = function () {
    this._build();
    if (this.on) { this.wake(); return; }
    this.on = true;
    document.body.classList.add("bedside-on");
    this.el.classList.add("on");
    var self = this;
    this._render();
    this._tick = setInterval(function () { self._render(); }, 1000);
    this._keepAwake();
    this._onVis = function () { if (document.visibilityState === "visible" && self.on) self._keepAwake(); };
    document.addEventListener("visibilitychange", this._onVis);
    this.wake();
    fire("friday:bedside", { on: true });
  };
  Bedside.prototype.close = function () {
    if (!this.on) return;
    this.on = false;
    clearInterval(this._tick);
    clearTimeout(this._dimT);
    document.body.classList.remove("bedside-on");
    if (this.el) this.el.classList.remove("on", "dim");
    if (this._onVis) document.removeEventListener("visibilitychange", this._onVis);
    try { if (this._lock) this._lock.release(); } catch (e) {}
    this._lock = null;
    if (this.opts.onWake) this.opts.onWake();
    fire("friday:bedside", { on: false });
  };
  Bedside.prototype.wake = function (ms) {
    if (!this.on) return;
    var self = this;
    this.el.classList.remove("dim");
    if (this.opts.onWake) this.opts.onWake();
    clearTimeout(this._dimT);
    this._dimT = setTimeout(function () { self.dim(); }, ms || 30000);
  };
  Bedside.prototype.dim = function () {
    if (!this.on) return;
    var self = this;
    if (this.opts.busy && this.opts.busy()) { this._dimT = setTimeout(function () { self.dim(); }, 5000); return; }
    this.el.classList.add("dim");
    if (this.opts.onDim) this.opts.onDim();
  };
  Bedside.prototype.message = function (from, text) {
    if (!this.el) return;
    this.el.querySelector(".bs-msg").textContent = (from ? from + ": " : "") + text;
    this.wake(60000);
  };
  Bedside.prototype.caption = function (text) {
    if (!this.el) return;
    var c = this.el.querySelector(".bs-cap");
    c.textContent = text && text !== "Tap to talk" ? text : "";
  };
  Bedside.prototype._keepAwake = function () {
    var self = this;
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request("screen").then(function (l) { self._lock = l; }, function () {});
      }
    } catch (e) {}
  };

  root.FridayExtras = {
    splitCommands: splitCommands,
    handle: handle,
    routines: routines,
    saveRoutines: saveRoutines,
    matchRoutine: matchRoutine,
    partnerMessage: partnerMessage,
    partnerCfg: partnerCfg,
    parseLink: parseLink,
    parseTranslate: parseTranslate,
    spending: spending,
    spendTotals: spendTotals,
    habits: habits,
    recapBits: recapBits,
    renderSpending: renderSpending,
    renderHabits: renderHabits,
    renderRoutines: renderRoutines,
    Bedside: Bedside,
    LANGS: LANGS
  };
})(window);
