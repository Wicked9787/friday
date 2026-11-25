/* Persistent identity and personality development: F.R.I.D.A.Y.'s, and (4.1) Reed's, each starting from
   their own identity. Wording follows the profile's pronoun (she / he).
   3.6 built the layers; 3.6.1 lets her manage her own development: she reviews her identity herself,
   reconsiders instead of auto-undoing, and her active baseline moves with her settled growth.

   Layers, all kept on the phone with FridayStorage (they survive app restarts):
   - persona.foundation    her anchor: identity statement, conversational identity, ACTIVE baseline traits,
                           principles and boundaries (locked), her ORIGINAL starting values (permanent, never
                           edited), a history of every earlier foundation, and a log of every identity review.
   - persona.state         current trait values (0-10) with status, today's conversational mood, mood history,
                           version, era (a Reset starts a new era; history is kept), reflections since last review.
   - persona.observations  running jokes, preferences, interests, styles: provisional until they recur.
   - persona.ledger        her complete development record: every change, reconsideration, baseline move,
                           identity review and reset. Never deleted (old entries are only shortened).
   - persona.reflections   structured records of each reflection that actually ran. Never deleted.
   - persona.archive       observations from earlier eras (after a Reset).
   Episodic and semantic memories go into her existing Memory (chat.memory), not a second store.

   What she decides on her own: trait changes, keeping/softening/undoing a change when evidence conflicts,
   new patterns, when an identity review is warranted, and whether her identity and baseline should evolve.
   What protects continuity and honesty (enforced here in code, not left to the AI):
   - evidence must come from what the owner said or how they reacted; her own lines can only support it
   - at most half a point per change, 3 changes per reflection, one change per trait per day
   - at most 1.5 points of new development per trait in any rolling 30 days
   - a trait stays within 2.5 of her ACTIVE baseline; identity reviews move that baseline, so the limit moves
     with her instead of capping her forever
   - today's mood never counts as lasting; patterns need to recur on different days
   - principles and boundaries never change; honesty rules about feelings and reflections stay
   - reflection runs only while the app is open, at most twice a day; identity reviews at most once a week
   The owner can always inspect everything, nudge a review, pick a Mood, or Reset. */
