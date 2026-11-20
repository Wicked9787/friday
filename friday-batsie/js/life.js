/* Day-to-day helpers: lists, bills, countdowns, named timers, voice notes,
   directions, night mode, and the voice commands that drive them.
   Everything lives on this phone (localStorage) and goes into Backup. */
(function (root) {
  "use strict";

  var S = function () { return root.FridayStorage; };
  var MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  var MON3 = MONTHS.map(function (m) { return m.slice(0, 3); });
  var NUMWORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, "forty five": 45, fifty: 50, sixty: 60, ninety: 90, a: 1, an: 1, half: 0.5 };

  function uid() { return Math.random().toString(36).slice(2, 9); }
  function clean(t) { return String(t || "").trim().replace(/[.!?]+$/, "").trim(); }
  function cap(t) { t = String(t || ""); return t.charAt(0).toUpperCase() + t.slice(1); }
  function dayStart(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function daysBetween(a, b) { return Math.round((dayStart(b) - dayStart(a)) / 86400000); }
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function parseYmd(s) { var m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function monthKey(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
  function money(n) {
    n = Number(n) || 0;
    return "$" + n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }
  function spokenDays(n) {
    if (n === 0) return "today";
    if (n === 1) return "tomorrow";
    if (n === -1) return "yesterday";
    return n > 0 ? "in " + n + " days" : Math.abs(n) + " days ago";
  }
  function ordinal(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function niceDate(d) { return MONTHS[d.getMonth()].replace(/^./, function (c) { return c.toUpperCase(); }) + " " + ordinal(d.getDate()); }

  // ---------- dates ----------
  function nthWeekday(year, month, weekday, n) {
    var d = new Date(year, month, 1);
    var add = (weekday - d.getDay() + 7) % 7;
    return new Date(year, month, 1 + add + (n - 1) * 7);
  }
  function easter(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }
  var HOLIDAYS = [
    { re: /christmas eve/, f: function (y) { return new Date(y, 11, 24); }, name: "Christmas Eve" },
    { re: /christmas|xmas/, f: function (y) { return new Date(y, 11, 25); }, name: "Christmas" },
    { re: /new year'?s eve/, f: function (y) { return new Date(y, 11, 31); }, name: "New Year's Eve" },
    { re: /new year/, f: function (y) { return new Date(y, 0, 1); }, name: "New Year's Day" },
    { re: /valentine/, f: function (y) { return new Date(y, 1, 14); }, name: "Valentine's Day" },
    { re: /st\.? patrick|saint patrick/, f: function (y) { return new Date(y, 2, 17); }, name: "St. Patrick's Day" },
    { re: /easter/, f: easter, name: "Easter" },
    { re: /mother'?s day/, f: function (y) { return nthWeekday(y, 4, 0, 2); }, name: "Mother's Day" },
    { re: /father'?s day/, f: function (y) { return nthWeekday(y, 5, 0, 3); }, name: "Father's Day" },
    { re: /memorial day/, f: function (y) { var d = new Date(y, 5, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }, name: "Memorial Day" },
    { re: /(fourth|4th) of july|july (fourth|4th)|independence day/, f: function (y) { return new Date(y, 6, 4); }, name: "the Fourth of July" },
    { re: /labor day/, f: function (y) { return nthWeekday(y, 8, 1, 1); }, name: "Labor Day" },
    { re: /halloween/, f: function (y) { return new Date(y, 9, 31); }, name: "Halloween" },
    { re: /thanksgiving/, f: function (y) { return nthWeekday(y, 10, 4, 4); }, name: "Thanksgiving" }
  ];
  function nextOccurrence(fn) {
    var now = dayStart(new Date());
    var d = fn(now.getFullYear());
    if (d < now) d = fn(now.getFullYear() + 1);
    return d;
  }
  function holidayDate(text) {
    var t = String(text || "").toLowerCase();
    for (var i = 0; i < HOLIDAYS.length; i++) if (HOLIDAYS[i].re.test(t)) return { date: nextOccurrence(HOLIDAYS[i].f), name: HOLIDAYS[i].name };
    return null;
  }

  // Understands: "March 5", "5th of March", "3/5", "3/5/2027", "tomorrow", "next friday", "in 10 days", "the 15th".
  function parseDate(text) {
    var t = String(text || "").toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim();
    var now = dayStart(new Date()), m, d;
    if (/\btoday\b/.test(t)) return now;
    if (/\btomorrow\b/.test(t)) { d = new Date(now); d.setDate(d.getDate() + 1); return d; }
    m = t.match(/\bin (\d+|[a-z]+) (day|week|month)s?\b/);
    if (m) {
      var n = parseInt(m[1], 10); if (isNaN(n)) n = NUMWORDS[m[1]] || 0;
      d = new Date(now);
      if (m[2] === "day") d.setDate(d.getDate() + n);
      else if (m[2] === "week") d.setDate(d.getDate() + n * 7);
      else d.setMonth(d.getMonth() + n);
      return d;
    }
    var days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    m = t.match(/\b(next |this )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if (m) {
      var wd = days.indexOf(m[2]);
      d = new Date(now);
      var add = (wd - d.getDay() + 7) % 7;
      if (add === 0 || m[1] === "next ") add += add === 0 ? 7 : 0;
      d.setDate(d.getDate() + add);
      return d;
    }
    var mi = -1, day = 0, year = 0;
    m = t.match(new RegExp("\\b(" + MONTHS.join("|") + "|" + MON3.join("|") + ")\\.? (\\d{1,2})(?:st|nd|rd|th)?(?: (\\d{4}))?\\b"));
    if (m) { mi = MON3.indexOf(m[1].slice(0, 3)); day = +m[2]; year = m[3] ? +m[3] : 0; }
    if (mi < 0) {
      m = t.match(new RegExp("\\b(\\d{1,2})(?:st|nd|rd|th)? (?:of )?(" + MONTHS.join("|") + "|" + MON3.join("|") + ")(?: (\\d{4}))?\\b"));
      if (m) { mi = MON3.indexOf(m[2].slice(0, 3)); day = +m[1]; year = m[3] ? +m[3] : 0; }
    }
    if (mi < 0) {
      m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
      if (m) { mi = +m[1] - 1; day = +m[2]; year = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : 0; }
    }
    if (mi >= 0 && day >= 1 && day <= 31) {
      d = new Date(year || now.getFullYear(), mi, day);
      if (!year && d < now) d.setFullYear(d.getFullYear() + 1);
      return d;
    }
    m = t.match(/\bthe (\d{1,2})(?:st|nd|rd|th)\b/);
    if (m) {
      d = new Date(now.getFullYear(), now.getMonth(), +m[1]);
      if (d < now) d.setMonth(d.getMonth() + 1);
      return d;
    }
    return null;
  }

  // ---------- night mode ----------
  var FridayNight = {
    isNight: function () {
      var s = S().get("settings", {}) || {};
      if (!s.nightMode) return false;
      var h = new Date().getHours() + new Date().getMinutes() / 60;
      var from = s.nightFrom == null ? 22 : +s.nightFrom;
      var to = s.nightTo == null ? 7 : +s.nightTo;
      return from > to ? (h >= from || h < to) : (h >= from && h < to);
    }
  };

  // ---------- lists ----------
  function lists() {
    var l = S().get("lists", null);
    if (!l || typeof l !== "object" || Array.isArray(l)) l = { order: ["grocery", "to-do"], items: { grocery: [], "to-do": [] }, last: "grocery" };
    l.order = l.order || Object.keys(l.items || {});
    l.items = l.items || {};
    l.order.forEach(function (k) { if (!l.items[k]) l.items[k] = []; });
    return l;
  }
  function saveLists(l) { S().set("lists", l); fire("friday:lists"); }
  function listKey(name) {
    var n = String(name || "").toLowerCase().trim().replace(/^(my|the)\s+/, "").replace(/\s+list$/, "");
    if (/^(shopping|grocer(y|ies)|food|store)$/.test(n)) return "grocery";
    if (/^(to ?-?do|todo|tasks?|chores?)$/.test(n)) return "to-do";
    return n;
  }
  function splitItems(t) {
    return String(t || "").split(/\s*,\s*|\s+and\s+|\s*&\s*/i).map(function (x) { return clean(x).replace(/^(some|a|an|the)\s+/i, ""); }).filter(Boolean);
  }
  function addItems(name, items) {
    var l = lists(), k = listKey(name || l.last || "grocery");
    if (!l.items[k]) { l.items[k] = []; l.order.push(k); }
    var have = l.items[k].map(function (x) { return x.text.toLowerCase(); });
    var added = [];
    items.forEach(function (it) {
      if (!it) return;
      var i = have.indexOf(it.toLowerCase());
      if (i >= 0) { l.items[k][i].done = false; return; }
      l.items[k].push({ id: uid(), text: cap(it), done: false, at: new Date().toISOString() });
      added.push(it);
    });
    l.last = k;
    saveLists(l);
    return { key: k, added: added };
  }
  function findItem(l, text) {
    var t = String(text || "").toLowerCase().replace(/^(the|my)\s+/, "");
    var keys = [l.last].concat(l.order.filter(function (k) { return k !== l.last; }));
    for (var a = 0; a < keys.length; a++) {
      var arr = l.items[keys[a]] || [];
      for (var i = 0; i < arr.length; i++) {
        var x = arr[i].text.toLowerCase();
        if (x === t || x.indexOf(t) >= 0 || new RegExp("\\b" + x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(t)) return { key: keys[a], index: i };
      }
    }
    return null;
  }

  // ---------- bills ----------
  function bills() { var b = S().get("bills", []); return Array.isArray(b) ? b : []; }
  function saveBills(b) { S().set("bills", b); fire("friday:bills"); }
  function nextDue(bill, from) {
    from = dayStart(from || new Date());
    if (bill.repeat === "once" && bill.date) return parseYmd(bill.date);
    var day = Math.max(1, Math.min(31, +bill.day || 1));
    var d = new Date(from.getFullYear(), from.getMonth(), 1);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    var paid = (bill.paid || []).indexOf(monthKey(d)) >= 0;
    if (d < from || paid) {
      d = new Date(from.getFullYear(), from.getMonth() + 1, 1);
      last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last));
    }
    return d;
  }
  function billStatus(bill) {
    var d = nextDue(bill);
    var now = dayStart(new Date());
    var thisMonthDue = new Date(now.getFullYear(), now.getMonth(), Math.min(+bill.day || 1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()));
    var paidThisMonth = bill.repeat !== "once" && (bill.paid || []).indexOf(monthKey(now)) >= 0;
    var overdue = bill.repeat !== "once" && !paidThisMonth && thisMonthDue < now;
    if (bill.repeat === "once") overdue = !bill.done && d && d < now;
    return { due: overdue ? thisMonthDue : d, days: daysBetween(now, overdue ? thisMonthDue : d), paid: paidThisMonth || !!bill.done, overdue: overdue };
  }
  function findBill(text) {
    var t = String(text || "").toLowerCase().replace(/\b(the|my|bill|payment)\b/g, "").trim();
    var list = bills();
    for (var i = 0; i < list.length; i++) {
      var n = list[i].name.toLowerCase();
      if (t && (n === t || n.indexOf(t) >= 0 || t.indexOf(n) >= 0)) return i;
    }
    return -1;
  }
  function markPaid(i) {
    var list = bills(), b = list[i];
    if (!b) return;
    if (b.repeat === "once") b.done = true;
    else {
      var now = new Date();
      var st = billStatus(b);
      var key = st.overdue || st.days <= 20 ? monthKey(st.due) : monthKey(now);
      b.paid = (b.paid || []).filter(function (k) { return k !== key; }).concat([key]).slice(-24);
      b.paidAt = new Date().toISOString();
    }
    saveBills(list);
  }
  function monthTotal() {
    return bills().filter(function (b) { return b.repeat !== "once"; }).reduce(function (s, b) { return s + (Number(b.amount) || 0); }, 0);
  }

  // ---------- countdowns ----------
  function countdowns() { var c = S().get("countdowns", []); return Array.isArray(c) ? c : []; }
  function saveCountdowns(c) { S().set("countdowns", c); fire("friday:countdowns"); }
  function countdownDays(c) {
    var d = parseYmd(c.date);
    if (!d) return null;
    var n = daysBetween(new Date(), d);
    if (n < 0 && c.yearly) { d.setFullYear(d.getFullYear() + 1); n = daysBetween(new Date(), d); }
    return n;
  }

  // ---------- timers (several at once, survive closing the app) ----------
  var tickHandle = 0;
  function timers() { var t = S().get("timers", []); return Array.isArray(t) ? t.filter(function (x) { return x && x.end; }) : []; }
  function saveTimers(t) { S().set("timers", t); fire("friday:timers"); }
  function fmtLeft(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : String(m).padStart(2, "0")) + ":" + String(s).padStart(2, "0");
  }
  function spokenDuration(sec) {
    sec = Math.round(sec);
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60, out = [];
    if (h) out.push(h + (h === 1 ? " hour" : " hours"));
    if (m) out.push(m + (m === 1 ? " minute" : " minutes"));
    if (s && !h) out.push(s + (s === 1 ? " second" : " seconds"));
    return out.join(" and ") || "0 seconds";
  }
  function parseDuration(t) {
    t = String(t || "").toLowerCase().replace(/-/g, " ");
    var total = 0, found = false;
    var re = /(\d+(?:\.\d+)?|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty five|forty|fifty|sixty|ninety|half)\s*(?:and a half\s*)?(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/g, m;
    while ((m = re.exec(t))) {
      var n = parseFloat(m[1]); if (isNaN(n)) n = NUMWORDS[m[1]] || 0;
      if (/and a half/.test(m[0])) n += 0.5;
      var u = m[2];
      total += /^h/.test(u) ? n * 3600 : /^m/.test(u) ? n * 60 : n;
      found = true;
    }
    if (!found && /half an hour|half hour/.test(t)) { total = 1800; found = true; }
    return found ? Math.round(total) : 0;
  }

  function FridayLife(opts) {
    this.opts = opts || {};
    this.profile = opts.profile;
    this.onToast = opts.onToast || function () {};
    this.onTimerDone = opts.onTimerDone || function () {};
  }

  FridayLife.prototype.startTimer = function (seconds, name) {
    seconds = Math.max(1, Math.round(seconds));
    var list = timers();
    var label = clean(name || "") || (list.length ? "Timer " + (list.length + 1) : "Timer");
    var t = { id: uid(), name: cap(label), end: Date.now() + seconds * 1000, total: seconds };
    list.push(t);
    saveTimers(list);
    this.ensureTick();
    return t;
  };
  FridayLife.prototype.cancelTimer = function (id) {
    saveTimers(timers().filter(function (t) { return t.id !== id; }));
  };
  FridayLife.prototype.ensureTick = function () {
    var self = this;
    if (tickHandle) return;
    tickHandle = setInterval(function () {
      var list = timers(), now = Date.now(), left = [], fired = [];
      list.forEach(function (t) { (t.end <= now ? fired : left).push(t); });
      if (fired.length) {
        saveTimers(left);
        fired.forEach(function (t) { self.onTimerDone(t, now - t.end > 5000); });
      }
      fire("friday:tick");
      if (!left.length) { clearInterval(tickHandle); tickHandle = 0; }
    }, 250);
  };
  FridayLife.prototype.restore = function () { if (timers().length) this.ensureTick(); };

  // ---------- briefing extras ----------
  FridayLife.prototype.briefingBits = function (memory) {
    var bits = [];
    var due = bills().map(function (b) { return { b: b, s: billStatus(b) }; })
      .filter(function (x) { return !x.s.paid && x.s.days <= 3; })
      .sort(function (a, b) { return a.s.days - b.s.days; });
    if (due.length) {
      bits.push(due.slice(0, 3).map(function (x) {
        return "Your " + x.b.name + " bill" + (x.b.amount ? " of " + money(x.b.amount) : "") + (x.s.overdue ? " is overdue" : " is due " + spokenDays(x.s.days));
      }).join(". ") + ".");
    }
    var cds = countdowns().map(function (c) { return { c: c, n: countdownDays(c) }; })
      .filter(function (x) { return x.n != null && x.n >= 0 && x.n <= 7; })
      .sort(function (a, b) { return a.n - b.n; });
    if (cds.length) bits.push(cds.slice(0, 2).map(function (x) { return x.c.name + " is " + spokenDays(x.n); }).join(", and ") + ".");
    var bdays = [];
    (memory || []).forEach(function (m) {
      var txt = String(m.text || "");
      if (!/birthday|anniversary/i.test(txt)) return;
      var d = parseDate(txt);
      if (!d) return;
      var n = daysBetween(new Date(), d);
      if (n >= 0 && n <= 7) bdays.push({ txt: txt.replace(/\.$/, ""), n: n });
    });
    if (bdays.length) bits.push(bdays.slice(0, 2).map(function (x) { return "Heads up: " + x.txt + ", that's " + spokenDays(x.n); }).join(". ") + ".");
    var l = lists();
    var todo = (l.items["to-do"] || []).filter(function (x) { return !x.done; });
    if (todo.length) bits.push("You have " + todo.length + " thing" + (todo.length === 1 ? "" : "s") + " on your to-do list" + (todo.length <= 3 ? ": " + todo.map(function (x) { return x.text; }).join(", ") : "") + ".");
    var tl = timers();
    if (tl.length) bits.push(tl.length === 1 ? "Your " + tl[0].name.toLowerCase() + " timer has " + spokenDuration((tl[0].end - Date.now()) / 1000) + " left." : "You have " + tl.length + " timers running.");
    return bits;
  };

  // ---------- voice commands ----------
  /* Returns null if the words aren't for these tools; otherwise
     { say, panel, url, shortcut, photo } for the app to act on. */
  FridayLife.prototype.handle = function (text) {
    var raw = String(text || "").trim();
    var t = clean(raw).toLowerCase().replace(/^(hey |ok |okay )?(friday|jarvis)[, ]+/, "").replace(/^(please |can you |could you |would you )/, "");
    var m, self = this, name;
    if (!t) return null;

    // instant answers: time, date, math, conversions (no AI, no internet)
    var quick = instantAnswer(t);
    if (quick) return { say: quick, instant: true };

    // moods
    m = t.match(/^(?:switch to |go to |turn on |set |use )?(normal|focus|hype|calm|bedtime) mode$|^(?:back to normal|normal mode|regular mode)$/);
    if (m) {
      var mood = m[1] || "normal";
      var st = S().get("settings", {}) || {};
      st.mood = mood;
      S().set("settings", st);
      fire("friday:mood");
      var lines = { normal: "Back to normal.", focus: "Focus mode. I'll keep it short.", hype: "Hype mode! Let's go.", calm: "Calm mode. Nice and easy.", bedtime: "Bedtime mode. I'll keep it quiet." };
      return { say: lines[mood] };
    }

    // photo
    if (/^(what(?:'s| is) (this|that)( thing)?|what am i looking at|look at (this|that)|read (this|that)( for me)?|take a (photo|picture)( of (this|that))?|scan (this|that)|identify (this|that)|let me show you something|i want to show you something|can you see (this|that))$/.test(t)) {
      return { photo: true, question: raw, say: "Tap the camera button and show me." };
    }

    // notes
    m = t.match(/^(?:take a note|make a note|add a note|new note|note to self|write (?:this )?down|jot (?:this )?down|note)(?: that| saying|:)?\s+(.+)$/);
    if (m) {
      if (root.__fridayTools) root.__fridayTools.addNote(cap(m[1]));
      fire("friday:notes");
      return { say: "Noted." };
    }
    if (/^(read|what are|what's in|show) (me )?my notes$/.test(t)) {
      var notes = root.__fridayTools ? root.__fridayTools.notes() : [];
      if (!notes.length) return { say: "You don't have any notes yet.", panel: "notes" };
      return { say: "Your latest note" + (notes.length > 1 ? "s are: " : " is: ") + notes.slice(0, 3).map(function (n) { return n.text; }).join(". ") + ".", panel: "notes" };
    }

    // lists: add
    m = t.match(/^(?:add|put|throw)\s+(.+?)\s+(?:to|on|onto|in)\s+(?:my|the)?\s*([a-z' -]*?)\s*list$/);
    if (m) {
      var items = splitItems(m[1]);
      var res = addItems(m[2] || "", items);
      var nm = res.key === "to-do" ? "to-do list" : res.key + " list";
      return { say: res.added.length ? "Added " + joinWords(res.added) + " to your " + nm + "." : "That's already on your " + nm + ".", panelSoft: "lists" };
    }
    m = t.match(/^(?:we need|we're out of|we are out of|i'm out of|im out of|we're low on|i need to buy|i need to get|pick up)\s+(?:some\s+|more\s+)?(.+)$/);
    if (m && !/\b(help|to |a minute|break|ride|from|at the|you)\b/.test(m[1])) {
      var r2 = addItems("grocery", splitItems(m[1]));
      return { say: r2.added.length ? "Added " + joinWords(r2.added) + " to your grocery list." : "It's already on the list." };
    }
    // lists: read
    m = t.match(/^(?:what'?s|what is|read|read me|show me|tell me what'?s)\s+(?:on\s+)?(?:my|the)\s+([a-z' -]*?)\s*list$/);
    if (m) {
      var l = lists(), k = listKey(m[1] || l.last);
      if (!l.items[k]) return { say: "You don't have a " + k + " list yet." };
      var open = l.items[k].filter(function (x) { return !x.done; });
      var label = k === "to-do" ? "to-do list" : k + " list";
      l.last = k; saveLists(l);
      return { say: open.length ? "On your " + label + ": " + joinWords(open.map(function (x) { return x.text.toLowerCase(); })) + "." : "Your " + label + " is empty.", panel: "lists" };
    }
    // lists: check off / remove
    m = t.match(/^(?:check off|cross off|tick off|mark off|i got|got|remove|take off|delete)\s+(.+?)(?:\s+(?:from|off)\s+(?:my|the)\s+[a-z' -]*list)?$/);
    if (m && !/\b(bill|timer|alarm|note|memory|countdown)\b/.test(m[1])) {
      var l2 = lists(), hits = [];
      splitItems(m[1]).forEach(function (it) {
        var f = findItem(l2, it);
        if (!f) return;
        if (/^(remove|take off|delete)/.test(t)) l2.items[f.key].splice(f.index, 1);
        else { l2.items[f.key][f.index].done = true; l2.items[f.key][f.index].doneAt = new Date().toISOString(); }
        hits.push(it);
      });
      if (hits.length) { saveLists(l2); return { say: (/^(remove|take off|delete)/.test(t) ? "Removed " : "Checked off ") + joinWords(hits) + "." }; }
    }
    m = t.match(/^(?:clear|empty)\s+(?:my|the)\s+([a-z' -]*?)\s*list$/);
    if (m) {
      var l3 = lists(), k3 = listKey(m[1] || l3.last);
      if (l3.items[k3]) { l3.items[k3] = l3.items[k3].filter(function (x) { return !x.done; }).length && /done|checked/.test(t) ? l3.items[k3].filter(function (x) { return !x.done; }) : []; saveLists(l3); }
      return { say: "Cleared your " + (k3 === "to-do" ? "to-do" : k3) + " list." };
    }
    m = t.match(/^(?:make|create|start) (?:a |an )?(?:new )?list (?:called|named) (.+)$|^(?:make|create|start) (?:a |an )?(?:new )?(.+?) list$/);
    if (m) {
      var key = listKey(m[1] || m[2]), l4 = lists();
      if (!l4.items[key]) { l4.items[key] = []; l4.order.push(key); }
      l4.last = key; saveLists(l4);
      return { say: "Made a " + key + " list.", panel: "lists" };
    }

    // bills
    m = t.match(/^(?:add|new|track|remember)(?: a| my)? (?:bill|payment)(?: for| called)? (.+)$|^(?:add|track) (?:my |the )?(.+?) bill(.*)$/);
    if (m) {
      var body = (m[1] || ((m[2] || "") + " " + (m[3] || ""))).trim();
      var amt = (body.match(/\$\s?(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:dollars|bucks)/) || []);
      amt = amt[1] || amt[2] || (body.match(/\b(\d+(?:\.\d{1,2})?)\b(?!\s*(?:st|nd|rd|th)\b)/) || [])[1];
      var dayM = body.match(/(?:due|on)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?/);
      var once = /\bonce\b|one time/.test(body);
      var bname = m[2] ? m[2] : body.split(/\s+(?:for|of|at|due|on|is)\s+|\s+\$|\s+\d/)[0];
      bname = cap(String(bname).replace(/\b(my|the|a|bill|payment)\b/g, "").replace(/\s+/g, " ").trim()) || "Bill";
      var bl = bills();
      var bill = { id: uid(), name: bname, amount: amt ? +amt : 0, day: dayM ? +dayM[1] : new Date().getDate(), repeat: once ? "once" : "monthly", paid: [] };
      if (once) { var od = parseDate(body) || new Date(); bill.date = ymd(od); }
      bl.push(bill); saveBills(bl);
      return { say: "Added your " + bname + " bill" + (bill.amount ? " for " + money(bill.amount) : "") + (once ? ", due " + niceDate(parseYmd(bill.date)) : ", due on the " + ordinal(bill.day) + " each month") + ".", panelSoft: "money" };
    }
    m = t.match(/^i (?:just )?paid (?:the |my )?(.+?)(?: bill)?$|^(?:mark|set) (?:the |my )?(.+?)(?: bill)? (?:as )?paid$/);
    if (m) {
      var bi = findBill(m[1] || m[2]);
      if (bi >= 0) { var bn = bills()[bi].name; markPaid(bi); return { say: "Marked your " + bn + " bill as paid." }; }
    }
    if (/^(what bills|which bills|any bills|what do i owe|what'?s due|bills due|what bills are due|do i have (any )?bills)/.test(t)) {
      var up = bills().map(function (b) { return { b: b, s: billStatus(b) }; }).filter(function (x) { return !x.s.paid && x.s.days <= 10; }).sort(function (a, b) { return a.s.days - b.s.days; });
      if (!bills().length) return { say: "You haven't added any bills yet. Say something like, add my phone bill for 85 dollars due on the 28th.", panel: "money" };
      if (!up.length) return { say: "Nothing's due in the next ten days.", panel: "money" };
      return { say: up.slice(0, 4).map(function (x) { return x.b.name + (x.b.amount ? ", " + money(x.b.amount) : "") + (x.s.overdue ? ", overdue" : ", " + spokenDays(x.s.days)); }).join(". ") + ".", panel: "money" };
    }

    // countdowns
    m = t.match(/^(?:add|make|create|start|set)(?: a| up a)? countdown (?:for|to|until) (.+?)(?: on| for)? ((?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|\d{1,2}\/|next |this |in \d|tomorrow|the \d).*)$/);
    if (m) {
      var cd = parseDate(m[2]);
      if (cd) {
        var cl = countdowns();
        var cname = cap(m[1]);
        cl.push({ id: uid(), name: cname, date: ymd(cd), yearly: /birthday|anniversary/.test(m[1]) });
        saveCountdowns(cl);
        return { say: "Countdown set. " + cname + " is " + spokenDays(daysBetween(new Date(), cd)) + ".", panelSoft: "countdowns" };
      }
    }
    m = t.match(/^(?:add|make|create|start)(?: a)? countdown (?:for|to|until) (.+)$/);
    if (m) {
      var hol = holidayDate(m[1]);
      if (hol) {
        var cl2 = countdowns();
        cl2.push({ id: uid(), name: hol.name.replace(/^the /, "").replace(/^./, function (c) { return c.toUpperCase(); }), date: ymd(hol.date), yearly: true });
        saveCountdowns(cl2);
        return { say: hol.name.replace(/^./, function (c) { return c.toUpperCase(); }) + " is " + spokenDays(daysBetween(new Date(), hol.date)) + ". Added to your countdowns." };
      }
      return { say: "What date is " + m[1] + "? Say something like, add a countdown for the beach trip on March 5th." };
    }
    m = t.match(/^(?:how (?:many|long)(?: days| weeks)? (?:until|till|til|to|before)|how far (?:away )?is|when is|days (?:until|till|to)) (.+)$/);
    if (m) {
      var what = m[1].replace(/\b(it'?s|it is)\b/g, "").trim();
      var cdl = countdowns();
      for (var ci = 0; ci < cdl.length; ci++) {
        var cn = cdl[ci].name.toLowerCase();
        if (what.indexOf(cn) >= 0 || cn.indexOf(what.replace(/^(the|my) /, "")) >= 0) {
          var dd = countdownDays(cdl[ci]);
          if (dd != null) return { say: cdl[ci].name + " is " + (dd === 0 ? "today!" : spokenDays(dd) + ", on " + niceDate(parseYmd(cdl[ci].date)) + ".") };
        }
      }
      var h2 = holidayDate(what);
      if (h2) { var hn = daysBetween(new Date(), h2.date); return { say: (hn === 0 ? "It's " + h2.name + " today!" : h2.name.replace(/^./, function (c) { return c.toUpperCase(); }) + " is " + spokenDays(hn) + ", on " + niceDate(h2.date) + ".") }; }
      var pd = parseDate(what);
      if (pd && /how (many|long)/.test(t)) { var pn = daysBetween(new Date(), pd); return { say: niceDate(pd) + " is " + spokenDays(pn) + "." }; }
    }

    // timers
    m = t.match(/^(?:cancel|stop|delete|clear|end) (?:all |every )?(?:the |my )?(?:(.+?) )?timers?$/);
    if (m && /timer/.test(t)) {
      var tl = timers();
      if (!tl.length) return { say: "No timers are running." };
      if (/\ball\b|\bevery\b|timers$/.test(t) || !m[1]) {
        if (tl.length > 1 && m[1] && !/\ball\b/.test(t)) { /* named below */ } else { saveTimers([]); return { say: tl.length > 1 ? "Cancelled all your timers." : "Timer cancelled." }; }
      }
      name = String(m[1] || "").toLowerCase();
      var hit = tl.filter(function (x) { return x.name.toLowerCase().indexOf(name) >= 0; })[0];
      if (hit) { this.cancelTimer(hit.id); return { say: "Cancelled the " + hit.name.toLowerCase() + " timer." }; }
      return { say: "I couldn't find that timer." };
    }
    if (/^(how much time|how long)( is)? (is )?(left|remaining)|^how('?s| is) (my|the) .*timer|^time left|^check (my |the )?timers?$/.test(t)) {
      var tl2 = timers();
      if (!tl2.length) return { say: "No timers are running." };
      return { say: tl2.map(function (x) { return (tl2.length > 1 ? x.name + ": " : "") + spokenDuration((x.end - Date.now()) / 1000) + " left"; }).join(". ") + ".", panel: "timer" };
    }
    if (/\btimer\b/.test(t) && !/\b(alarm|cancel|stop)\b/.test(t)) {
      var secs = parseDuration(t);
      if (secs) {
        name = "";
        var nm1 = t.match(/(?:called|named|for (?:the|my)) ([a-z ]+?)(?: for| timer|$)/);
        var nm2 = t.match(/^(?:set |start |make |create )?(?:a |an |the |my )?([a-z]+(?: [a-z]+)?) timer\b/);
        if (nm1) name = nm1[1];
        else if (nm2 && !/^(\d|a|an|one|two|three|four|five|ten|minute|second|hour|new|quick)/.test(nm2[1]) && !/(minute|second|hour)/.test(nm2[1])) name = nm2[1];
        var timer = this.startTimer(secs, name);
        var s2 = S().get("settings", {}) || {};
        var hand = s2.iphoneTimers !== false && secs >= (+s2.iphoneTimerMin || 10) * 60;
        return {
          say: (timer.name !== "Timer" && !/^Timer \d/.test(timer.name) ? cap(timer.name) + " timer" : "Timer") + " set for " + spokenDuration(secs) + "." + (hand ? " I'm also setting it on your iPhone." : ""),
          panel: "timer",
          shortcut: hand ? "timer for " + Math.round(secs / 60) + " minutes" : null
        };
      }
    }

    // open a website
    m = clean(raw).match(/^(?:hey \w+[, ]+)?(?:please )?(?:open|go to|pull up|bring up|show me|visit|load)\s+(?:the\s+)?(?:website\s+|site\s+)?((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|co|gov|edu|us|tv|app|dev|ai|news|me|info|biz)(?:\/\S*)?)$/i);
    if (m) {
      var site = /^https?:\/\//i.test(m[1]) ? m[1] : "https://" + m[1];
      return { say: "Opening " + m[1].replace(/^https?:\/\//i, "").replace(/^www\./i, "") + ".", url: site };
    }

    // directions / places
    m = t.match(/^(?:give me |get me )?(?:directions|navigate|navigation|take me|drive me|route me|how do i get|show me the way) (?:to |back to )?(.+)$/);
    if (m) {
      var rawDest = clean(raw).match(/(?:directions|navigate|navigation|take me|drive me|route me|how do i get|show me the way) (?:to |back to )?(.+)$/i);
      if (rawDest && !/nearest|closest|near me|nearby/i.test(rawDest[1])) m[1] = rawDest[1];
      var dest = m[1].replace(/^(the )?nearest /, "");
      var near = /nearest|closest|near me|nearby/.test(m[1]);
      return { say: "Opening Maps" + (near ? " to the nearest " + dest.replace(/ near me$/, "") : " to " + m[1]) + ".", url: near ? "maps://?q=" + encodeURIComponent(dest.replace(/ near me$/, "")) : "maps://?daddr=" + encodeURIComponent(m[1]) + "&dirflg=d" };
    }
    m = t.match(/^(?:where(?:'s| is) the |find (?:me )?(?:a |an |the )?)(?:nearest |closest )?(.+?)(?: near me| nearby| around here| close by)?$/);
    if (m && (/nearest|closest|near me|nearby|around here|close by/.test(t)) ) {
      return { say: "Here's what's nearby.", url: "maps://?q=" + encodeURIComponent(m[1]) };
    }

    return null;
  };

  function fmtNum(n) {
    if (!isFinite(n)) return null;
    var r = Math.abs(n) >= 100 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100;
    return r.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  var UNITS = {
    mile: ["km", 1.609344, "kilometers"], miles: ["km", 1.609344, "kilometers"], km: ["mi", 0.621371, "miles"], kilometer: ["mi", 0.621371, "miles"], kilometers: ["mi", 0.621371, "miles"],
    pound: ["kg", 0.453592, "kilograms"], pounds: ["kg", 0.453592, "kilograms"], lb: ["kg", 0.453592, "kilograms"], lbs: ["kg", 0.453592, "kilograms"], kg: ["lb", 2.20462, "pounds"], kilogram: ["lb", 2.20462, "pounds"], kilograms: ["lb", 2.20462, "pounds"],
    inch: ["cm", 2.54, "centimeters"], inches: ["cm", 2.54, "centimeters"], cm: ["in", 0.393701, "inches"], centimeter: ["in", 0.393701, "inches"], centimeters: ["in", 0.393701, "inches"],
    foot: ["m", 0.3048, "meters"], feet: ["m", 0.3048, "meters"], meter: ["ft", 3.28084, "feet"], meters: ["ft", 3.28084, "feet"],
    ounce: ["g", 28.3495, "grams"], ounces: ["g", 28.3495, "grams"], oz: ["g", 28.3495, "grams"], gram: ["oz", 0.035274, "ounces"], grams: ["oz", 0.035274, "ounces"],
    gallon: ["l", 3.78541, "liters"], gallons: ["l", 3.78541, "liters"], liter: ["gal", 0.264172, "gallons"], liters: ["gal", 0.264172, "gallons"],
    cup: ["ml", 236.588, "milliliters"], cups: ["ml", 236.588, "milliliters"], tablespoon: ["ml", 14.7868, "milliliters"], tablespoons: ["ml", 14.7868, "milliliters"], teaspoon: ["ml", 4.92892, "milliliters"], teaspoons: ["ml", 4.92892, "milliliters"]
  };
  function instantAnswer(t) {
    var m, now = new Date();
    t = t.replace(/[?!]+$/, "").trim();
    if (/^(what time is it|what'?s the time|time is it|tell me the time|what time it is)( right now| now)?$/.test(t)) {
      return "It's " + now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + ".";
    }
    if (/^(what'?s|what is) (today'?s date|the date( today)?)$|^what day is (it|today)$|^what'?s today$/.test(t)) {
      return "It's " + now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) + ".";
    }
    // temperature
    m = t.match(/^(?:what'?s|what is|convert)?\s*(-?\d+(?:\.\d+)?)\s*(?:degrees\s*)?(f|fahrenheit|c|celsius)\s*(?:in|to)\s*(?:degrees\s*)?(f|fahrenheit|c|celsius)$/);
    if (m) {
      var v = parseFloat(m[1]), from = m[2][0], to = m[3][0];
      if (from !== to) { var out = from === "f" ? (v - 32) * 5 / 9 : v * 9 / 5 + 32; return m[1] + "° " + (from === "f" ? "Fahrenheit" : "Celsius") + " is " + fmtNum(out) + "° " + (to === "f" ? "Fahrenheit" : "Celsius") + "."; }
    }
    // units
    m = t.match(/^(?:how many \w+ (?:is|are|in)|what'?s|what is|convert)?\s*(\d+(?:\.\d+)?)\s*([a-z]+)\s*(?:in|to|into)\s*([a-z]+)$/);
    if (m && UNITS[m[2]]) {
      var u = UNITS[m[2]], val = parseFloat(m[1]) * u[1];
      return m[1] + " " + m[2] + " is about " + fmtNum(val) + " " + u[2] + ".";
    }
    // percent
    m = t.match(/^(?:what'?s|what is|calculate)?\s*(\d+(?:\.\d+)?)\s*(?:%|percent)\s*of\s*(\d+(?:\.\d+)?)$/);
    if (m) return m[1] + " percent of " + m[2] + " is " + fmtNum(parseFloat(m[1]) / 100 * parseFloat(m[2])) + ".";
    // tip
    m = t.match(/^(?:what'?s|what is|calculate)?\s*(?:a\s*)?(\d+(?:\.\d+)?)\s*(?:%|percent)\s*tip\s*on\s*\$?(\d+(?:\.\d+)?)(?:\s*dollars)?$/);
    if (m) { var tip = parseFloat(m[1]) / 100 * parseFloat(m[2]); return "A " + m[1] + " percent tip on $" + m[2] + " is $" + tip.toFixed(2) + ", so $" + (parseFloat(m[2]) + tip).toFixed(2) + " total."; }
    // square root
    m = t.match(/^(?:what'?s|what is)?\s*(?:the\s*)?square root of\s*(\d+(?:\.\d+)?)$/);
    if (m) return "The square root of " + m[1] + " is " + fmtNum(Math.sqrt(parseFloat(m[1]))) + ".";
    // basic math
    m = t.match(/^(?:what'?s|what is|calculate|how much is)?\s*(-?\d+(?:\.\d+)?)\s*(plus|\+|minus|-|times|x|\*|multiplied by|divided by|over|\/)\s*(-?\d+(?:\.\d+)?)$/);
    if (m) {
      var a = parseFloat(m[1]), b = parseFloat(m[3]), op = m[2], r;
      if (/plus|\+/.test(op)) r = a + b; else if (/minus|^-$/.test(op)) r = a - b; else if (/times|^x$|\*|multiplied/.test(op)) r = a * b; else { if (b === 0) return "You can't divide by zero."; r = a / b; }
      return m[1] + " " + (op === "+" ? "plus" : op === "-" ? "minus" : op === "*" || op === "x" ? "times" : op === "/" ? "divided by" : op) + " " + m[3] + " is " + fmtNum(r) + ".";
    }
    return null;
  }

  function joinWords(arr) {
    arr = arr.map(function (x) { return String(x); });
    if (arr.length <= 1) return arr.join("");
    return arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1];
  }
  function fire(name) { try { root.dispatchEvent(new CustomEvent(name)); } catch (e) {} }
  // Shared with extras.js (3.0): recap, routines and the charging display read these.
  root.FridayLifeData = {
    lists: function () { return lists(); }, bills: function () { return bills(); },
    billStatus: function (b) { return billStatus(b); }, countdowns: function () { return countdowns(); },
    countdownDays: function (c) { return countdownDays(c); }, timers: function () { return timers(); },
    money: function (n) { return money(n); }, spokenDays: function (n) { return spokenDays(n); },
    spokenDuration: function (s) { return spokenDuration(s); }, fmtLeft: function (s) { return fmtLeft(s); },
    ymd: function (d) { return ymd(d); }, monthKey: function (d) { return monthKey(d); }
  };

  // ---------- rendering for the panels ----------
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  FridayLife.prototype.renderLists = function (box) {
    var self = this, l = lists();
    box.innerHTML = "";
    var tabs = el("div", "life-tabs");
    l.order.forEach(function (k) {
      var open = (l.items[k] || []).filter(function (x) { return !x.done; }).length;
      var b = el("button", "life-tab" + (k === l.last ? " on" : ""), (k === "to-do" ? "To-do" : cap(k)) + (open ? " " + open : ""));
      b.type = "button";
      b.onclick = function () { var x = lists(); x.last = k; saveLists(x); self.renderLists(box); };
      tabs.appendChild(b);
    });
    var nb = el("button", "life-tab add", "+ New list");
    nb.type = "button";
    nb.onclick = function () {
      var row = box.querySelector(".life-newlist");
      if (row) { row.classList.toggle("hidden"); var i0 = row.querySelector("input"); if (i0) i0.focus(); }
    };
    tabs.appendChild(nb);
    box.appendChild(tabs);

    var nl = el("form", "life-newlist hidden");
    var ni = el("input"); ni.type = "text"; ni.placeholder = "List name, like Hardware";
    var nbtn = el("button", "btn", "Make list"); nbtn.type = "submit";
    nl.appendChild(ni); nl.appendChild(nbtn);
    nl.onsubmit = function (e) {
      e.preventDefault();
      var k = listKey(ni.value);
      if (!k) return;
      var x = lists();
      if (!x.items[k]) { x.items[k] = []; x.order.push(k); }
      x.last = k; saveLists(x); self.renderLists(box);
    };
    box.appendChild(nl);

    var key = l.last && l.items[l.last] ? l.last : l.order[0];
    var items = (l.items[key] || []).slice().sort(function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0); });
    var listEl = el("div", "life-list");
    if (!items.length) listEl.appendChild(el("p", "hint", "Nothing here yet. Add something below, or say “add milk and eggs to my " + (key === "to-do" ? "to-do" : key) + " list”."));
    items.forEach(function (it) {
      var row = el("div", "life-item" + (it.done ? " done" : ""));
      var cb = el("button", "life-check", it.done ? "✓" : "");
      cb.type = "button";
      cb.setAttribute("aria-label", it.done ? "Uncheck " + it.text : "Check off " + it.text);
      cb.onclick = function () {
        var x = lists(), arr = x.items[key] || [];
        arr.forEach(function (y) { if (y.id === it.id) { y.done = !y.done; y.doneAt = y.done ? new Date().toISOString() : null; } });
        saveLists(x); self.renderLists(box);
      };
      var tx = el("span", "life-text", it.text);
      var del = el("button", "life-del", "×");
      del.type = "button";
      del.setAttribute("aria-label", "Delete " + it.text);
      del.onclick = function () {
        var x = lists();
        x.items[key] = (x.items[key] || []).filter(function (y) { return y.id !== it.id; });
        saveLists(x); self.renderLists(box);
      };
      row.appendChild(cb); row.appendChild(tx); row.appendChild(del);
      listEl.appendChild(row);
    });
    box.appendChild(listEl);

    var f = el("form", "life-add");
    var inp = el("input"); inp.type = "text"; inp.placeholder = "Add an item"; inp.setAttribute("enterkeyhint", "done");
    var add = el("button", "btn gold", "Add"); add.type = "submit";
    f.appendChild(inp); f.appendChild(add);
    f.onsubmit = function (e) {
      e.preventDefault();
      var v = splitItems(inp.value);
      if (!v.length) return;
      addItems(key, v);
      self.renderLists(box);
      var again = box.querySelector(".life-add input"); if (again) again.focus();
    };
    box.appendChild(f);
    var foot = el("div", "life-foot");
    var clr = el("button", "btn", "Clear checked items"); clr.type = "button";
    clr.onclick = function () { var x = lists(); x.items[key] = (x.items[key] || []).filter(function (y) { return !y.done; }); saveLists(x); self.renderLists(box); };
    foot.appendChild(clr);
    if (key !== "grocery" && key !== "to-do") {
      var dl = el("button", "btn danger", "Delete this list"); dl.type = "button";
      dl.onclick = function () {
        if (!confirm("Delete the " + key + " list?")) return;
        var x = lists(); delete x.items[key]; x.order = x.order.filter(function (k) { return k !== key; }); x.last = x.order[0]; saveLists(x); self.renderLists(box);
      };
      foot.appendChild(dl);
    }
    box.appendChild(foot);
    box.appendChild(el("p", "hint", "Say “add bread to my grocery list”, “what's on my list”, “check off bread”, or “we're out of coffee”."));
  };

  FridayLife.prototype.renderBills = function (box) {
    var self = this;
    box.innerHTML = "";
    var list = bills().map(function (b, i) { return { b: b, i: i, s: billStatus(b) }; })
      .sort(function (a, b) { return (a.s.paid ? 1 : 0) - (b.s.paid ? 1 : 0) || a.s.days - b.s.days; });
    var head = el("div", "life-sum");
    head.appendChild(el("span", "", "Every month"));
    head.appendChild(el("b", "", money(monthTotal())));
    box.appendChild(head);
    if (!list.length) box.appendChild(el("p", "hint", "No bills yet. Add one below, or say “add my phone bill for 85 dollars due on the 28th”."));
    list.forEach(function (x) {
      var c = el("div", "life-bill" + (x.s.paid ? " paid" : "") + (x.s.overdue ? " overdue" : ""));
      var top = el("div", "life-bill-top");
      top.appendChild(el("b", "", x.b.name));
      top.appendChild(el("span", "life-amt", x.b.amount ? money(x.b.amount) : ""));
      c.appendChild(top);
      var sub = el("div", "sub", x.s.paid ? "Paid · next due " + niceDate(nextDue(x.b)) : (x.s.overdue ? "Overdue since " + niceDate(x.s.due) : "Due " + niceDate(x.s.due) + " · " + spokenDays(x.s.days)) + (x.b.repeat === "once" ? " · one time" : " · monthly"));
      if (!x.s.paid && x.s.days <= 3) { var tg = el("span", "life-tag", x.s.overdue ? "Overdue" : "Due soon"); sub.appendChild(tg); }
      c.appendChild(sub);
      var acts = el("div", "life-acts");
      var pay = el("button", "btn" + (x.s.paid ? "" : " gold"), x.s.paid ? "Undo paid" : "Mark paid"); pay.type = "button";
      pay.onclick = function () {
        var all = bills(), b = all[x.i];
        if (x.s.paid) {
          if (b.repeat === "once") b.done = false;
          else { var k = monthKey(new Date()); b.paid = (b.paid || []).filter(function (p) { return p !== k && p !== monthKey(x.s.due); }); }
          saveBills(all);
        } else markPaid(x.i);
        self.renderBills(box);
      };
      var del = el("button", "btn danger", "Remove"); del.type = "button";
      del.onclick = function () { if (!confirm("Remove the " + x.b.name + " bill?")) return; var all = bills(); all.splice(x.i, 1); saveBills(all); self.renderBills(box); };
      acts.appendChild(pay); acts.appendChild(del);
      c.appendChild(acts);
      box.appendChild(c);
    });
    var f = el("form", "life-billform");
    f.innerHTML = '<label class="field-label">Add a bill</label>' +
      '<input type="text" name="name" placeholder="Name, like Electric" required>' +
      '<div class="life-two"><input type="text" name="amount" inputmode="decimal" placeholder="Amount, like 142"><input type="text" name="day" inputmode="numeric" placeholder="Due day, like 22"></div>' +
      '<label class="hint life-once"><input type="checkbox" name="once"> One time, not monthly</label>' +
      '<button class="btn gold" type="submit">Add bill</button>';
    f.onsubmit = function (e) {
      e.preventDefault();
      var nm = f.elements.name.value.trim();
      if (!nm) return;
      var amount = parseFloat(String(f.elements.amount.value).replace(/[^\d.]/g, "")) || 0;
      var day = Math.max(1, Math.min(31, parseInt(f.elements.day.value, 10) || new Date().getDate()));
      var once = f.elements.once.checked;
      var b = { id: uid(), name: cap(nm), amount: amount, day: day, repeat: once ? "once" : "monthly", paid: [] };
      if (once) { var d = new Date(); d.setDate(day); if (d < dayStart(new Date())) d.setMonth(d.getMonth() + 1); b.date = ymd(d); }
      var all = bills(); all.push(b); saveBills(all);
      self.renderBills(box);
      self.onToast("Bill added.");
    };
    box.appendChild(f);
  };

  FridayLife.prototype.renderCountdowns = function (box) {
    var self = this;
    box.innerHTML = "";
    var list = countdowns().map(function (c) { return { c: c, n: countdownDays(c) }; }).sort(function (a, b) { return (a.n == null ? 9e9 : (a.n < 0 ? 9e8 - a.n : a.n)) - (b.n == null ? 9e9 : (b.n < 0 ? 9e8 - b.n : b.n)); });
    if (!list.length) box.appendChild(el("p", "hint", "No countdowns yet. Add one below, or say “add a countdown for the beach trip on March 5th”. Holidays work too: “how many days until Christmas”."));
    list.forEach(function (x) {
      var row = el("div", "life-cd");
      var left = el("div", "life-cd-name");
      left.appendChild(el("b", "", x.c.name));
      var d = parseYmd(x.c.date);
      if (x.c.yearly && x.n != null && d) { d = new Date(); d.setDate(d.getDate() + x.n); }
      left.appendChild(el("div", "sub", d ? niceDate(d) + (x.c.yearly ? " · every year" : "") : ""));
      var num = el("div", "life-cd-num");
      num.appendChild(el("b", "", x.n == null ? "?" : (x.n < 0 ? "Done" : String(x.n))));
      num.appendChild(el("span", "", x.n == null || x.n < 0 ? "" : (x.n === 1 ? "day" : "days")));
      var del = el("button", "life-del", "×"); del.type = "button"; del.setAttribute("aria-label", "Delete " + x.c.name);
      del.onclick = function () { saveCountdowns(countdowns().filter(function (y) { return y.id !== x.c.id; })); self.renderCountdowns(box); };
      row.appendChild(left); row.appendChild(num); row.appendChild(del);
      box.appendChild(row);
    });
    var f = el("form", "life-billform");
    f.innerHTML = '<label class="field-label">Add a countdown</label><input type="text" name="name" placeholder="What, like Beach trip" required>' +
      '<input type="date" name="date" required><label class="hint life-once"><input type="checkbox" name="yearly"> Every year (birthdays, anniversaries)</label><button class="btn gold" type="submit">Add countdown</button>';
    f.onsubmit = function (e) {
      e.preventDefault();
      var nm = f.elements.name.value.trim(), dt = f.elements.date.value;
      if (!nm || !/^\d{4}-\d{2}-\d{2}$/.test(dt)) { self.onToast("Add a name and a date."); return; }
      var all = countdowns(); all.push({ id: uid(), name: cap(nm), date: dt, yearly: f.elements.yearly.checked }); saveCountdowns(all);
      self.renderCountdowns(box);
    };
    box.appendChild(f);
    var quick = el("div", "life-quick");
    quick.appendChild(el("div", "sub", "Add a holiday"));
    ["Christmas", "New Year", "Valentine's Day", "Easter", "Halloween", "Thanksgiving"].forEach(function (h) {
      var b = el("button", "life-tab", h); b.type = "button";
      b.onclick = function () {
        var hd = holidayDate(h); if (!hd) return;
        var all = countdowns();
        if (all.some(function (c) { return c.name.toLowerCase() === hd.name.toLowerCase().replace(/^the /, ""); })) return;
        all.push({ id: uid(), name: cap(hd.name.replace(/^the /, "")), date: ymd(hd.date), yearly: true }); saveCountdowns(all); self.renderCountdowns(box);
      };
      quick.appendChild(b);
    });
    box.appendChild(quick);
  };

  FridayLife.prototype.renderTimers = function (box) {
    var self = this;
    var list = timers().sort(function (a, b) { return a.end - b.end; });
    var key = list.map(function (t) { return t.id; }).join(",");
    if (box._key !== key) {
      box._key = key;
      box.innerHTML = "";
      if (!list.length) box.appendChild(el("p", "hint", "No timers running. Start one below, or say “set a pasta timer for 10 minutes”. You can run several at once."));
      list.forEach(function (t) {
        var c = el("div", "life-timer");
        c.setAttribute("data-id", t.id);
        var top = el("div", "life-bill-top");
        top.appendChild(el("b", "", t.name));
        var x = el("button", "life-tag btnlike", "Cancel"); x.type = "button";
        x.onclick = function () { self.cancelTimer(t.id); self.renderTimers(box); };
        top.appendChild(x);
        c.appendChild(top);
        c.appendChild(el("div", "life-big", fmtLeft((t.end - Date.now()) / 1000)));
        var bar = el("div", "life-bar"); bar.appendChild(el("i"));
        c.appendChild(bar);
        box.appendChild(c);
      });
    }
    list.forEach(function (t) {
      var c = box.querySelector('[data-id="' + t.id + '"]');
      if (!c) return;
      var left = (t.end - Date.now()) / 1000;
      c.querySelector(".life-big").textContent = fmtLeft(left);
      var i = c.querySelector(".life-bar i");
      if (i) i.style.width = Math.max(0, Math.min(100, 100 * left / Math.max(1, t.total))) + "%";
    });
  };

  root.FridayLife = FridayLife;
  root.FridayNight = FridayNight;
  root.FridayDates = { parseDate: parseDate, holidayDate: holidayDate, daysBetween: daysBetween, spokenDays: spokenDays, parseDuration: parseDuration, spokenDuration: spokenDuration };
})(window);
