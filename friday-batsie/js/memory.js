/* 4.0: memory types. Her one existing Memory (chat.memory) now knows what kind of thing each memory is:
   - fact        lasting facts about you and your world (people, pets, places, dates)
   - preference  what you like, dislike and prefer
   - context     temporary things (plans, appointments, how today is going) that expire on their own
   - event       moments you've shared with her
   Personality conclusions are not memories: they belong to her personality system (persona.js), which
   only changes through her own evidence-checked reflection. Statements about who she is or how she should
   be are never filed as memories, so no brain can rewrite her through Memory.
   Every brain gets the same memories, picked and laid out here on the phone. */
(function (root) {
  "use strict";

  var TYPES = { fact: "Facts", preference: "Preferences", context: "Right now", event: "Shared moments" };
  var DAY = 86400000;

  var PREF_RE = /\b(likes?|loves?|hates?|dislikes?|prefers?|favou?rite|enjoys?|can't stand|cannot stand|isn't a fan|is not a fan|is a fan|big fan|would rather|rather have|into (?:cooking|music|games|sports|movies|anime|cars|fishing|hunting|gaming))\b/i;
  var EVENT_RE = /\b(we|together|with (?:friday|f\.r\.i\.d\.a\.y\.?|you))\b.*\b(finished|built|made|watched|went|did|fixed|celebrated|planned|talked about|worked on|set up)\b|\b(finished|celebrated|built|fixed)\b.*\b(together|with (?:friday|you))\b/i;
  var WHEN = [
    [/\b(right now|at the moment|currently|for now|today|tonight|this (?:morning|afternoon|evening))\b/i, 1],
    [/\btomorrow\b/i, 2],
    [/\b(this (?:week|weekend)|on (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|in a few days)\b/i, 7],
    [/\b(next (?:week|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i, 14],
    [/\b(this month|next month|in a couple (?:of )?weeks)\b/i, 31]
  ];

  function contextDays(text) {
    for (var i = 0; i < WHEN.length; i++) if (WHEN[i][0].test(text)) return WHEN[i][1];
    return 0;
  }
  // Local and free: used for "remember that …", edits, and older memories.
  function classifyLocal(text) {
    var t = String(text || "");
    var days = contextDays(t);
    if (days) return { type: "context", days: days };
    if (EVENT_RE.test(t)) return { type: "event" };
    if (PREF_RE.test(t)) return { type: "preference" };
    return { type: "fact" };
  }

  // Statements about who she is or how she should act belong to her personality, not Memory.
  // ("Friday should be meaner" is not filed; "Friday night is pizza night" is a normal fact.)
  function aboutHer(text, profile) {
    var t = String(text || "").trim().toLowerCase();
    var names = ["friday", "f.r.i.d.a.y.", "f.r.i.d.a.y", "reed", "jarvis", "the assistant", "the ai", "you"];
    if (profile && profile.assistantName) names.push(String(profile.assistantName).toLowerCase());
    if (profile && profile.displayName) names.push(String(profile.displayName).toLowerCase());
    var esc = names.map(function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|");
    var re = new RegExp("^(?:" + esc + ")(?: should| needs to| has to| must| is (?:too|so|very|more|less|being|always|never|a |an |kind|mean|rude|funny|sarcastic|nice|sassy|annoying|boring)| are (?:too|so|very|more|less|being|always|never)|'s (?:personality|tone|attitude|voice|humor|humour|style|identity))");
    return re.test(t);
  }

  function nowIso() { return new Date().toISOString(); }
  function expiresFrom(days) { return new Date(Date.now() + Math.max(1, Math.min(31, +days || 7)) * DAY).toISOString(); }

  // Give a memory its type (and an expiry for temporary ones) without losing anything already set.
  function normalize(m) {
    if (!m || typeof m !== "object") return m;
    if (!m.type) {
      if (m.kind === "episodic") m.type = "event";
      else if (m.kind === "semantic") m.type = "fact";
      else { var c = classifyLocal(m.text); m.type = c.type; if (c.type === "context" && !m.expiresAt) m.expiresAt = new Date((Date.parse(m.at) || Date.now()) + c.days * DAY).toISOString(); }
    }
    if (m.type === "context" && !m.expiresAt) m.expiresAt = expiresFrom(7);
    return m;
  }
  function normalizeAll(list) {
    var changed = false;
    (list || []).forEach(function (m) { if (m && typeof m === "object" && (!m.type || (m.type === "context" && !m.expiresAt))) { normalize(m); changed = true; } });
    return changed;
  }
  // Temporary context that's over is moved out of Memory (kept briefly in an "expired" list).
  function prune(list) {
    var now = Date.now(), gone = [];
    for (var i = (list || []).length - 1; i >= 0; i--) {
      var m = list[i];
      if (m && m.type === "context" && !m.pinned && m.expiresAt && Date.parse(m.expiresAt) < now) gone.push(list.splice(i, 1)[0]);
    }
    if (gone.length && root.FridayStorage) {
      var old = root.FridayStorage.get("memory.expired", []) || [];
      root.FridayStorage.set("memory.expired", old.concat(gone.map(function (m) { return Object.assign({}, m, { expiredAt: nowIso() }); })).slice(-100));
    }
    return gone.length;
  }

  var STOP = /^(the|and|for|with|that|this|what|when|where|who|how|why|are|was|were|is|you|your|my|me|i|a|an|to|of|in|on|at|it|do|does|did|can|could|would|should|have|has|had|about|just|like|tell|want|need|get|please|hey|friday)$/;
  function words(t) { return (String(t || "").toLowerCase().match(/[a-z0-9']{3,}/g) || []).map(function (w) { return w.replace(/'s$/, "").replace(/'/g, ""); }).filter(function (w) { return w.length >= 3 && !STOP.test(w); }); }
  function relevance(m, qw) { if (!qw.length) return 0; var mw = words(m.text); return qw.filter(function (w) { return mw.indexOf(w) >= 0; }).length; }

  // The same memories for every brain: picked by type and by what you're talking about right now.
  function pick(list, query) {
    var qw = words(query), live = (list || []).filter(function (m) { return m && m.text; }).map(normalize);
    function rank(arr) {
      return arr.map(function (m, i) { return { m: m, r: relevance(m, qw), i: i }; })
        .sort(function (a, b) { return ((b.m.pinned ? 1 : 0) - (a.m.pinned ? 1 : 0)) || (b.r - a.r) || (String(b.m.at || "").localeCompare(String(a.m.at || ""))); })
        .map(function (x) { return x.m; });
    }
    var now = Date.now();
    return {
      preference: rank(live.filter(function (m) { return m.type === "preference"; })).slice(0, 20),
      fact: rank(live.filter(function (m) { return m.type === "fact"; })).slice(0, 24),
      context: rank(live.filter(function (m) { return m.type === "context" && (!m.expiresAt || Date.parse(m.expiresAt) >= now); })).slice(0, 8),
      event: rank(live.filter(function (m) { return m.type === "event"; })).slice(0, 6)
    };
  }
  function promptBlock(list, profile, query) {
    var owner = (profile && profile.ownerName) || "them", p = pick(list, query), out = [];
    if (p.fact.length) out.push("Facts about " + owner + ":\n" + p.fact.map(function (m) { return "- " + m.text; }).join("\n"));
    if (p.preference.length) out.push(owner + "'s preferences:\n" + p.preference.map(function (m) { return "- " + m.text; }).join("\n"));
    if (p.context.length) out.push("Right now (temporary, don't treat as lasting):\n" + p.context.map(function (m) { return "- " + m.text + (m.expiresAt ? " (until about " + new Date(m.expiresAt).toLocaleDateString([], { month: "short", day: "numeric" }) + ")" : ""); }).join("\n"));
    if (p.event.length) out.push("Moments you've shared:\n" + p.event.map(function (m) { return "- " + m.text; }).join("\n"));
    return out.join("\n\n");
  }

  // Check what a brain extracted before it reaches Memory.
  function accept(items, profile) {
    var out = [];
    (Array.isArray(items) ? items : []).forEach(function (x) {
      var text = typeof x === "string" ? x : x && x.text;
      text = String(text || "").trim();
      if (text.length < 6 || text.length > 200 || aboutHer(text, profile)) return;
      var type = typeof x === "object" && TYPES[x.type] ? x.type : classifyLocal(text).type;
      var m = { text: text, at: nowIso(), auto: true, type: type };
      if (type === "context") m.expiresAt = expiresFrom((typeof x === "object" && x.days) || contextDays(text) || 7);
      out.push(m);
    });
    return out;
  }

  root.FridayMemory = { TYPES: TYPES, classifyLocal: classifyLocal, normalize: normalize, normalizeAll: normalizeAll, prune: prune, pick: pick, promptBlock: promptBlock, accept: accept, aboutHer: aboutHer, expiresFrom: expiresFrom };
})(window);
