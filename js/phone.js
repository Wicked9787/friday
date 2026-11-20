/* Friday 3.1: phone jobs done inside the app when the iPhone allows it
   (reminders, calendar, battery, lights, scenes). Each handler returns null when
   it can't do the job here, and the app hands it to the Shortcut as before. */
(function (root) {
  "use strict";

  function N() { return root.FridayNative; }
  function cap(t) { t = String(t || "").trim(); return t.charAt(0).toUpperCase() + t.slice(1); }
  function norm(t) {
    return String(t || "").toLowerCase().replace(/[’]/g, "'").replace(/[!?]+$/g, "").replace(/\.$/, "")
      .replace(/^(hey |ok |okay )?(friday|jarvis)[, ]+/, "").replace(/^(please |can you |could you |would you )/, "").replace(/\s+/g, " ").trim();
  }
  var NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, "forty five": 45, fifty: 50, sixty: 60, ninety: 90 };
  // Use the words as they were said (keeps "Batsie" capitalized).
  function keepCase(title, raw) {
    var r = String(raw || ""), i = r.toLowerCase().indexOf(title.toLowerCase());
    return i >= 0 ? cap(r.slice(i, i + title.length)) : title;
  }
  function num(w) { var n = parseFloat(w); return isNaN(n) ? (NUM[String(w).trim()] || 0) : n; }

  /* "remind me to call mom tomorrow at 5pm" -> { date, rest: "remind me to call mom" }
     Understands: in 20 minutes / in an hour / in half an hour, at 5, at 5:30 pm, 7am, noon,
     midnight, tonight, this morning/afternoon/evening, today, tomorrow (morning...), weekdays,
     dates (March 5, 3/5, the 15th, next Friday, in 3 days). */
  function parseWhen(text, now) {
    now = now || new Date();
    var t = " " + String(text || "").toLowerCase().replace(/[’]/g, "'").replace(/,/g, " ").replace(/\s+/g, " ") + " ";
    var used = [], m, base = null, hh = null, mm = 0, rel = null, part = null;
    function cut(s) { used.push(s); t = t.replace(s, " "); }

    m = t.match(/ in (a|an|one|two|three|four|five|ten|fifteen|twenty|thirty|forty five|forty|fifty|sixty|ninety|\d+(?:\.\d+)?) (minute|min|hour|hr|day|week)s? /) || t.match(/ in (half) an (hour) /);
    if (m) {
      var n = m[1] === "half" ? 0.5 : num(m[1]);
      var unit = m[2].indexOf("min") === 0 ? 60000 : (m[2].indexOf("h") === 0 ? 3600000 : (m[2] === "day" ? 86400000 : 7 * 86400000));
      rel = new Date(now.getTime() + n * unit);
      cut(m[0]);
      if (unit >= 86400000) { base = new Date(rel); base.setHours(0, 0, 0, 0); rel = null; }
    }
    m = t.match(/ (?:at |by |around )?(noon|midday|midnight) /);
    if (m) { hh = m[1] === "midnight" ? 0 : 12; mm = 0; cut(m[0]); }
    if (hh === null) {
      m = t.match(/ (?:at |by |around )?(\d{1,2})(?::(\d{2}))? ?(a\.?m\.?|p\.?m\.?) /) || t.match(/ (?:at |by |around )(\d{1,2})(?::(\d{2}))?() /) || t.match(/ (?:at |by |around )?(\d{1,2}):(\d{2})() /);
      if (m) {
        hh = parseInt(m[1], 10); mm = m[2] ? parseInt(m[2], 10) : 0;
        var ap = (m[3] || "").replace(/\./g, "");
        if (ap === "pm" && hh < 12) hh += 12;
        if (ap === "am" && hh === 12) hh = 0;
        if (!ap && hh >= 1 && hh <= 6) hh += 12; // "at 5" means 5 PM
        if (!ap && hh >= 7 && hh <= 11 && /\b(dinner|supper|tonight|evening|night|party|movie|date|game)\b/.test(t)) hh += 12;
        if (hh > 23 || mm > 59) hh = null; else cut(m[0]);
      }
    }
    m = t.match(/ (tonight|this evening|this afternoon|this morning|tomorrow morning|tomorrow afternoon|tomorrow evening|tomorrow night|in the morning|in the evening|in the afternoon) /);
    if (m) {
      part = m[1];
      cut(m[0]);
      if (/tomorrow/.test(part)) { base = new Date(now); base.setHours(0, 0, 0, 0); base.setDate(base.getDate() + 1); }
      var ph = /morning/.test(part) ? 9 : /afternoon/.test(part) ? 15 : /evening/.test(part) ? 18 : 20;
      if (part === "in the morning" && now.getHours() >= 9) { base = new Date(now); base.setHours(0, 0, 0, 0); base.setDate(base.getDate() + 1); }
      if (hh === null) { hh = ph; mm = 0; }
      else if (hh < 12 && /afternoon|evening|night|tonight/.test(part)) hh += 12;
    }
    var dayWords0 = null;
    var dayWords = t.match(/ (today|tomorrow|(?:on |next |this )?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|(?:on )?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? \d{1,2}(?:st|nd|rd|th)?|(?:on )?the \d{1,2}(?:st|nd|rd|th)|(?:on )?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?) /);
    if (dayWords && root.FridayDates && root.FridayDates.parseDate) {
      var d = root.FridayDates.parseDate(dayWords[1].replace(/^on /, ""));
      if (d) { base = d; cut(dayWords[0]); }
    }
    m = t.match(/ (morning|afternoon|evening|night) /);
    if (m && (base || hh === null)) {
      cut(m[0]);
      var ph2 = m[1] === "morning" ? 9 : m[1] === "afternoon" ? 15 : m[1] === "evening" ? 18 : 20;
      if (hh === null) { hh = ph2; mm = 0; } else if (hh < 12 && m[1] !== "morning") hh += 12;
    }
    if (rel && !base && hh === null) return { date: rel, rest: t.trim(), used: used };
    if (!base && hh === null) return null;
    var out = new Date(base || now);
    if (!base) out = new Date(now);
    if (hh !== null) out.setHours(hh, mm, 0, 0);
    else out.setHours(9, 0, 0, 0);
    if (!base && hh !== null && out <= now) out.setDate(out.getDate() + 1);
    return { date: out, rest: t.trim(), used: used };
  }

  function clock(d) {
    var h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? "PM" : "AM";
    var hr = h % 12 || 12;
    return hr + (m ? ":" + String(m).padStart(2, "0") : "") + " " + ap;
  }
  function dayWord(d) {
    var a = new Date(); a.setHours(0, 0, 0, 0);
    var b = new Date(d); b.setHours(0, 0, 0, 0);
    var n = Math.round((b - a) / 86400000);
    if (n === 0) return "today";
    if (n === 1) return "tomorrow";
    var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    if (n > 1 && n < 7) return "on " + days[d.getDay()];
    return "on " + months[d.getMonth()] + " " + d.getDate();
  }
  function spokenWhen(d) { return dayWord(d) + " at " + clock(d); }
  function join(a) { return a.length < 2 ? (a[0] || "") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }

  // ---------- reminders ----------
  function parseReminder(raw) {
    var t = norm(raw);
    if (!/\bremind me\b|\breminder\b/.test(t)) return null;
    var w = parseWhen(t);
    var rest = w ? w.rest : t;
    rest = rest.replace(/\s+/g, " ").trim();
    var m = rest.match(/^(?:remind me|reminder|set (?:a |an )?reminder|add (?:a )?reminder|make (?:a )?reminder|create (?:a )?reminder)(?: for me)?(?: to| about| that| for)?\s*(.*)$/);
    if (!m) m = rest.match(/^(.*?)\s*(?:remind me|reminder)$/);
    var title = cap(String(m ? m[1] : rest).replace(/^(to|about|that|for)\s+/, "").replace(/\s+(to|at|on|by)$/, "").trim());
    if (!title) return null;
    return { title: keepCase(title, raw), date: w ? w.date : null };
  }

  // ---------- calendar ----------
  function parseCalendarQuery(raw) {
    var t = norm(raw);
    var m = t.match(/^(?:what'?s|what is|whats) (?:on )?(?:my )?(?:calendar|schedule)(?: for| on)? ?(today|tomorrow)?$|^(?:what do i have|do i have anything|anything on my calendar|what'?s on (?:today|tomorrow))(?: on)? ?(today|tomorrow)?(?: on my calendar)?$|^(?:my )?(?:calendar|schedule) (?:for )?(today|tomorrow)$|^what'?s (?:on )?(today|tomorrow)$/);
    if (!m) return null;
    var which = m[1] || m[2] || m[3] || m[4] || (/tomorrow/.test(t) ? "tomorrow" : "today");
    return { day: which };
  }
  function parseCalendarAdd(raw) {
    var t = norm(raw);
    if (!/\b(calendar|schedule|appointment|event)\b/.test(t)) return null;
    if (/^(what|do i|anything|my )/.test(t)) return null;
    var w = parseWhen(t);
    var rest = (w ? w.rest : t).replace(/\s+/g, " ").trim();
    var m = rest.match(/^(?:add|put|schedule|create|make|set up)(?: an?)?(?: event| appointment)?(?: called| for)? (.+?)(?: (?:to|on|in) (?:my |the )?calendar)?$/);
    if (!m) return null;
    var title = cap(m[1].replace(/^(an?|the) (event|appointment) (called |for )?/, "").replace(/ (to|on|in) (my |the )?calendar$/, "").trim());
    if (!title || /^(event|appointment|calendar)$/i.test(title)) return null;
    title = keepCase(title, raw);
    var date = w ? w.date : null;
    if (!date) { date = new Date(); date.setDate(date.getDate() + 1); date.setHours(9, 0, 0, 0); }
    return { title: title, date: date };
  }

  // ---------- lights and scenes ----------
  var ROOMS = "living room|family room|bedroom|master bedroom|guest room|kids room|kitchen|dining room|bathroom|office|hallway|hall|porch|garage|basement|den|nursery|patio|front door|back yard|backyard|outside|upstairs|downstairs|lamp";
  function parseLights(raw) {
    var t = norm(raw);
    if (!/\b(lights?|lamps?|brightness|dim|brighten)\b/.test(t)) return null;
    if (/\b(color|colour|red|blue|green|purple|pink|orange|yellow|warm white|cool white)\b/.test(t)) return null; // colors stay with the Shortcut
    var room = (t.match(new RegExp("\\b(" + ROOMS + ")\\b")) || [])[1] || null;
    var pct = t.match(/(\d{1,3})\s*(?:%|percent)/) || t.match(/\bto (\d{1,3})\b/);
    var b = pct ? Math.max(0, Math.min(100, parseInt(pct[1], 10))) : null;
    if (b != null) return { room: room, brightness: b };
    if (/\b(off)\b/.test(t)) return { room: room, on: false };
    if (/\bdim\b/.test(t)) return { room: room, brightness: 30 };
    if (/\b(brighten|full|all the way up|max)\b/.test(t)) return { room: room, brightness: 100 };
    if (/\bon\b/.test(t)) return { room: room, on: true };
    return null;
  }
  function parseScene(raw) {
    var t = norm(raw);
    if (/^good ?night$/.test(t)) return { name: "Good Night" };
    var m = t.match(/^(?:run|start|set|turn on|activate)(?: the| my)? (.+?) scene$/) || t.match(/^(?:run|start|set|activate)(?: the| my)? scene (.+)$/) || t.match(/^scene (.+)$/);
    return m ? { name: cap(m[1]) } : null;
  }

  /* Try to do a phone job here. Returns { say, tool } or null (use the Shortcut). */
  async function handle(raw, profile) {
    var nat = N();
    if (!nat || !nat.isApp()) return null;
    var t = norm(raw);
    if (!t) return null;

    if (/\bbattery\b/.test(t) && !/\b(remind|calendar)\b/.test(t)) {
      var b = await nat.battery();
      if (!b) return null;
      return { say: "Your battery is at " + b.level + " percent" + (b.charging ? " and charging." : "."), tool: "battery" };
    }

    var rq = parseReminder(raw);
    if (rq && nat.calendar.available()) {
      var due = rq.date || new Date(Date.now() + 3600000);
      var r = await nat.calendar.addReminder(rq.title, due);
      if (!r.ok) return null;
      return { say: "I'll remind you to " + rq.title.charAt(0).toLowerCase() + rq.title.slice(1) + (rq.date ? " " + spokenWhen(due) : " in an hour") + ".", tool: "reminders" };
    }

    var cq = parseCalendarQuery(raw);
    if (cq && nat.calendar.available()) {
      var from = new Date(); from.setHours(0, 0, 0, 0);
      if (cq.day === "tomorrow") from.setDate(from.getDate() + 1);
      var to = new Date(from); to.setDate(to.getDate() + 1);
      var ev = await nat.calendar.events(from, to);
      if (!ev) return null;
      if (!ev.length) return { say: "Nothing on your calendar " + cq.day + ".", tool: "calendar" };
      var items = ev.slice(0, 5).map(function (e) { return e.allDay ? e.title + " all day" : e.title + " at " + clock(e.start); });
      return { say: "You have " + ev.length + " thing" + (ev.length === 1 ? "" : "s") + " " + cq.day + ": " + join(items) + (ev.length > 5 ? ", and more." : "."), tool: "calendar" };
    }

    var ca = parseCalendarAdd(raw);
    if (ca && nat.calendar.available()) {
      var e2 = await nat.calendar.addEvent(ca.title, ca.date);
      if (!e2.ok) return null;
      return { say: "Added " + ca.title + " to your calendar " + spokenWhen(ca.date) + ".", tool: "calendar" };
    }

    var sc = parseScene(raw);
    if (sc && nat.home.available() && await nat.home.ready()) {
      var s2 = await nat.home.scene(sc.name);
      if (s2.ok) return { say: (/good night/i.test(sc.name) ? "Good night." : "Running " + (s2.scene || sc.name) + "."), tool: "home" };
      return null;
    }

    var li = parseLights(raw);
    if (li && nat.home.available() && await nat.home.ready()) {
      var res = await nat.home.setLights(li);
      if (!res.ok) return null;
      var where = li.room ? "The " + li.room + " lights" : "The lights";
      var line = li.brightness != null ? (li.brightness === 0 ? where + " are off." : where + " are at " + li.brightness + " percent.") : (li.on ? where + " are on." : where + " are off.");
      return { say: line, tool: "home" };
    }
    return null;
  }

  root.FridayPhone = {
    handle: handle,
    parseWhen: parseWhen,
    parseReminder: parseReminder,
    parseCalendarQuery: parseCalendarQuery,
    parseCalendarAdd: parseCalendarAdd,
    parseLights: parseLights,
    parseScene: parseScene,
    spokenWhen: spokenWhen
  };
})(window);