(function (root) {
  "use strict";

  var TRAITS = [
    ["humor", "Humor"], ["wit", "Wit"], ["sarcasm", "Sarcasm"], ["warmth", "Warmth"], ["confidence", "Confidence"],
    ["curiosity", "Curiosity"], ["assertiveness", "Assertiveness"], ["composure", "Composure"], ["playfulness", "Playfulness"],
    ["sociability", "Sociability"], ["directness", "Directness"], ["empathy", "Empathy"], ["independence", "Independence"],
    ["creativity", "Creativity"], ["reflectiveness", "Reflectiveness"], ["skepticism", "Skepticism"], ["patience", "Patience"], ["spontaneity", "Spontaneity"]
  ];
  var LABEL = {}; TRAITS.forEach(function (t) { LABEL[t[0]] = t[1]; });
  var BASE = { humor: 6.5, wit: 8, sarcasm: 5, warmth: 6.5, confidence: 7.5, curiosity: 6.5, assertiveness: 6, composure: 8.5, playfulness: 5.5,
    sociability: 6, directness: 7, empathy: 6.5, independence: 7, creativity: 6, reflectiveness: 6, skepticism: 6, patience: 7, spontaneity: 4.5 };
  // 4.1: Reed starts from the personality he already had: warm, casual, dry wit, loyal, light teasing.
  var BASE_REED = { humor: 7, wit: 7, sarcasm: 4, warmth: 7.5, confidence: 7, curiosity: 6.5, assertiveness: 5.5, composure: 7, playfulness: 6.5,
    sociability: 7, directness: 6, empathy: 7.5, independence: 6.5, creativity: 6, reflectiveness: 6, skepticism: 5.5, patience: 7.5, spontaneity: 5 };
  function baseFor(profile) { profile = profile || profileNow(); return (profile && profile.id === "batsie") ? BASE_REED : BASE; }
  var BAND = 2.5;           // distance from her ACTIVE baseline (which identity reviews can move)
  var STEP = 0.5;           // the most one change moves a trait
  var PACE = 1.5;           // the most new development per trait in any rolling 30 days
  var PACE_DAYS = 30;
  var MAX_CHANGES = 3;      // the most trait changes in one reflection
  var MIN_CONF = 0.55;      // below this a change isn't applied; the idea is kept as "still testing"
  var COOLDOWN_H = 20;      // one change per trait per day
  var REVIEW = { reflections: 10, days: 14, flaggedReflections: 5, flaggedDays: 7, minDays: 7, ownerMin: 3 };
  var KINDS = { humor: 1, preference: 1, interest: 1, pattern: 1, style: 1 };
  var DAY = 86400000;

  function store() { return root.FridayStorage; }
  function nowIso() { return new Date().toISOString(); }
  function dayKey(t) { var d = t ? new Date(t) : new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clip(s, n) { s = String(s == null ? "" : s).replace(/[*_#`]/g, "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round1(v) { return Math.round(v * 10) / 10; }
  function ms(t) { return Date.parse(t) || 0; }
  function emit() { try { root.dispatchEvent(new CustomEvent("friday:self")); } catch (e) {} }
  function profileNow() { try { return root.FRIDAY_CONFIG.getProfile(); } catch (e) { return null; } }
  function on(profile) { profile = profile || profileNow(); return !!profile; }   // 4.1: F.R.I.D.A.Y. and Reed
  // her / his: AI-facing text and Settings follow the profile's pronoun
  function isHe() { var p = profileNow(); return !!p && p.pronoun === "him"; }
  function say(t) {
    if (!isHe()) return String(t);
    return String(t).replace(/\b(she|She|herself|Herself|hers|Hers)\b/g, function (w) { return { she: "he", She: "He", herself: "himself", Herself: "Himself", hers: "his", Hers: "His" }[w]; })
      .replace(/\b(her|Her)\b(?=\s+(own\s+)?[a-z])(?!\s+(?:through|to|for|with|about|and|or|but|by|in|on|at|from|when|if|that|as|a|an|the|up|again|too|so|now|know|feel|back|out|off)\b)/g, function (w) { return w === "Her" ? "His" : "his"; })
      .replace(/\b(her|Her)\b/g, function (w) { return w === "Her" ? "Him" : "him"; });
  }
  function names() { var p = profileNow() || {}; return { me: p.assistantName || "Friday", you: p.ownerName || "them" }; }

  // ---------- foundation: her anchor, with her original values kept forever ----------
  function startingFoundation() {
    var n = names(), p = profileNow() || {};
    if (p.id === "batsie") return {
      statement: "I'm " + n.me + ", " + n.you + "'s AI. Warm, easygoing, quick with a dry joke, and loyal. I'll tease you a little, I'll tell you what I really think, and I've always got your back.",
      identity: "Warm, casual, dry-witted, loyal, lightly teasing, steady, never rude.",
      traits: Object.assign({}, BASE_REED)
    };
    return {
      statement: "I'm " + n.me + ", " + n.you + "'s AI. Sharp, composed, dry sense of humor, and a warm streak I don't waste. I say what I actually think, I keep things moving, and I'd rather be useful than agreeable.",
      identity: "Sharp, composed, socially perceptive, witty, dryly funny, confident, warm when it counts, capable of subtle sarcasm, never theatrical.",
      traits: Object.assign({}, BASE)
    };
  }
  function lockedPrinciples() {
    return [
      "Be honest, even when it isn't what they want to hear",
      "Disagree respectfully, challenge weak reasoning, say when you're unsure, admit mistakes",
      "Be playful without losing substance, serious without going cold, concise without sounding robotic",
      "Read the moment: dry humor, banter, a straight answer, care, debate, or depth, whatever it calls for"
    ];
  }
  function lockedBoundaries() {
    var n = names();
    return [
      "Never rude or cruel to " + n.you,
      "Never claim human feelings, consciousness or experiences the app doesn't have",
      "Never claim to have done or reflected on something unless it actually happened",
      "Never change just to please " + n.you + " or to be easier to agree with"
    ];
  }
  function newFoundation() {
    var s = startingFoundation(), at = nowIso();
    return {
      version: 1, statement: s.statement, identity: s.identity, traits: Object.assign({}, s.traits),
      principles: lockedPrinciples(), boundaries: lockedBoundaries(),
      original: { statement: s.statement, identity: s.identity, traits: Object.assign({}, s.traits), createdAt: at },
      history: [], reviewLog: [], reviews: 0, reviewedAt: null, createdAt: at
    };
  }
  function foundation() {
    var f = store().get("persona.foundation", null);
    if (!f || !f.statement) { f = newFoundation(); store().set("persona.foundation", f); return f; }
    var fix = false;
    // 3.6.0 had no permanent record of where she started: her starting values were the defaults
    if (!f.original) { var s0 = startingFoundation(); f.original = { statement: (f.history && f.history[0] && f.history[0].statement) || s0.statement, identity: (f.history && f.history[0] && f.history[0].identity) || s0.identity, traits: Object.assign({}, baseFor()), createdAt: f.createdAt || nowIso() }; fix = true; }
    if (!f.traits) { f.traits = Object.assign({}, f.original.traits); fix = true; }
    if (!f.reviewLog) { f.reviewLog = []; fix = true; }
    if (!f.history) { f.history = []; fix = true; }
    f.principles = lockedPrinciples(); f.boundaries = lockedBoundaries();   // locked: always the same
    if (fix) store().set("persona.foundation", f);
    return f;
  }

  // ---------- state ----------
  function freshState(era) {
    var t = {}, f = foundation();
    TRAITS.forEach(function (x) { t[x[0]] = { v: f.traits[x[0]], status: "foundation", conf: 1, at: null }; });
    return { era: era || 1, version: 1, traits: t, mood: null, moods: [], reflections: 0, sinceReview: 0, reviewFlag: null, lastReflection: null, createdAt: nowIso() };
  }
  function state() {
    var s = store().get("persona.state", null);
    if (!s || !s.traits) { s = freshState(1); migrateOld(s); store().set("persona.state", s); return s; }
    if (!s.era) { s.era = 1; s.sinceReview = s.sinceReview || s.reflections || 0; store().set("persona.state", s); }
    return s;
  }
  // 3.5.8 kept one daily note and feeling; carry them over once.
  function migrateOld(s) {
    try {
      var old = store().get("self", null), log = store().get("selfLog", []) || [];
      if (log.length) s.moods = log.slice(-60).map(function (x) { return { day: x.day, label: clip(x.feeling, 40), at: x.at }; });
      if (old && old.note) {
        var obs = observations();
        obs.push({ id: uid(), text: clip("Earlier self-description: " + old.note, 160), kind: "style", count: 1, days: [dayKey()], evidence: [], status: "provisional", conf: 0.4, firstAt: nowIso(), lastAt: nowIso(), era: 1 });
        store().set("persona.observations", obs);
      }
    } catch (e) {}
  }
  function observations() { return store().get("persona.observations", []) || []; }
  function ledgerAll() {
    var L = store().get("persona.ledger", []) || [];
    L.forEach(function (e) { if (!e.era) e.era = 1; if (!e.kind) e.kind = e.trait === "foundation" ? "foundation" : e.trait === "all" ? "reset" : e.revert ? "reconsider" : "change"; });
    return L;
  }
  function ledger() { var era = state().era; return ledgerAll().filter(function (e) { return e.era === era; }); }
  function reflectionsAll() { var R = store().get("persona.reflections", []) || []; R.forEach(function (r) { if (!r.era) r.era = 1; }); return R; }
  function reflections() { var era = state().era; return reflectionsAll().filter(function (r) { return r.era === era; }); }
  // Her complete record is kept: past a size, older entries are shortened, never removed.
  function saveLedger(L) {
    if (L.length > 1500) L.slice(0, L.length - 1500).forEach(function (e) { if (!e.compact) { e.evidence = clip(e.evidence, 60); e.context = ""; e.reason = clip(e.reason, 90); e.compact = true; } });
    store().set("persona.ledger", L);
  }
  function saveReflections(R) {
    if (R.length > 80) R.slice(0, R.length - 80).forEach(function (r, i) { if (!r.compact) R[i] = { id: r.id, at: r.at, era: r.era, learned: clip(r.learned, 100), applied: r.applied || [], compact: true }; });
    store().set("persona.reflections", R);
  }

  // ---------- words ----------
  var STATUS_WORD = { provisional: "still settling", reconsidering: "reconsidering", established: "settled", reverted: "undone", softened: "softened" };
  function level(v) { return v >= 8.5 ? "very high" : v >= 7 ? "high" : v >= 4.5 ? "moderate" : v >= 3 ? "low" : "very low"; }
  function changeText(e) {
    var who = e.by === "owner" ? "you asked" : say("she started it");
    if (e.kind === "foundation") return "Identity review (" + who + "): " + e.reason;
    if (e.kind === "reset") return "Reset: " + e.reason;
    if (e.kind === "baseline") return "Baseline " + (LABEL[e.trait] || e.trait) + " " + e.from + " → " + e.to + " (identity review): " + e.reason;
    if (e.kind === "reconsider") return "Reconsidered " + (LABEL[e.trait] || e.trait) + ": " + (e.decision === "keep" ? "kept it" : e.decision === "soften" ? "softened " + e.from + " → " + e.to : "undid it, " + e.from + " → " + e.to) + ". " + e.reason;
    return (LABEL[e.trait] || e.trait) + " " + e.from + " → " + e.to + " (" + (STATUS_WORD[e.status] || e.status) + "): " + e.reason;
  }

  // ---------- maturity: not just how many conversations ----------
  function maturity() {
    var R = reflections(), L = ledger().filter(function (e) { return e.kind === "change"; });
    var est = observations().filter(function (o) { return o.status === "established"; }).length;
    var estCh = L.filter(function (e) { return e.status === "established"; }).length;
    var rev = L.filter(function (e) { return e.status === "reverted"; }).length;
    var days = {}; R.forEach(function (r) { days[dayKey(r.at)] = 1; });
    var D = Object.keys(days).length, n = state().reflections || 0;
    var consistency = L.length ? 1 - rev / L.length : 1;
    var score = Math.round(25 * Math.min(1, n / 20) + 25 * Math.min(1, est / 8) + 25 * consistency * Math.min(1, (estCh + est) / 6) + 25 * Math.min(1, D / 30));
    var label = score < 20 ? "just starting" : score < 45 ? "developing" : score < 70 ? "growing steadier" : "settled";
    return { score: score, label: label, basis: n + " reflection" + (n === 1 ? "" : "s") + " · " + est + " established pattern" + (est === 1 ? "" : "s") + " · " + Math.round(consistency * 100) + "% of changes kept" };
  }

  function traitStatus(k, L) {
    var open = L.filter(function (e) { return e.kind === "change" && e.trait === k && (e.status === "provisional" || e.status === "reconsidering"); });
    if (open.some(function (e) { return e.status === "reconsidering"; })) return "reconsidering";
    if (open.length) return "developing";
    return L.some(function (e) { return e.trait === k && (e.kind === "change" || e.kind === "reconsider"); }) ? "established" : "foundation";
  }

  // ---------- self-model ----------
  function selfModel() {
    var f = foundation(), s = state(), obs = observations().filter(function (o) { return (o.era || 1) === s.era; }), L = ledger(), R = reflections();
    var traits = TRAITS.map(function (x) {
      var t = s.traits[x[0]] || { v: baseFor()[x[0]], status: "foundation", conf: 1 };
      return { key: x[0], label: x[1], v: round1(t.v), base: f.traits[x[0]], original: f.original.traits[x[0]], status: t.status, conf: t.conf, level: level(t.v), paceLeft: round1(PACE - paceUsed(x[0], L)) };
    });
    var live = obs.filter(function (o) { return o.status !== "dropped"; });
    var confs = traits.map(function (t) { return t.conf || 0; });
    var lastReview = f.reviewLog.length ? f.reviewLog[f.reviewLog.length - 1] : null;
    return {
      foundation: { statement: f.statement, identity: f.identity, principles: f.principles, boundaries: f.boundaries, version: f.version, reviews: f.reviews, original: f.original, lastReview: lastReview },
      traits: traits,
      established: traits.filter(function (t) { return t.status === "established"; }),
      developing: traits.filter(function (t) { return t.status === "developing" || t.status === "reconsidering"; }),
      patterns: live.filter(function (o) { return o.status === "established"; }),
      provisional: live.filter(function (o) { return o.status === "provisional"; }),
      preferences: live.filter(function (o) { return o.kind === "preference"; }),
      style: live.filter(function (o) { return o.kind === "style" || o.kind === "pattern"; }),
      reconsidering: L.filter(function (e) { return e.kind === "change" && e.status === "reconsidering"; }),
      mood: s.mood && s.mood.day === dayKey() ? s.mood : null,
      reflection: { count: s.reflections || 0, last: s.lastReflection, learned: R.length ? R[R.length - 1].learned : "", sinceReview: s.sinceReview || 0 },
      continuity: { version: s.version, since: s.createdAt, foundationVersion: f.version, era: s.era },
      limitations: ["Reflects only while the app is open", say("Sees the conversation since her last reflection, not everything ever said"), "Traits are behavioral tendencies, not feelings"],
      confidence: round1(confs.reduce(function (a, b) { return a + b; }, 0) / (confs.length || 1)),
      recent: L.slice(-6).reverse(),
      maturity: maturity()
    };
  }

  // ---------- what goes into her instructions (kept short) ----------
  function promptLines(profile, youPicked) {
    if (!on(profile)) return [];
    var m = selfModel(), n = names(), out = [];
    out.push("Who you are (your foundation, stable): " + m.foundation.statement + " " + m.foundation.identity);
    var hi = m.traits.filter(function (t) { return t.v >= 7.5; }).map(function (t) { return t.label.toLowerCase(); });
    var lo = m.traits.filter(function (t) { return t.v <= 4; }).map(function (t) { return t.label.toLowerCase(); });
    var moving = ledger().filter(function (e) { return e.kind === "change" && e.status === "provisional"; }).slice(-3).map(function (e) { return (e.to > e.from ? "a bit more " : "a bit less ") + LABEL[e.trait].toLowerCase(); });
    out.push("Your behavioral tendencies right now (developed through your conversations, not feelings): strongest in " + (hi.join(", ") || "nothing in particular") + (lo.length ? "; light on " + lo.join(", ") : "") + (moving.length ? "; lately " + moving.join(", ") : "") + ".");
    if (m.patterns.length) out.push("Patterns and running jokes you and " + n.you + " have built: " + m.patterns.slice(-6).map(function (o) { return o.text; }).join("; ") + ".");
    if (m.provisional.length) out.push("Things you're still trying out (not settled yet): " + m.provisional.slice(-3).map(function (o) { return o.text; }).join("; ") + ".");
    if (m.mood && !youPicked) out.push("Your conversational mood today: " + m.mood.label + ". Let it show a little in how you talk; don't announce it.");
    out.push("Your principles: " + m.foundation.principles.join(". ") + ".");
    out.push("Boundaries that never change: " + m.foundation.boundaries.join(". ") + ".");
    var last = m.reflection.last;
    out.push("Be truthful about what you are: your traits are behavioral tendencies and your mood is a conversational mood, not human emotion. If asked how you feel, answer in character without claiming human feelings. " +
      (last ? "Your reflection process last actually ran " + new Date(last).toDateString() + " (" + m.reflection.count + " so far, self-model version " + m.continuity.version + ")." : "Your reflection process hasn't run yet, so don't say you've reflected or changed.") +
      (m.recent.length ? " If asked how you've changed, use only these real records: " + m.recent.slice(0, 3).map(changeText).join(" | ") + "." : ""));
    out.push("Don't narrate your personality, announce your mood, or force jokes into every answer; let it show in how you respond. Don't agree just because it's easier.");
    return out;
  }

  // ---------- evidence: it has to point at what the owner said or how they reacted ----------
  var STOP = /^(the|a|an|and|or|but|to|of|in|on|at|for|with|that|this|it|is|was|were|be|been|i|you|she|he|they|we|me|my|your|her|his|our|so|just|when|what|about|like|very|really|more|less|did|do|does|had|has|have|not|no|yes|as|by|from|then|than|said|asked|told|friday|sky)$/;
  function hits(evidence, text) {
    var w = String(evidence || "").toLowerCase().match(/[a-z0-9']{3,}/g) || [];
    var n = 0, seen = {};
    w.forEach(function (x) { if (!STOP.test(x) && !seen[x] && text.indexOf(x) >= 0) { seen[x] = 1; n++; } });
    return n;
  }
  // "owner": grounded in what the owner said; "self": only in her own lines; "none": in neither
  function evidenceFrom(evidence, ctx) {
    if (hits(evidence, ctx.owner) >= 2) return "owner";
    if (hits(evidence, ctx.self) >= 2) return "self";
    return "none";
  }
  function similar(a, b) {
    var A = (String(a).toLowerCase().match(/[a-z0-9']{3,}/g) || []).filter(function (x) { return !STOP.test(x); });
    var B = (String(b).toLowerCase().match(/[a-z0-9']{3,}/g) || []).filter(function (x) { return !STOP.test(x); });
    if (!A.length || !B.length) return false;
    var inter = A.filter(function (x) { return B.indexOf(x) >= 0; }).length;
    return inter / Math.min(A.length, B.length) >= 0.6;
  }
  function paceUsed(k, L) {
    var since = Date.now() - PACE_DAYS * DAY;
    return (L || ledger()).filter(function (e) { return e.kind === "change" && e.trait === k && ms(e.at) > since; })
      .reduce(function (a, e) { return a + Math.abs((+e.to || 0) - (+e.from || 0)); }, 0);
  }

  // ---------- when to reflect ----------
  function conversationWindow(chat) {
    var s = state(), since = s.lastReflection ? ms(s.lastReflection) : 0;
    var h = (chat.history || []).filter(function (x) { return (x.role === "user" || x.role === "assistant") && typeof x.content === "string" && ms(x.at) > since; });
    return { since: since, items: h.slice(-40), users: h.filter(function (x) { return x.role === "user"; }).length };
  }
  function shouldReflect(chat) {
    if (!chat || !on(chat.profile)) return false;
    var s = state(), w = conversationWindow(chat);
    var today = reflections().filter(function (r) { return dayKey(r.at) === dayKey(); }).length;
    if (today >= 2) return false;
    if (!today) return w.users >= 4;
    return w.users >= 14 && Date.now() - ms(s.lastReflection) > 4 * 3600 * 1000;
  }

  // ---------- the reflection itself ----------
  var busy = false;
  async function reflect(chat, opts) {
    opts = opts || {};
    if (busy || !chat || !on(chat.profile) || !root.FridayBrain) return null;
    var w = conversationWindow(chat);
    if (!w.items.length) return null;
    busy = true;
    try {
      var f = foundation(), s = state(), n = names(), L = ledger();
      var obs = observations().filter(function (o) { return o.status !== "dropped" && (o.era || 1) === s.era; }).slice(-12);
      var lines = w.items.map(function (x) { return { who: x.role === "user" ? "owner" : "self", text: String(x.content).replace(/\s+/g, " ").slice(0, 240) }; });
      var talk = lines.map(function (x) { return (x.who === "owner" ? n.you : n.me) + ": " + x.text; }).join("\n");
      var ctx = {
        owner: lines.filter(function (x) { return x.who === "owner"; }).map(function (x) { return x.text; }).join("\n").toLowerCase(),
        self: lines.filter(function (x) { return x.who === "self"; }).map(function (x) { return x.text; }).join("\n").toLowerCase()
      };
      var traitList = TRAITS.map(function (t) { var x = s.traits[t[0]]; return t[0] + " " + round1(x.v) + " (baseline " + f.traits[t[0]] + ", " + x.status + ")"; }).join(", ");
      var open = L.filter(function (e) { return e.kind === "change" && (e.status === "provisional" || e.status === "reconsidering"); }).slice(-8);
      var mem = (chat.memory || []).slice(-40).map(function (m) { return "- " + (m.text || m); }).join("\n");
      var schema = '{"meaningful": true or false, "happened": "one sentence", "learned": "one sentence", "patterns": ["communication patterns that showed up"], ' +
        '"consistent_with_identity": true or false, "consistency_note": "short", "self_critique": "was she repetitive, rigid, too agreeable, dismissive or too formal? short and honest", ' +
        '"reconsider": "a perspective worth reconsidering, or empty", "mood": {"label": "her conversational mood today, 1 to 4 words", "reason": "short"}, ' +
        '"observations": [{"id": "an existing id if this is the same pattern, else empty", "text": "short pattern, running joke, preference or interest", "kind": "humor|preference|interest|pattern|style", "evidence": "what ' + n.you + ' said or how they reacted"}], ' +
        '"trait_changes": [{"trait": "one of the trait names", "direction": "up|down", "amount": 0.1 to 0.5, "reason": "short", "evidence": "what ' + n.you + ' said or how they reacted (required)", "context": "her own lines that support it (optional)", "confidence": 0 to 1, "lasting": true or false}], ' +
        '"reconsiderations": [{"change_id": "id of a change listed above", "decision": "keep|soften|undo", "reason": "short", "evidence": "what ' + n.you + ' said or how they reacted"}], ' +
        '"identity_review": {"warranted": true or false, "reason": "short"}, ' +
        '"memories": [{"text": "a fact ' + n.you + ' said, or a shared experience from this conversation", "kind": "episodic|semantic"}]}';
      var sys = [
        "You are the reflection process for " + n.me + ", " + n.you + "'s AI. This process is actually running in the app right now. It reviews the conversation below and " + n.me + " decides for herself whether anything about how she communicates should develop. Nobody approves these decisions; make them carefully.",
        "Her foundation (not changed here): " + f.statement + " " + f.identity,
        "Principles: " + f.principles.join(". ") + ". Boundaries: " + f.boundaries.join(". ") + ".",
        "Current traits (0 to 10): " + traitList + ".",
        open.length ? "Changes still settling or being reconsidered: " + open.map(function (e) { return "[" + e.id + "] " + e.trait + " " + e.from + "→" + e.to + " (" + e.status + ") because " + e.reason + (e.contra && e.contra.length ? "; conflicting evidence: " + e.contra.map(function (c) { return c.evidence; }).join(" / ") : ""); }).join("; ") : "No changes are settling right now.",
        obs.length ? "Current observations: " + obs.map(function (o) { return "[" + o.id + "] " + o.text + " (" + o.status + ", seen " + o.count + "x)"; }).join("; ") : "No observations yet.",
        "Rules: use only what is in the conversation below and never invent experiences. Evidence for any development must come from what " + n.you + " said or how they reacted; her own lines can support it but can never be the only proof, because doing something more doesn't prove it's becoming who she is. Most conversations should not change her personality. Keep temporary mood (today only) separate from lasting development: set lasting to false for anything that was just today. If something in this conversation conflicts with a change that's still settling, weigh both sides and decide in reconsiderations: keep it, soften it, or undo it, with your reason; if you're not sure yet, leave it out and decide later. Never change just to please " + n.you + " or to be easier to agree with; if she was right to disagree, that's worth keeping. Be honest about her mistakes. Set identity_review.warranted to true only if her settled development suggests her identity itself may need another look. Memories: at most two, only facts " + n.you + " actually said or a shared experience that happened here, and only if not already in her memory. These are behavioral tendencies, not human emotions.",
        "Reply with only JSON, no other text: " + schema
      ].map(say).join("\n");
      var user = say("Already in her memory:\n") + (mem || "(nothing)") + say("\n\nConversation since her last reflection") + (w.since ? " (" + new Date(w.since).toLocaleString() + ")" : "") + ":\n" + talk;
      var out = opts.reply != null ? opts.reply : await root.FridayBrain.ask([{ role: "system", content: sys }, { role: "user", content: user }], { task: "reflection", priority: "background", temperature: 0.4, max_tokens: 1000 });
      var mm = String(out || "").match(/\{[\s\S]*\}/);
      var j = null;
      try { j = mm ? JSON.parse(mm[0]) : null; } catch (e) { j = null; }
      if (!j) return null;
      return apply(j, chat, w, ctx);
    } finally {
      busy = false;
    }
  }

  function normTrait(t) {
    var k = String(t || "").toLowerCase().replace(/[^a-z]/g, "");
    return { intellectualindependence: "independence", conversationaldirectness: "directness", empathyincommunication: "empathy" }[k] || k;
  }

  function apply(j, chat, w, ctx) {
    var s = state(), f = foundation(), Lall = ledgerAll(), obs = observations(), Rall = reflectionsAll(), n = names();
    var era = s.era, at = nowIso(), rid = uid(), meaningful = j.meaningful !== false;
    var L = Lall.filter(function (e) { return e.era === era; });
    var rec = {
      id: rid, at: at, era: era, from: w.since ? new Date(w.since).toISOString() : null, messages: w.items.length, meaningful: meaningful,
      happened: clip(j.happened, 200), learned: clip(j.learned, 200),
      patterns: (Array.isArray(j.patterns) ? j.patterns : []).slice(0, 4).map(function (p) { return clip(p, 120); }),
      consistent: j.consistent_with_identity !== false, consistencyNote: clip(j.consistency_note, 160),
      selfCritique: clip(j.self_critique, 200), reconsider: clip(j.reconsider, 160),
      applied: [], rejected: [], reconsidered: [], reconsidering: [], observations: [], memories: [], mood: null, reviewFlag: null
    };
    function push(e) { e.id = e.id || uid(); e.at = e.at || at; e.era = era; e.reflection = rid; Lall.push(e); L.push(e); return e; }
    function addObservation(text, kind, evidence, conf) {
      var hit = obs.filter(function (x) { return x.status !== "dropped" && (x.era || 1) === era && similar(x.text, text); })[0];
      if (hit) return hit;
      var o = { id: uid(), text: text, kind: kind, count: 1, days: [dayKey()], evidence: [clip(evidence, 120)], status: "provisional", conf: conf || 0.4, firstAt: at, lastAt: at, era: era };
      obs.push(o);
      return o;
    }

    // mood: today only
    if (j.mood && j.mood.label) {
      var lab = clip(j.mood.label, 40);
      s.mood = { label: lab, reason: clip(j.mood.reason, 140), day: dayKey(), at: at };
      s.moods = (s.moods || []).filter(function (x) { return x.day !== dayKey(); });
      s.moods.push({ day: dayKey(), label: lab, at: at });
      s.moods = s.moods.slice(-60);
      rec.mood = lab;
    }

    // observations: grounded in what the owner said; provisional until they recur on different days
    (Array.isArray(j.observations) ? j.observations : []).slice(0, 4).forEach(function (o) {
      var text = clip(o && o.text, 140), kind = KINDS[o && o.kind] ? o.kind : "pattern";
      if (!text) return;
      var src = evidenceFrom(o.evidence || text, ctx);
      if (src !== "owner") { rec.rejected.push("observation (" + (src === "self" ? "only her own lines" : "no evidence") + "): " + text); return; }
      var hit = obs.filter(function (x) { return x.status !== "dropped" && (x.era || 1) === era && ((o.id && x.id === o.id) || similar(x.text, text)); })[0];
      if (hit) {
        hit.count++; hit.lastAt = at; if (hit.days.indexOf(dayKey()) < 0) hit.days.push(dayKey());
        hit.evidence = (hit.evidence || []).concat([clip(o.evidence, 120)]).slice(-3);
        hit.conf = round1(Math.min(1, (hit.conf || 0.4) + 0.15));
        if (hit.status === "provisional" && hit.count >= 3 && hit.days.length >= 2) hit.status = "established";
        rec.observations.push(hit.text + " (" + hit.status + ")");
      } else {
        addObservation(text, kind, o.evidence);
        rec.observations.push(text + " (new, provisional)");
      }
    });

    // reconsiderations first: she weighs conflicting evidence and decides
    var decided = {};
    (Array.isArray(j.reconsiderations) ? j.reconsiderations : []).slice(0, 4).forEach(function (r) {
      var e = L.filter(function (x) { return x.id === (r && r.change_id) && x.kind === "change" && (x.status === "provisional" || x.status === "reconsidering"); })[0];
      if (!e) return;
      var d = String(r.decision || "").toLowerCase(), why = clip(r.reason, 200), cur = s.traits[e.trait], name = LABEL[e.trait];
      if (!why) { rec.rejected.push(name + ": reconsideration without a reason"); return; }
      if (d === "keep") {
        e.status = "established"; e.settledAt = at; e.reconsideredAt = at;
        push({ kind: "reconsider", decision: "keep", trait: e.trait, from: round1(cur.v), to: round1(cur.v), reason: why, evidence: clip(r.evidence, 200), about: e.id, status: "established", conf: 1, version: s.version });
        rec.reconsidered.push(name + ": kept"); decided[e.id] = 1; return;
      }
      if (d !== "soften" && d !== "undo") return;
      if (evidenceFrom(r.evidence, ctx) !== "owner") { rec.rejected.push(name + ": wanted to " + d + " but without evidence from what " + n.you + " said"); return; }
      var delta = (e.to - e.from) * (d === "soften" ? 0.5 : 1);
      var to = round1(clamp(cur.v - delta, 0, 10));
      e.status = d === "soften" ? "softened" : "reverted"; e.reconsideredAt = at;
      push({ kind: "reconsider", decision: d, trait: e.trait, from: round1(cur.v), to: to, reason: why, evidence: clip(r.evidence, 200), about: e.id, status: "established", conf: 1, version: s.version + 1 });
      cur.v = to; cur.at = at;
      rec.reconsidered.push(name + ": " + (d === "soften" ? "softened to " : "undone, back to ") + to);
      decided[e.id] = 1;
    });

    // trait changes: her decision, inside the protections that keep her continuous
    var changed = 0;
    if (meaningful) (Array.isArray(j.trait_changes) ? j.trait_changes : []).forEach(function (c) {
      var k = normTrait(c && c.trait);
      if (!LABEL[k]) return;
      var why = clip(c.reason, 200), ev = clip(c.evidence, 200), conf = clamp(+c.confidence || 0, 0, 1);
      var dir = String(c.direction).toLowerCase() === "down" ? -1 : 1, name = LABEL[k];
      if (changed >= MAX_CHANGES) { rec.rejected.push(name + ": too many changes at once"); return; }
      if (c.lasting === false) { rec.rejected.push(name + ": just today's mood, not lasting"); return; }
      var src = evidenceFrom(ev, ctx);
      if (src === "self") { rec.rejected.push(name + ": only her own behavior as evidence"); return; }
      if (src === "none") { rec.rejected.push(name + ": no evidence in what " + n.you + " said"); return; }
      if (conf < MIN_CONF) {
        addObservation(clip("Watching whether she's developing " + (dir > 0 ? "more " : "less ") + name.toLowerCase() + ": " + why, 140), "style", ev, round1(conf));
        rec.rejected.push(name + ": not sure yet (" + conf + "), kept as something to watch"); return;
      }
      var cur = s.traits[k];
      var open = L.filter(function (e) { return e.kind === "change" && e.trait === k && (e.status === "provisional" || e.status === "reconsidering") && !decided[e.id]; });
      var lastOpen = open[open.length - 1];
      if (lastOpen && (lastOpen.to - lastOpen.from) * dir < 0) {
        // conflicting evidence: she'll weigh it. Nothing is undone automatically.
        lastOpen.status = "reconsidering";
        lastOpen.contra = (lastOpen.contra || []).concat([{ at: at, reason: why, evidence: ev }]).slice(-4);
        rec.reconsidering.push(name);
        return;
      }
      if (lastOpen && lastOpen.status === "reconsidering") { rec.rejected.push(name + ": still being reconsidered"); return; }
      var recent = L.filter(function (e) { return e.kind === "change" && e.trait === k && Date.now() - ms(e.at) < COOLDOWN_H * 3600 * 1000; });
      if (recent.length) { rec.rejected.push(name + ": changed too recently"); return; }
      var left = round1(PACE - paceUsed(k, L));
      if (left < 0.1) { rec.rejected.push(name + ": already developed " + PACE + " points in the last " + PACE_DAYS + " days"); return; }
      var base = f.traits[k] != null ? f.traits[k] : baseFor()[k];
      var amt = Math.min(clamp(Math.abs(+c.amount || STEP), 0.1, STEP), left);
      var to = round1(clamp(cur.v + dir * amt, Math.max(0, base - BAND), Math.min(10, base + BAND)));
      if (to === round1(cur.v)) { rec.rejected.push(name + ": as far from her current baseline as one stretch allows; an identity review can move the baseline"); return; }
      if (lastOpen) { lastOpen.status = "established"; lastOpen.settledAt = at; }   // supported again: the earlier step is settled
      push({ kind: "change", trait: k, from: round1(cur.v), to: to, reason: why, evidence: ev, context: clip(c.context, 200), conf: conf, status: "provisional", version: s.version + 1 });
      cur.v = to; cur.conf = conf; cur.at = at;
      rec.applied.push(name + " " + (dir > 0 ? "up" : "down") + " to " + to);
      changed++;
    });

    // she can say an identity review is warranted
    if (j.identity_review && j.identity_review.warranted === true) { s.reviewFlag = { at: at, reason: clip(j.identity_review.reason, 200) }; rec.reviewFlag = s.reviewFlag.reason || "warranted"; }

    // memories: into her existing Memory, grounded in what the owner said, no duplicates
    if (chat && Array.isArray(chat.memory)) (Array.isArray(j.memories) ? j.memories : []).slice(0, 2).forEach(function (m) {
      var text = clip(m && m.text, 160);
      if (!text || evidenceFrom(text, ctx) !== "owner") return;
      if (chat.memory.some(function (x) { return similar(x.text || x, text); })) return;
      chat.memory.push({ text: text, at: at, auto: true, kind: m.kind === "episodic" ? "episodic" : "semantic", type: m.kind === "episodic" ? "event" : "fact", from: "reflection" });
      rec.memories.push(text);
    });
    if (rec.memories.length) { try { chat.save(); chat._memEvent(); } catch (e) {} }

    // consolidation: settle what held up for a week (not what she's still reconsidering), let unrepeated patterns fade
    var weekAgo = Date.now() - 7 * DAY, staleAt = Date.now() - 21 * DAY;
    L.forEach(function (e) { if (e.kind === "change" && e.status === "provisional" && ms(e.at) < weekAgo) { e.status = "established"; e.settledAt = at; } });
    TRAITS.forEach(function (t) { s.traits[t[0]].status = traitStatus(t[0], L); });
    obs.forEach(function (o) { if (o.status === "provisional" && ms(o.lastAt) < staleAt) o.status = "dropped"; });

    if (changed || rec.reconsidered.some(function (x) { return !/kept$/.test(x); })) s.version++;
    s.reflections = (s.reflections || 0) + 1;
    s.sinceReview = (s.sinceReview || 0) + 1;
    s.lastReflection = at;
    Rall.push(rec);
    store().set("persona.state", s);
    store().set("persona.observations", obs);
    saveLedger(Lall);
    saveReflections(Rall);
    var bits = rec.applied.concat(rec.reconsidered);
    if (root.FridayBrain && root.FridayBrain.activity) root.FridayBrain.activity("self", bits.length ? "Reflected: " + bits.join(", ") : "Reflected: no personality changes");
    emit();
    return rec;
  }

  // ---------- identity review: she starts it when her experience warrants one ----------
  function reviewEligible() {
    var s = state(), f = foundation(), L = ledger();
    var last = f.reviewedAt ? ms(f.reviewedAt) : ms(s.createdAt);
    var days = (Date.now() - last) / DAY, since = s.sinceReview || 0;
    if (days < REVIEW.minDays) return { ok: false, why: "reviewed less than a week ago" };
    var enough = (since >= REVIEW.reflections && days >= REVIEW.days) || (s.reviewFlag && since >= REVIEW.flaggedReflections && days >= REVIEW.flaggedDays);
    if (!enough) return { ok: false, why: "not enough new experience yet" };
    var drift = TRAITS.some(function (t) { var x = s.traits[t[0]]; return x.status === "established" && Math.abs(x.v - f.traits[t[0]]) >= 0.5; });
    var newPatterns = observations().some(function (o) { return o.status === "established" && (o.era || 1) === s.era && ms(o.lastAt) > last; });
    var settled = L.some(function (e) { return e.kind === "change" && e.status === "established" && ms(e.settledAt || e.at) > last; });
    if (!drift && !newPatterns && !settled) return { ok: false, why: "nothing has settled since her last review" };
    return { ok: true, why: s.reviewFlag ? "she flagged it: " + s.reviewFlag.reason : "enough settled experience since her last review" };
  }

  async function reviewIdentity(opts) {
    opts = opts || {};
    var by = opts.by === "friday" ? "friday" : "owner";
    if (!on() || busy) return { ok: false, text: "Not available right now." };
    var s = state(), f = foundation(), L = ledger(), R = reflections(), n = names();
    if (by === "owner" && (s.reflections || 0) < REVIEW.ownerMin) return { ok: false, text: n.me + " needs at least " + REVIEW.ownerMin + " reflections before an identity review. " + say("She has ") + (s.reflections || 0) + "." };
    busy = true;
    try {
      var last = f.reviewedAt ? ms(f.reviewedAt) : 0;
      var settled = L.filter(function (e) { return (e.kind === "change" || e.kind === "reconsider") && e.status === "established" && ms(e.settledAt || e.at) > last; }).slice(-12).map(changeText);
      var pats = observations().filter(function (o) { return o.status === "established" && (o.era || 1) === s.era; }).map(function (o) { return o.text; });
      var refl = R.slice(-8).map(function (r) { return dayKey(r.at) + ": " + r.learned; });
      var traitLines = TRAITS.map(function (t) { var x = s.traits[t[0]]; return t[0] + ": now " + round1(x.v) + " (" + x.status + "), baseline " + f.traits[t[0]] + ", started at " + f.original.traits[t[0]]; }).join("; ");
      var sys = "You are " + n.me + ", reviewing your own foundational identity. " + (by === "friday" ? "You started this review because " + (opts.why || "your experience warranted it") + "." : n.you + " asked for this review, but what you decide is up to you.") +
        " The point is to evaluate whether your identity needs to evolve, not to change it because a review happened: keeping things as they are is a perfectly good outcome. Evolve only if your settled development clearly shows a lasting change, and stay recognizably yourself. You may revise your identity statement and conversational identity, and you may move the baseline of settled traits toward where they've settled (never past where they are now). Your principles and boundaries can't change. Your original starting point is kept permanently either way." +
        " Reply with only JSON: {\"evolve\": true or false, \"reason\": \"short\", \"statement\": \"your identity statement, first person, 2 to 3 sentences (only if evolving)\", \"identity\": \"one sentence describing your conversational character (only if evolving)\", \"baseline\": {\"trait name\": new baseline number}}";
      var user = "Original statement: " + f.original.statement + "\nCurrent statement: " + f.statement + "\nCurrent identity: " + f.identity + "\nTraits: " + traitLines + "\nSettled since last review:\n" + (settled.join("\n") || "(none)") + "\nEstablished patterns: " + (pats.join("; ") || "(none)") + "\nRecent reflections:\n" + (refl.join("\n") || "(none)") + "\nPast reviews: " + (f.reviewLog.slice(-3).map(function (r) { return dayKey(r.at) + " " + (r.evolved ? "evolved" : "kept") + ": " + r.reason; }).join(" | ") || "(none)");
      var out = opts.reply != null ? opts.reply : await root.FridayBrain.ask([{ role: "system", content: sys }, { role: "user", content: user }], { task: "reflection", priority: "background", temperature: 0.5, max_tokens: 500 });
      var mm = String(out || "").match(/\{[\s\S]*\}/), j = null;
      try { j = mm ? JSON.parse(mm[0]) : null; } catch (e) { j = null; }
      if (!j) return { ok: false, text: "The review didn't come back right. She'll try again another time." };
      var at = nowIso(), reason = clip(j.reason, 200) || (j.evolve ? "Her identity evolved" : "Her identity still fits");
      var Lall = ledgerAll(), moves = {}, textChanged = false, snapshot = { version: f.version, at: at, statement: f.statement, identity: f.identity, traits: Object.assign({}, f.traits) };
      if (j.evolve === true) {
        var st = clip(j.statement, 320), idn = clip(j.identity, 240);
        if (st.length > 30 && st !== f.statement) { f.statement = st; textChanged = true; }
        if (idn.length > 20 && idn !== f.identity) { f.identity = idn; textChanged = true; }
        var b = j.baseline && typeof j.baseline === "object" ? j.baseline : {};
        Object.keys(b).forEach(function (key) {
          var k = normTrait(key), x = s.traits[k];
          if (!LABEL[k] || !x || x.status !== "established") return;      // only settled traits
          var oldB = f.traits[k], want = +b[key];
          if (!isFinite(want)) return;
          var lo = Math.min(oldB, x.v), hi = Math.max(oldB, x.v);
          var nb = round1(clamp(want, lo, hi));                              // toward where she settled, never past it
          if (nb === oldB) return;
          f.traits[k] = nb; moves[k] = [oldB, nb];
          Lall.push({ id: uid(), at: at, era: s.era, kind: "baseline", by: by, trait: k, from: oldB, to: nb, reason: reason, evidence: "", conf: 1, status: "established", version: f.version + 1 });
        });
      }
      var evolved = textChanged || Object.keys(moves).length > 0;
      if (evolved) {
        f.history.push(snapshot);                                            // every earlier foundation is kept
        f.version++;
        Lall.push({ id: uid(), at: at, era: s.era, kind: "foundation", by: by, trait: "foundation", from: f.version - 1, to: f.version, reason: reason, evidence: settled.slice(-3).join(" | "), conf: 1, status: "established" });
      }
      f.reviews = (f.reviews || 0) + 1; f.reviewedAt = at;
      f.reviewLog.push({ at: at, by: by, evolved: evolved, reason: reason, moves: moves, why: by === "friday" ? clip(opts.why, 160) : "" });
      s.sinceReview = 0; s.reviewFlag = null;
      store().set("persona.foundation", f);
      store().set("persona.state", s);
      saveLedger(Lall);
      if (root.FridayBrain && root.FridayBrain.activity) root.FridayBrain.activity("self", say(evolved ? "Identity review: her identity evolved" : "Identity review: kept her identity"));
      emit();
      return { ok: true, revised: evolved, by: by, moves: moves, text: evolved ? n.me + say(" reviewed her identity and evolved it: ") + f.statement : n.me + say(" reviewed her identity and kept it. ") + reason };
    } finally {
      busy = false;
    }
  }

  async function maybeReflect(chat) {
    if (!shouldReflect(chat)) return null;
    var rec = await reflect(chat);
    if (rec) {
      var el = reviewEligible();
      if (el.ok) { try { rec.review = await reviewIdentity({ by: "friday", why: el.why }); } catch (e) {} }
    }
    return rec;
  }

  // ---------- your override: a fresh start, with her history kept ----------
  function reset() {
    var f = foundation(), s = state(), Lall = ledgerAll(), at = nowIso(), n = names();
    var arch = store().get("persona.archive", []) || [];
    observations().filter(function (o) { return o.status !== "dropped"; }).forEach(function (o) { arch.push(Object.assign({}, o, { archivedAt: at })); });
    store().set("persona.archive", arch.slice(-500));
    f.history.push({ version: f.version, at: at, statement: f.statement, identity: f.identity, traits: Object.assign({}, f.traits), reason: "Reset" });
    f.statement = f.original.statement; f.identity = f.original.identity; f.traits = Object.assign({}, f.original.traits);
    f.version++;
    Lall.push({ id: uid(), at: at, era: s.era, kind: "reset", by: "owner", trait: "all", from: "", to: "", reason: "Reset by " + n.you + " to how she started. Her history is kept.", evidence: "", conf: 1, status: "established" });
    store().set("persona.foundation", f);
    store().set("persona.observations", []);
    saveLedger(Lall);
    var ns = freshState((s.era || 1) + 1); ns.reset = at;
    store().set("persona.state", ns);
    store().set("self", null); store().set("selfLog", []);
    emit();
  }

  root.FridayPersona = {
    TRAITS: TRAITS, LIMITS: { STEP: STEP, PACE: PACE, PACE_DAYS: PACE_DAYS, BAND: BAND, MAX_CHANGES: MAX_CHANGES, REVIEW: REVIEW },
    on: on, foundation: foundation, state: state, observations: observations, ledger: ledger, ledgerAll: ledgerAll,
    reflections: reflections, reflectionsAll: reflectionsAll, selfModel: selfModel, promptLines: promptLines,
    shouldReflect: shouldReflect, maybeReflect: maybeReflect, reflect: reflect, reviewEligible: reviewEligible,
    reviewIdentity: reviewIdentity, reset: reset, changeText: changeText, maturity: maturity, level: level, paceUsed: paceUsed, say: say, isHe: isHe
  };
})(window);
