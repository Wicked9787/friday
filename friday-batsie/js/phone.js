/* Friday 3.1: phone jobs done inside the app when the iPhone allows it
   (reminders, calendar, battery, lights, scenes). Each handler returns null when
   it can't do the job here, and the app hands it to the Shortcut as before. */
(function (root) {
  "use strict";

  function N() { return root.FridayNative; }
  function cap(t) { t = String(t || "").trim(); return t.charAt(0).toUpperCase() + t.slice(1); }
  function norm(t) {
    return String(t || "").toLowerCase().replace(/[’]/g, "'").replace(/[!?]+$/g, "").replace(/\.$/, "")
      .replace(/^(hey |ok |okay )?(friday|jarvis|reed)[, ]+/, "").replace(/^(please |can you |could you |would you )/, "").replace(/\s+/g, " ").trim();
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
  // Colors she can set on AiDot lights. White shades are color temperature (kelvin).
  var COLORS = {
    red: [255, 0, 0], orange: [255, 110, 0], yellow: [255, 200, 0], gold: [255, 170, 20], green: [0, 255, 40],
    lime: [150, 255, 0], teal: [0, 200, 170], cyan: [0, 220, 255], aqua: [0, 220, 255], blue: [0, 60, 255],
    "light blue": [90, 170, 255], "sky blue": [90, 170, 255], navy: [0, 20, 160], purple: [150, 0, 255],
    violet: [130, 40, 255], lavender: [180, 140, 255], magenta: [255, 0, 200], pink: [255, 70, 160],
    "hot pink": [255, 20, 140], rose: [255, 60, 110], peach: [255, 150, 90], coral: [255, 100, 70], amber: [255, 140, 0]
  };
  var WHITES = { "warm white": 2700, "soft white": 2700, "warm": 2700, "candle": 2200, "candlelight": 2200, "neutral white": 4000, "white": 4000, "natural white": 4000, "cool white": 5500, "cool": 5500, "bright white": 5000, "daylight": 6500, "day light": 6500 };
  function colorIn(t) {
    var names = Object.keys(COLORS).sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < names.length; i++) if (new RegExp("\\b" + names[i] + "\\b").test(t)) return { name: names[i], rgb: COLORS[names[i]].slice() };
    var whites = Object.keys(WHITES).sort(function (a, b) { return b.length - a.length; });
    for (var j = 0; j < whites.length; j++) if (new RegExp("\\b" + whites[j] + "\\b").test(t)) return { name: whites[j] === "warm" ? "warm white" : whites[j] === "cool" ? "cool white" : whites[j], cct: WHITES[whites[j]] };
    var k = t.match(/\b(\d{4})\s*k(?:elvin)?\b/);
    if (k) return { name: k[1] + " kelvin", cct: parseInt(k[1], 10) };
    return null;
  }
  function parseLights(raw) {
    var t = norm(raw);
    // "turn all on", "turn everything off", "all on", "everything off" mean the lights
    if (/^(turn |switch )?(all|everything)( of (them|it))?( the way)? (on|off)$|^(turn |switch )(on|off) (all|everything)$|^(all|everything) (on|off)$/.test(t)) t = t + " lights";
    if (!/\b(lights?|lamps?|bulbs?|brightness|dim|brighten)\b/.test(t)) return null;
    if (/^(are|is|were)\b|\?$/.test(t)) return null; // questions are handled by parseLightQuestion
    var room = (t.match(new RegExp("\\b(" + ROOMS + ")\\b")) || [])[1] || null;
    var out = { room: room, words: t };
    var color = colorIn(t.replace(/\bwarm(er)? up\b/, ""));
    if (color) out.color = color;
    var pct = t.match(/(\d{1,3})\s*(?:%|percent)/) || t.match(/\bto (\d{1,3})\b(?!\s*k\b)/);
    var b = pct ? Math.max(0, Math.min(100, parseInt(pct[1], 10))) : null;
    if (b != null) { out.brightness = b; return out; }
    if (/\b(off)\b/.test(t)) { out.on = false; delete out.color; return out; }
    if (/\bdim\b/.test(t)) { out.brightness = 30; return out; }
    if (/\b(brighten|full|all the way up|max)\b/.test(t)) { out.brightness = 100; return out; }
    if (/\bon\b/.test(t) || color) { out.on = true; return out; }
    return null;
  }
  // "are the lights on?", "is the bedroom lamp on"
  function parseLightQuestion(raw) {
    var t = norm(raw);
    if (!/^(are|is)\b/.test(t) || !/\b(lights?|lamps?|bulbs?)\b/.test(t) || !/\b(on|off)\b/.test(t)) return null;
    return { words: t };
  }

  // Which AiDot lights the words mean. Returns { ids, list, all } or null (not one of hers).
  var LIGHT_STOP = "turn switch set make put get the my a an on off light lights please to at percent all everything of in up down dim dimmer brighten brighter brightness bright full max way color colour and them it its can you could would hey friday jarvis now for me again back too also just quick little bit some more less lower higher half is are were k kelvin white warm cool soft neutral natural daylight day candle candlelight bulb bulbs".split(" ");
  function lightWords(s) {
    return String(s || "").toLowerCase().replace(/[’']s\b/g, "").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean).map(function (w) {
      return w.length > 3 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w;
    });
  }
  function pickAidot(words, lights) {
    lights = lights || [];
    if (!lights.length) return null;
    var colorWords = Object.keys(COLORS).join(" ").split(" ");
    var asked = lightWords(words).filter(function (w) { return LIGHT_STOP.indexOf(w) < 0 && colorWords.indexOf(w) < 0 && !/^\d+k?$/.test(w); });
    if (!asked.length) return { ids: [], list: lights, all: true };
    var best = 0, scored = lights.map(function (d) {
      var own = lightWords((d.name || "") + " " + (d.room || ""));
      var s = 0;
      asked.forEach(function (w) { if (own.indexOf(w) >= 0) s++; });
      var nm = lightWords(d.name).join(" ");
      if (nm && (" " + lightWords(words).join(" ") + " ").indexOf(" " + nm + " ") >= 0) s += 5;
      if (s > best) best = s;
      return { d: d, s: s };
    });
    if (!best) return null;
    var list = scored.filter(function (x) { return x.s === best; }).map(function (x) { return x.d; });
    return { ids: list.map(function (d) { return d.id; }), list: list, all: list.length === lights.length && lights.length > 1 };
  }
  function lightLabel(pick, li) {
    if (pick.all || !pick.list.length) return { text: li && li.room ? "The " + li.room + " lights" : "The lights", many: true };
    if (pick.list.length === 1) return { text: pick.list[0].name || "The light", many: false };
    var rm = li && li.room ? lightWords(li.room).join(" ") : "";
    var allInRoom = rm && pick.list.every(function (d) { return (" " + lightWords((d.name || "") + " " + (d.room || "")).join(" ") + " ").indexOf(" " + rm + " ") >= 0; });
    if (allInRoom) return { text: "The " + li.room + " lights", many: true };
    if (pick.list.length > 3) return { text: pick.list.length + " lights", many: true };
    return { text: join(pick.list.map(function (d) { return d.name; })), many: true };
  }
  function lightLine(label, li) {
    var be = label.many ? " are " : " is ";
    if (li.color && li.brightness != null && li.brightness > 0) return label.text + be + li.color.name + " at " + li.brightness + " percent.";
    if (li.color) return label.text + be + "now " + li.color.name + ".";
    if (li.brightness != null) return li.brightness === 0 ? label.text + be + "off." : label.text + be + "at " + li.brightness + " percent.";
    return label.text + be + (li.on ? "on." : "off.");
  }
  function aidotOpts(li) {
    var o = {};
    if (li.on != null) o.on = li.on;
    if (li.brightness != null) o.brightness = li.brightness;
    if (li.color && li.color.rgb) o.rgb = li.color.rgb;
    if (li.color && li.color.cct) o.cct = li.color.cct;
    return o;
  }
  function parseScene(raw) {
    var t = norm(raw);
    if (/^good ?night$/.test(t)) return { name: "Good Night" };
    var m = t.match(/^(?:run|start|set|turn on|activate)(?: the| my)? (.+?) scene$/) || t.match(/^(?:run|start|set|activate)(?: the| my)? scene (.+)$/) || t.match(/^scene (.+)$/);
    return m ? { name: cap(m[1]) } : null;
  }

  // ---------- music on the iPhone ----------
  function parseMusic(raw) {
    var t = norm(raw).replace(/[.,]/g, "");
    // speakers, TV, other apps and volume stay with the Shortcut
    if (/\b(home ?pods?|apple tv|tv|speakers?|airplay|spotify|youtube|pandora|volume|louder|quieter|turn (it|the music) (up|down))\b/.test(t)) return null;
    if (/^(pause|stop)( the| my)?( music| song| track| playing| it)?$/.test(t)) return { action: "pause" };
    if (/^(resume|unpause|continue)( the| my)?( music| song| playing)?$|^play$|^(play|start)( some| my| the)? music$/.test(t)) return { action: "play" };
    if (/^(skip|next)( this| the)?( song| track| one)?$|^(play )?(the )?next (song|track)$|^skip it$/.test(t)) return { action: "next" };
    if (/^(previous|go back|back|last)( a)?( song| track)?$|^(play )?(the )?(previous|last) (song|track)$/.test(t)) return { action: "previous" };
    if (/^(restart|start over|replay)( (this|the) (song|track))?$/.test(t)) return { action: "restart" };
    if (/^shuffle( my| all my)?( music| songs| library)?$/.test(t)) return { play: { query: "", kind: "any", shuffle: true } };
    var m = t.match(/^(play|put on|shuffle)\s+(.+)$/);
    if (!m) return null;
    var q = m[2].replace(/\s+(on|from) (apple music|my library|music)$/, "").trim(), kind = "any", mm;
    if (/^(a |the )?(game|video|movie|show|news|podcast|audiobook|radio|station)\b/.test(q)) return null;
    if ((mm = q.match(/^(?:my |the )?(.+?) playlist$/)) || (mm = q.match(/^(?:my |the )?playlist (?:called |named )?(.+)$/))) { q = mm[1]; kind = "playlist"; }
    else if ((mm = q.match(/^(?:the )?album (?:called |named )?(.+)$/)) || (mm = q.match(/^(?:the )?(.+?) album$/))) { q = mm[1]; kind = "album"; }
    else if ((mm = q.match(/^(?:some |songs by |music by |something by |some songs by |some music by )(.+)$/))) { q = mm[1]; kind = "artist"; }
    else if ((mm = q.match(/^(.+?) by (.+)$/))) { q = mm[1]; kind = "song"; }
    else if ((mm = q.match(/^(.+?) music$/))) { q = mm[1]; kind = "artist"; }
    q = q.replace(/^(the song |song )/, "").trim();
    if (!q) return null;
    return { play: { query: q, kind: kind, shuffle: m[1] === "shuffle" } };
  }
  var MUSIC_SAY = { pause: "Paused.", play: "Playing.", next: "Skipping.", previous: "Going back.", restart: "From the top." };

  // ---------- calls ----------
  function parseCall(raw) {
    var t = norm(raw).replace(/[.,]/g, "");
    var m = t.match(/^(call|phone|ring|dial|facetime|face time)\s+(.+?)(?: on (?:her|his|their|the) (?:cell|mobile|phone))?$/);
    if (!m) return null;
    var who = m[2].replace(/^(my|the)\s+/, "").trim();
    if (!who || /^(me|it|that|back|an? (uber|lyft|cab|taxi))$/.test(who)) return null;
    return { who: who, facetime: /face ?time/.test(m[1]) };
  }

  function appTitle(profile) { return (profile && (profile.displayName || profile.assistantName)) || "Friday"; }
  function inAppTexts() {
    var st = (root.FridayStorage && root.FridayStorage.get("settings", {})) || {};
    return st.textsInApp !== false;
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

    // 4.2: the Apple TV (paired remote over home Wi-Fi) comes before anything else that mentions the TV
    if (root.FridayTV) {
      var tvr = await root.FridayTV.handle(raw);
      if (tvr) return tvr;
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

    // Music on this iPhone is always done in the app (no Shortcut, no Music app opening).
    var mu = parseMusic(raw);
    if (mu && nat.kit && nat.kit.available()) {
      var musicNo = function (r) {
        if (/denied/.test(String(r && r.error || ""))) return { say: "I need Media and Apple Music access. Turn it on in iPhone Settings, " + appTitle(profile) + ", Media and Apple Music.", tool: "music", playing: false };
        return null;
      };
      if (mu.action) {
        var mr = await nat.kit.music(mu.action);
        if (!mr.ok) return musicNo(mr) || { say: "Music isn't responding right now.", tool: "music", playing: false };
        return { say: MUSIC_SAY[mu.action] || "Done.", tool: "music", playing: mu.action !== "pause" };
      }
      var pr = await nat.kit.play(mu.play.query, mu.play.kind, mu.play.shuffle);
      if (!pr.ok) {
        var no = musicNo(pr);
        if (no) return no;
        var what = mu.play.kind === "playlist" ? "a playlist called " + mu.play.query : mu.play.kind === "album" ? "the album " + mu.play.query : mu.play.query;
        return { say: mu.play.query ? "I couldn't find " + keepCase(what, raw) + " in your music." : "There's no music in your library to shuffle yet.", tool: "music", playing: false };
      }
      return { say: mu.play.query ? (mu.play.shuffle ? "Shuffling " : "Playing ") + (pr.title || mu.play.query) + "." : "Shuffling your music.", tool: "music", playing: true };
    }

    var cl = parseCall(raw);
    if (cl && inAppTexts() && nat.contacts && nat.contacts.available()) {
      var num = await nat.contacts.numberFor(cl.who);
      if (!num) return null;
      return { say: (cl.facetime ? "FaceTiming " : "Calling ") + num.name + ".", tool: "call", url: (cl.facetime ? "facetime://" : "tel://") + num.number };
    }

    // 3.5: real alarms in the app (AlarmKit), steps and sleep, Wi-Fi name
    var al = parseAlarm(raw);
    if (al && nat.kit && nat.kit.alarm) {
      var ar0 = await nat.kit.alarm(al.at, al.label || "Alarm");
      if (ar0.ok) {
        var alarms = root.FridayStorage.get("alarms", []) || [];
        alarms.push({ id: ar0.id, at: +al.at, label: al.label || "" }); root.FridayStorage.set("alarms", alarms.slice(-30));
        return { say: "Alarm set for " + timeWord(al.at) + (dayWord(al.at) === "today" ? "" : " " + dayWord(al.at)) + ".", tool: "alarm" };
      }
      if (/denied/.test(ar0.error || "")) return { say: "I need permission to set alarms. Turn it on in iPhone Settings, " + appTitle(profile) + ", Alarms.", tool: "alarm" };
    }
    if (/^(?:how many steps|how many steps have i (?:taken|done|walked)|what(?:'s| are) my steps|step count)\b/.test(t) && nat.kit && nat.kit.health) {
      var hs0 = await nat.kit.health();
      if (!hs0.ok) return { say: "I can't read Health yet. Turn on HealthKit in AltLoad's entitlements when you install me, then allow Health when I ask.", tool: "health" };
      return { say: "You've taken " + hs0.steps.toLocaleString() + " steps today.", tool: "health" };
    }
    if (/^(?:how (?:did|long did|much did) i sleep|how was my sleep|how much sleep did i get)\b/.test(t) && nat.kit && nat.kit.health) {
      var hs1 = await nat.kit.health();
      if (!hs1.ok) return { say: "I can't read Health yet. Turn on HealthKit in AltLoad's entitlements when you install me, then allow Health when I ask.", tool: "health" };
      if (!hs1.sleepMinutes) return { say: "I don't see any sleep for last night in Health.", tool: "health" };
      return { say: "You slept " + sleepWords(hs1.sleepMinutes) + " last night.", tool: "health" };
    }
    if (/^what (?:wi-?fi|wifi network|network) am i (?:on|connected to)$/.test(t) && nat.kit && nat.kit.wifiName) {
      var ss = await nat.kit.wifiName(true);
      return { say: ss ? "You're on " + ss + "." : "I can't see the Wi-Fi name. Turn on Access Wi-Fi Information in AltLoad when you install me, and allow location when I ask.", tool: "wifi" };
    }

    // 3.4: climate and the rest of the home in Apple Home (never locks)
    var hc = parseHomeDevice(raw, nat.home.knownDevices ? nat.home.knownDevices() : []);
    if (hc && nat.home.available() && nat.home.control) {
      if (!nat.home.knownDevices().length) await nat.home.devices();
      if (hc.read) {
        var rd = await nat.home.read({ kind: hc.read, room: hc.room });
        if (!rd.ok || !rd.readings.length) return null;
        var withT = rd.readings.filter(function (x) { return x.current != null; });
        if (hc.read === "humidity") {
          var hs = rd.readings.filter(function (x) { return x.humidity != null; });
          if (!hs.length) return null;
          return { say: "It's " + Math.round(hs[0].humidity) + " percent humidity" + (hc.room ? " in the " + hc.room : " inside") + ".", tool: "home" };
        }
        if (!withT.length) return null;
        var temps = withT.map(function (x) { return cToF(x.current); });
        var lo = Math.min.apply(null, temps), hi = Math.max.apply(null, temps);
        var th = rd.readings.filter(function (x) { return x.target != null && (x.kind === "thermostat" || x.kind === "ac"); })[0];
        var say1 = "It's " + (lo === hi ? lo : lo + " to " + hi) + " degrees" + (hc.room ? " in the " + hc.room : " inside") + ".";
        if (th) say1 += " The thermostat is set to " + cToF(th.target) + ".";
        return { say: say1, tool: "home" };
      }
      var opts = { kind: hc.kind || "", name: hc.name || "", room: hc.room || "" };
      if (hc.on != null) opts.on = hc.on;
      if (hc.level != null) opts.level = hc.level;
      if (hc.mode) opts.mode = hc.mode;
      if (hc.tempF != null || hc.delta) {
        var baseF = hc.tempF;
        if (hc.delta) {
          var cur = await nat.home.read({ kind: "temperature" });
          var tt = cur.ok ? cur.readings.filter(function (x) { return x.target != null; })[0] : null;
          if (!tt) return null;
          baseF = cToF(tt.target) + hc.delta;
        }
        opts.temperature = Math.round((baseF - 32) * 5 / 9 * 10) / 10;
        hc.tempF = baseF;
      }
      var cr = await nat.home.control(opts);
      if (!cr.ok) return null;
      var who = hc.label || (cr.names && cr.names.length === 1 ? cr.names[0] : "The " + (hc.kind === "climate" ? "thermostat" : hc.kind || "device"));
      who = who.charAt(0).toUpperCase() + who.slice(1);
      var said = hc.tempF != null ? who + " is set to " + hc.tempF + " degrees." :
        hc.mode ? (hc.mode === "off" ? who + " is off." : who + " is set to " + hc.mode + ".") :
        hc.level != null ? (hc.kind === "blinds" ? who + " " + (hc.level === 0 ? "closed." : hc.level === 100 ? "open." : "at " + hc.level + " percent.") : who + " is at " + hc.level + " percent.") :
        who + (hc.on ? " is on." : " is off.");
      return { say: said, tool: "home" };
    }

    var sc = parseScene(raw);
    if (sc && nat.home.available()) {
      var s2 = await nat.home.scene(sc.name);
      if (s2.ok) return { say: (/good night/i.test(sc.name) ? "Good night." : "Running " + (s2.scene || sc.name) + "."), tool: "home" };
      return null;
    }

    // AiDot lights first (straight over home Wi-Fi), then Apple Home in the app, then the Shortcut.
    var ad = nat.aidot && nat.aidot.ready() ? nat.aidot : null;
    // 3.5: if you saved your home Wi-Fi and you're on another network, skip AiDot and go straight to Apple Home
    var homeWifi = ((root.FridayStorage.get("settings", {}) || {}).homeWifi) || "";
    if (ad && homeWifi && nat.kit && nat.kit.wifiName) { var curWifi = await nat.kit.wifiName(false); if (curWifi && curWifi !== homeWifi) ad = null; }
    var lq = parseLightQuestion(raw);
    if (lq && ad) {
      var qp = pickAidot(lq.words, ad.lights());
      if (qp) {
        var st = await ad.state(qp.ids);
        if (st.ok) {
          var known = st.done.filter(function (d) { return d.on != null; });
          if (known.length === 1 && qp.list.length === 1) {
            var k1 = known[0];
            return { say: (k1.name || "The light") + (k1.on ? " is on" + (k1.brightness != null ? " at " + k1.brightness + " percent." : ".") : " is off."), tool: "home", via: "aidot" };
          }
          if (known.length) {
            var onList = known.filter(function (d) { return d.on; });
            var say = !onList.length ? (known.length > 1 ? "All " + known.length + " lights are off." : "It's off.")
              : onList.length === known.length ? (known.length > 1 ? "All " + known.length + " lights are on." : (onList[0].name || "It") + " is on.")
              : onList.length + " of " + known.length + " lights are on: " + join(onList.slice(0, 4).map(function (d) { return d.name; })) + ".";
            return { say: say, tool: "home", via: "aidot" };
          }
        }
      }
    }

    var li = parseLights(raw);
    if (li && ad) {
      var pick = pickAidot(li.words, ad.lights());
      if (pick) {
        var ar = await ad.control(pick.ids, aidotOpts(li));
        if (ar.ok) {
          var line = lightLine(lightLabel(pick, li), li);
          var missed = ar.failed.map(function (f) { return f.name; }).filter(Boolean);
          if (missed.length) line = line.replace(/\.$/, "") + ", except " + join(missed.slice(0, 3)) + ", which didn't answer.";
          return { say: line, tool: "home", via: "aidot" };
        }
      }
    }
    if (li && !li.color && nat.home.available()) {
      var res = await nat.home.setLights({ room: li.room, on: li.on, brightness: li.brightness });
      if (!res.ok) return null;
      var where = li.room ? "The " + li.room + " lights" : "The lights";
      var line2 = li.brightness != null ? (li.brightness === 0 ? where + " are off." : where + " are at " + li.brightness + " percent.") : (li.on ? where + " are on." : where + " are off.");
      return { say: line2, tool: "home" };
    }
    return null;
  }

  // ---------- 3.5: alarms, sleep words ----------
  function sleepWords(min) { var h = Math.floor(min / 60), m = min % 60; return (h ? h + " hour" + (h === 1 ? "" : "s") : "") + (h && m ? " and " : "") + (m || !h ? m + " minute" + (m === 1 ? "" : "s") : ""); }
  function timeWord(d) { d = new Date(d); var h = d.getHours(), m = d.getMinutes(); return (h % 12 || 12) + (m ? ":" + String(m).padStart(2, "0") : "") + (h < 12 ? " AM" : " PM"); }
  function dayWord(d) { var a = new Date(d); a.setHours(0, 0, 0, 0); var b = new Date(); b.setHours(0, 0, 0, 0); var n = Math.round((a - b) / 86400000); return n === 0 ? "today" : n === 1 ? "tomorrow" : a.toLocaleDateString([], { weekday: "long" }); }
  function parseAlarm(raw) {
    var t = String(raw || "").toLowerCase().replace(/[’]/g, "'").replace(/[.!?]+$/, "").replace(/^(?:hey |ok |okay )?(?:friday|jarvis|reed)[, ]+/, "").replace(/^(?:please |can you |could you )/, "").trim();
    if (!/^(?:set|make|create|add|put) (?:an |a |my )?alarm\b|^wake me(?: up)?\b|^alarm (?:for|at)\b/.test(t)) return null;
    var lbl = (t.match(/\b(?:called|named|labeled|for (?:my |the )?(work|gym|school|meds|medicine|pills))\b\s*(.*)$/) || [])[0] || "";
    var w = parseWhen(t.replace(/\b(?:alarm|wake me(?: up)?)\b/g, " "));
    if (!w || !w.date) return null;
    var at = new Date(w.date);
    if (at <= new Date()) at.setDate(at.getDate() + 1);
    if (at - new Date() > 7 * 86400000) return null;
    return { at: at, label: lbl ? lbl.replace(/^(?:called|named|labeled) /, "").replace(/^for /, "") : "" };
  }

  // ---------- 3.4: the rest of the home (climate, fans, plugs, blinds, TV power) ----------
  function cToF(c) { return Math.round(c * 9 / 5 + 32); }
  var ROOMS_RE = /\b(?:in|on) (?:the |my )?(bedroom|living room|kitchen|bathroom|office|den|basement|garage|hallway|dining room|nursery|guest room)\b/;
  function parseHomeDevice(raw, known) {
    var t = String(raw || "").toLowerCase().replace(/[’]/g, "'").replace(/[.!?]+$/, "").replace(/^(?:hey |ok |okay )?(?:friday|jarvis|reed)[, ]+/, "").replace(/^(?:please |can you |could you )/, "").trim();
    if (/\b(lock|unlock|garage|alarm system|security)\b/.test(t)) return null;
    var rm = t.match(ROOMS_RE), room = rm ? rm[1] : "";
    var m;
    // what's it like inside
    if (/^(?:what(?:'s| is) the (?:temperature|temp)|how (?:hot|warm|cold|cool) is it|what(?:'s| is) it like)\b.*\b(?:inside|in here|indoors|in the house|at home|in (?:the |my )?(?:bedroom|living room|kitchen|bathroom|office))\b/.test(t) ||
        /^what(?:'s| is) the (?:thermostat|ac|air) (?:set to|at|on)\b/.test(t) || /^(?:what(?:'s| is) the )?(?:indoor|inside|room) temp(?:erature)?\b/.test(t)) return { read: "temperature", room: room };
    if (/^(?:what(?:'s| is) the |how(?:'s| is) the )?humidity\b.*\b(?:inside|in here|indoors|in the house|at home|bedroom|living room)?/.test(t) && /humidity/.test(t) && !/outside|weather/.test(t)) return { read: "humidity", room: room };
    // thermostat / AC / heat
    if ((m = t.match(/^(?:set|put|turn|change|make) (?:the |my )?(?:temperature|temp|thermostat|heat|heater|ac|a\.c\.?|air|air conditioning|air conditioner|climate)(?: down| up)? (?:to |at )?(\d{2})(?: degrees)?$/))) {
      var mode0 = /\b(heat|heater)\b/.test(t) ? "heat" : /\b(ac|a\.c|air)\b/.test(t) ? "cool" : "";
      return { kind: "climate", tempF: +m[1], mode: mode0 || undefined, room: room, label: "The thermostat" };
    }
    if ((m = t.match(/^(?:set|put|make) it (?:to )?(\d{2})(?: degrees)?$/))) return { kind: "climate", tempF: +m[1], room: room, label: "The thermostat" };
    if (/^(?:make it|turn it) (?:a (?:little |bit )?)?(warmer|hotter|up)(?: in here)?$/.test(t) || /^i'?m (?:cold|freezing)$/.test(t)) return { kind: "climate", delta: 2, room: room, label: "The thermostat" };
    if (/^(?:make it|turn it) (?:a (?:little |bit )?)?(cooler|colder|down)(?: in here)?$/.test(t) || /^i'?m (?:hot|burning up)$/.test(t)) return { kind: "climate", delta: -2, room: room, label: "The thermostat" };
    if ((m = t.match(/^turn (on|off) (?:the |my )?(heat|heater|ac|a\.c\.?|air|air conditioning|air conditioner|thermostat)(?: on| off)?$/)) || (m = t.match(/^turn (?:the |my )?(heat|heater|ac|a\.c\.?|air|air conditioning|air conditioner|thermostat) (on|off)$/))) {
      var onoff = m[1] === "on" || m[1] === "off" ? m[1] : m[2], what = m[1] === "on" || m[1] === "off" ? m[2] : m[1];
      var md = onoff === "off" ? "off" : /heat/.test(what) ? "heat" : /thermostat/.test(what) ? "auto" : "cool";
      return { kind: "climate", mode: md, room: room, label: /heat/.test(what) ? "The heat" : /thermostat/.test(what) ? "The thermostat" : "The AC" };
    }
    // fans and blinds
    if ((m = t.match(/^(?:turn |set )?(?:the |my )?(?:(\w+(?: \w+)?) )?fan (?:to |at )(\d{1,3})(?: ?%| percent)?$/))) return { kind: "fan", level: Math.min(100, +m[2]), room: room };
    if ((m = t.match(/^turn (on|off) (?:the |my )?(?:(\w+(?: \w+)?) )?fans?$/)) || (m = t.match(/^turn (?:the |my )?(?:(\w+(?: \w+)?) )?fans? (on|off)$/))) {
      var fo = m[1] === "on" || m[1] === "off" ? m[1] : m[2];
      return { kind: "fan", on: fo === "on", room: room };
    }
    if ((m = t.match(/^(open|close|raise|lower) (?:the |my )?(blinds|shades|curtains|drapes)$/))) return { kind: "blinds", level: /open|raise/.test(m[1]) ? 100 : 0, room: room, label: "The " + m[2] };
    if ((m = t.match(/^(?:set |put )?(?:the |my )?(blinds|shades|curtains) (?:to |at )(\d{1,3})(?: ?%| percent)?$/))) return { kind: "blinds", level: Math.min(100, +m[2]), room: room, label: "The " + m[1] };
    // TV power through Apple Home (only works if the TV shows up there; otherwise the Shortcut does it)
    if ((m = t.match(/^turn (on|off) (?:the |my )?(tv|television)$/)) || (m = t.match(/^turn (?:the |my )?(tv|television) (on|off)$/))) {
      var to = m[1] === "on" || m[1] === "off" ? m[1] : m[2];
      return { kind: "tv", on: to === "on", label: "The TV" };
    }
    // anything else in Apple Home by its name: "turn on the coffee maker"
    if ((m = t.match(/^turn (on|off) (?:the |my )?(.+)$/)) || (m = t.match(/^turn (?:the |my )?(.+?) (on|off)$/))) {
      var o2 = m[1] === "on" || m[1] === "off" ? m[1] : m[2], nm = (m[1] === "on" || m[1] === "off" ? m[2] : m[1]).trim();
      if (/\b(lights?|lamps?|bulbs?|all|everything|music|it|that)\b/.test(nm)) return null;
      var hit = (known || []).filter(function (d) { return d.kind !== "light" && d.kind !== "temp" && d.kind !== "humidity" && d.name && (d.name.toLowerCase() === nm || d.name.toLowerCase().indexOf(nm) >= 0 || nm.indexOf(d.name.toLowerCase()) >= 0); })[0];
      if (hit) return { name: hit.name, on: o2 === "on", label: hit.name };
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
    parseLightQuestion: parseLightQuestion,
    parseHomeDevice: parseHomeDevice,
    parseAlarm: parseAlarm,
    pickAidot: pickAidot,
    lightLine: lightLine,
    lightLabel: lightLabel,
    parseScene: parseScene,
    parseMusic: parseMusic,
    parseCall: parseCall,
    inAppTexts: inAppTexts,
    spokenWhen: spokenWhen
  };
})(window);
