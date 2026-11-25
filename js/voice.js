/* Tap-to-talk: Groq Whisper with webkitSpeechRecognition fallback. Speaking: Groq AI voices with
   automatic fallback to iPhone voices, a speaking queue for streamed replies, and talk-over. */
(function (root) {
  "use strict";

  function preferredMime() {
    var types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/aac",
      "audio/mpeg"
    ];
    if (!window.MediaRecorder) return "";
    for (var i = 0; i < types.length; i++) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(types[i])) return types[i];
    }
    return "";
  }

  /* Inside the app, iOS often ignores which Web Speech voice is picked, so every
     iPhone voice sounds the same. The TextToSpeech add-on talks to iOS directly. */
  function nativeTTS() {
    var c = root.Capacitor;
    return c && c.isNativePlatform && c.isNativePlatform() && c.Plugins && c.Plugins.TextToSpeech ? c.Plugins.TextToSpeech : null;
  }
  var NATIVE_VOICES = null;
  function loadNativeVoices() {
    var T = nativeTTS();
    if (!T || NATIVE_VOICES) return;
    try {
      T.getSupportedVoices().then(function (r) {
        var list = (r && r.voices) || [];
        NATIVE_VOICES = list.map(function (v, i) {
          return { name: v.name || ("Voice " + (i + 1)), lang: v.lang || "", voiceURI: v.voiceURI || ("native:" + i), localService: true, "default": !!v["default"], _index: i, _native: true };
        });
        try { root.dispatchEvent(new CustomEvent("friday:voices")); } catch (e) {}
      }, function () {});
    } catch (e) {}
  }
  FridayVoice.hasNativeVoices = function () { return !!(NATIVE_VOICES && NATIVE_VOICES.length); };

  // Why the last AI voice request failed, in plain words.
  function aiVoiceReason() {
    var e = root.FridayStorage.get("aiVoiceError", null);
    if (!e) return "";
    var m = String(e.msg || "");
    if (e.provider === "gemini") return geminiReason(e, m);
    if (e.status === 0) return "Couldn't reach Groq for the AI voice. Check the internet and try again.";
    if (e.status === 401) return "Groq didn't accept your key. Check it in Settings, under Groq API key.";
    if (/terms/i.test(m)) return "Groq needs a one-time OK before AI voices work. Open console.groq.com/playground?model=canopylabs/orpheus-v1-english, sign in, and accept the terms. Then tap Test again.";
    if (e.status === 429 && /per day|daily|rpd|tpd/i.test(m)) return "AI voices used up today's free allowance. They'll be back tomorrow. Until then she uses the iPhone voice.";
    if (e.status === 429) return "AI voices are busy right now. Try again in a few minutes.";
    if (e.status === 404 || /model/i.test(m) && /not|exist|decommission/i.test(m)) return "Groq doesn't offer that AI voice right now.";
    if (e.status === "audio") return "The phone didn't let the AI voice play. Tap the play button again.";
    return "Groq said no to the AI voice" + (m ? ": " + m.slice(0, 140) : ".");
  }
  // 3.5.1: Gemini voice problems get their own plain-words reasons (they used to be blamed on Groq).
  function geminiReason(e, m) {
    var raw = m.replace(/^Gemini voice:\s*/, "");
    try { var j = JSON.parse(raw); raw = (j.error && (j.error.message || j.error.status)) || raw; } catch (x) {}
    raw = String(raw).replace(/\s+/g, " ").slice(0, 260);
    if (e.status === "nokey") return "Gemini voices need a Gemini key. Add one in Settings → Brains (Paste a key), then tap Test again.";
    if (e.status === 0) return "Couldn't reach Google for the Gemini voice. Check the internet and try again." + (raw ? " (" + raw + ")" : "");
    if (e.status === 401 || e.status === 403) {
      if (/not been used|disabled|enable/i.test(raw)) return "Your Gemini key works, but its Google project has the Gemini API turned off. Make a new key at aistudio.google.com/apikey and paste it in Settings → Brains. (" + raw + ")";
      return "Google didn't accept the Gemini key for voices. Make a fresh key at aistudio.google.com/apikey and paste it in Settings → Brains. (" + raw + ")";
    }
    if (e.status === 429) return "Gemini voices are out of free uses for now. They'll come back on their own; until then the other voice is used. (" + raw + ")";
    if (e.status === 404) return "Google didn't offer any of the Gemini voice models to this key. (" + raw + ")";
    if (e.status === 400) return "Google turned down the Gemini voice request: " + raw;
    return "Gemini voice error " + e.status + (raw ? ": " + raw : ".");
  }
  FridayVoice.aiVoiceReason = aiVoiceReason;

  /* ---------- Are you done talking? ----------
     Like ChatGPT's voice mode, she judges from your words, not only from silence.
     "done" = sounds finished, answer fast. "more" = sounds cut off, wait longer. "unsure" = in between. */
  var FILLERS = { um: 1, umm: 1, uh: 1, uhh: 1, uhm: 1, er: 1, erm: 1, hmm: 1, hm: 1, so: 1, like: 1 };
  var TRAILERS = { and: 1, but: 1, or: 1, because: 1, cause: 1, cuz: 1, the: 1, a: 1, an: 1, to: 1, "for": 1, "with": 1, of: 1,
    at: 1, my: 1, your: 1, our: 1, their: 1, his: 1, her: 1, from: 1, into: 1, than: 1, as: 1, by: 1, "if": 1, plus: 1, also: 1,
    whether: 1, which: 1, unless: 1, until: 1, although: 1, though: 1, some: 1, any: 1, every: 1, this: 1, these: 1, those: 1 };
  var SHORT_DONE = /^(yes|yeah|yep|yup|no|nope|nah|ok|okay|sure|thanks|thank you|thank you so much|stop|cancel|never mind|nevermind|good night|good morning|good afternoon|good evening|got it|perfect|cool|nice|awesome|that's it|that's all|nothing|i'm good|all good|bye|goodbye|see you|love you)$/;
  var MORE_PATTERNS = [
    /^(set|start|make|put)( me)?( a| an| the)? (timer|alarm|reminder)( for| at| to| in)?$/,
    /^remind me( to| about| at| in| that)?$/,
    /^(text|message|tell|ask|email)( \S+)?( saying| that| to| if| a| an)?$/,
    /^(add|put)( .+ (to|on|in))?( my| the)?$/,
    /^(what|what's|whats|how|who|where|when|why|which|can you|could you|will you|would you|do you|is there|are there|tell me|show me|let me|i want|i need|i want to|i need to|i was|i think|wait|hold on|actually)$/,
    /^(turn|switch)( on| off)?( the)?$/,
    /^(set|dim|change)( the)?( \S+)?( lights?)?( to)?$/,
    /^(hey |hi |ok |okay |yo )?(friday|jarvis|reed)$/
  ];
  function turnWords(text) {
    return String(text || "").toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' %]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function judgeTurn(text) {
    var raw = String(text || "").trim();
    var w = turnWords(raw);
    if (!w) return "unsure";
    var words = w.split(" ");
    var last = words[words.length - 1];
    if (/(\.\.\.|…|,|;|:|-|—)$/.test(raw)) return "more";
    if (FILLERS[last]) return "more";
    if (SHORT_DONE.test(w)) return "done";
    if (/\?["')]*$/.test(raw) && !TRAILERS[last]) return "done";
    for (var i = 0; i < MORE_PATTERNS.length; i++) if (MORE_PATTERNS[i].test(w)) return "more";
    if (TRAILERS[last]) return "more";
    if (/[?!.]$/.test(raw) && words.length >= 2) return "done";
    if (/\b(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|forty five|sixty|half an?)\s(seconds?|secs?|minutes?|mins?|hours?|hrs?)$/.test(w)) return "done";
    if (/(\d+ ?(%|percent)|lights? (on|off)|(on|off)$)/.test(w) && words.length >= 2) return "done";
    if (/^(what|what's|whats|how|who|where|when|why|which|is|are|can|could|will|would|do|does|did|should)\b/.test(w) && words.length >= 3) return "done";
    if (/^(play|pause|open|call|turn|start|stop|cancel|show|read|check|run|lock|unlock|good night)\b/.test(w) && words.length >= 2) return "done";
    return "unsure";
  }
  // How long to wait after your last word, by the Talk time setting (like ChatGPT's "eagerness").
  var TURN_WAIT = {
    "short": { done: 350, unsure: 800, more: 2000 },
    normal: { done: 550, unsure: 1300, more: 2800 },
    "long": { done: 900, unsure: 2000, more: 4000 }
  };
  var CHECK_AT = { "short": 400, normal: 550, "long": 750 };
  function turnWait(verdict, talkTime) {
    var t = TURN_WAIT[talkTime] || TURN_WAIT.normal;
    return t[verdict] || t.unsure;
  }
  FridayVoice.judgeTurn = judgeTurn;
  FridayVoice.turnWait = turnWait;

  /* Text as it should be said out loud: no symbols, links or emojis read like a robot. */
  function speakable(t) {
    return String(t || "")
      .replace(/\bF\.\s?R\.\s?I\.\s?D\.\s?A\.\s?Y\b\.?/gi, "Friday")   // her written name is said "Friday"
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
      .replace(/(\d)\s*%/g, "$1 percent")
      .replace(/(\d)\s*°\s*F\b/g, "$1 degrees")
      .replace(/(\d)\s*°\s*C\b/g, "$1 degrees Celsius")
      .replace(/(\d)\s*°/g, "$1 degrees")
      .replace(/\s&\s/g, " and ")
      .replace(/\be\.g\.,?/gi, "for example")
      .replace(/\bi\.e\.,?/gi, "that is")
      .replace(/\betc\./gi, "and so on")
      .replace(/\bvs\.?(?=\s)/gi, "versus")
      .replace(/[*_#`~>|]/g, "")
      .replace(/\s*[—–]\s*/g, ", ")
      .replace(/\s*\(([^)]*)\)/g, ", $1,")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.!?])/g, "$1")
      .replace(/,([.!?])/g, "$1")
      .replace(/,\s*,/g, ",")
      .replace(/,\s*$/, ".")
      .replace(/^[,\s]+/, "")
      .trim();
  }
  FridayVoice.speakable = speakable;

  /* ---------- Names she should hear right ("Batsie", not "Patsy") ---------- */
  function cleanName(n) { return String(n || "").replace(/[^A-Za-z' -]+/g, " ").replace(/\s+/g, " ").trim(); }
  // core = only the names that matter most (you, your partner, the assistants): used for fixing mishearings.
  // Without core, contacts are included too: used as hints for the listener.
  function knownNames(core) {
    var out = [], seen = {};
    function add(n) {
      n = cleanName(n);
      if (n.length < 2) return;
      // "DADDY!!" is said "Daddy"
      if (n === n.toUpperCase()) n = n.charAt(0) + n.slice(1).toLowerCase();
      var k = n.toLowerCase();
      if (!seen[k]) { seen[k] = 1; out.push(n); }
    }
    try {
      var prof = root.FRIDAY_CONFIG.getProfile();
      [prof.ownerName, prof.assistantName, prof.greetingName, prof.daddyLabel].forEach(add);
      if (root.FridayExtras && root.FridayExtras.partnerCfg) {
        var pc = root.FridayExtras.partnerCfg(prof);
        (pc.names || []).forEach(add); add(pc.contact);
      }
      ["Friday", "Jarvis", "Reed"].forEach(add);
    } catch (e) {}
    if (!core) { try { if (root.FridayNative) root.FridayNative.contacts.names().slice(0, 80).forEach(add); } catch (e2) {} }
    return out;
  }
  FridayVoice.nameHints = knownNames;
  var START_SWAP = { b: "p", p: "b", d: "t", t: "d", g: "k", k: "g", c: "k", v: "f", f: "v", j: "g", s: "z", z: "s" };
  var COMMON = {};
  ("patty pets bets party petty tasty ski fry belly jelly silly bully berry merry carry marry sorry happy money honey funny ready heavy every early worry " +
   "hurry story pretty lady baby body buddy candy city easy empty fifty forty sixty thirty twenty ninety seventy eighty coffee movie cookie rookie " +
   "selfie hoodie zombie bestie auntie sweetie cutie smoothie batty daisy friday daily dairy diary fairy").split(" ").forEach(function (w) { COMMON[w] = 1; });
  // Ways speech recognition tends to mishear a name: first sound swapped (b/p, d/t...),
  // a different ending (-ie / -y / -ey / -ee / -i), the first vowel changed, or split in two.
  function soundAlikes(name) {
    var n = String(name || "").toLowerCase();
    if (n.length < 5 || !/^[a-z]+$/.test(n)) return [];
    var stems = [n], ends = [""];
    var m = n.match(/^(.*?)(ie|ey|ee|y|i)$/);
    if (m && m[1].length >= 3) { stems = [m[1]]; ends = ["ie", "ey", "ee", "y", "i", "ea"]; }
    var heads = [];
    stems.forEach(function (st) {
      heads.push(st);
      if (START_SWAP[st[0]]) heads.push(START_SWAP[st[0]] + st.slice(1));
    });
    heads.slice().forEach(function (h) {
      var vm = h.match(/^([^aeiou]*)([aeiou])(.*)$/);
      if (vm) { var alt = { a: "e", e: "a", i: "e", o: "u", u: "o" }[vm[2]]; if (alt) heads.push(vm[1] + alt + vm[3]); }
    });
    var out = [];
    heads.forEach(function (h) { ends.forEach(function (e) { out.push(h + e); }); });
    if (m && m[1].length >= 3) { out.push(m[1] + " e"); out.push(m[1].slice(0, -1) + " see"); }
    return out.filter(function (v, i) { return v !== n && out.indexOf(v) === i && !COMMON[v]; });
  }
  FridayVoice.soundAlikes = soundAlikes;
  var _fixCache = { key: "", list: [] };
  function fixNames(text) {
    var t = String(text || "");
    if (!t) return t;
    var names = knownNames(true);
    var all = knownNames();
    var key = all.join("|");
    if (_fixCache.key !== key) {
      var known = {};
      all.forEach(function (n) { n.toLowerCase().split(" ").forEach(function (w) { known[w] = 1; }); known[n.toLowerCase()] = 1; });
      var list = [];
      names.forEach(function (n) {
        var first = n.split(" ")[0];
        soundAlikes(first).forEach(function (v) {
          if (known[v]) return; // a real contact with that name stays as it is
          list.push({ re: new RegExp("\\b" + v.replace(/ /g, "\\s+") + "\\b", "gi"), to: first });
        });
      });
      _fixCache = { key: key, list: list };
    }
    _fixCache.list.forEach(function (x) { t = t.replace(x.re, x.to); });
    return t;
  }
  FridayVoice.fixNames = fixNames;

  /* Live listening: the iPhone's own speech recognition (Friday's add-on). */
  function nativeListen() {
    var c = root.Capacitor;
    return c && c.isNativePlatform && c.isNativePlatform() && c.Plugins && c.Plugins.FridayListen ? c.Plugins.FridayListen : null;
  }
  FridayVoice.liveAvailable = function () { return !!nativeListen(); };

  function FridayVoice(opts) {
    this.opts = opts || {};
    this.listening = false;
    this.speaking = false;
    this.volume = 0;
    this._stream = null;
    this._rec = null;
    this._chunks = [];
    this._ctx = null;
    this._analyser = null;
    this._data = null;
    this._raf = 0;
    this._peakHold = 0;
    this._lastPeak = 0;
    this._utterance = null;
    this.voiceURI = (root.FridayStorage.get("settings", {}).voiceURI) || "";
    this._onVolume = this.opts.onVolume || function () {};
    this._onSyllable = this.opts.onSyllable || function () {};
    this._onState = this.opts.onState || function () {};
    loadNativeVoices();
  }

  FridayVoice.prototype.listVoices = function () {
    if (NATIVE_VOICES && NATIVE_VOICES.length) return NATIVE_VOICES;
    try { return speechSynthesis.getVoices() || []; } catch (e) { return []; }
  };

  // iPhone only lets sound start from a tap. Call this on a tap so later audio can play.
  FridayVoice.prototype.unlockAudio = function () {
    try {
      var ctx = this._outCtx();
      if (ctx.state === "running" && this._unlocked) return;
      this._unlocked = true;
      if (ctx.state !== "running" && ctx.resume) ctx.resume();
      var b = ctx.createBuffer(1, 1, 22050), src = ctx.createBufferSource();
      src.buffer = b; src.connect(ctx.destination); src.start(0);
    } catch (e) {}
  };

  FridayVoice.prototype.pickDefault = function (profile) {
    var voices = this.listVoices();
    if (!voices.length) return null;
    var want = this.voiceURI || "";
    if (want.indexOf("ai:") === 0) want = (root.FridayStorage.get("settings", {}) || {}).fallbackVoiceURI || "";
    if (want) {
      for (var i = 0; i < voices.length; i++) if (voices[i].voiceURI === want) return voices[i];
    }
    var lang = (profile && profile.voiceLang) || "en-GB";
    var gender = (profile && profile.voiceGender) || "";
    var scored = voices.map(function (v) {
      var s = 0;
      var n = (v.name + " " + v.lang).toLowerCase();
      if (v.lang && v.lang.toLowerCase().indexOf(lang.toLowerCase()) === 0) s += 5;
      else if (v.lang && v.lang.toLowerCase().indexOf("en") === 0) s += 2;
      if (gender === "female" && /female|woman|samantha|karen|moira|serena|fiona|kate|martha|victoria/.test(n)) s += 3;
      if (gender === "male" && /male|man|daniel|arthur|aaron|fred|tom|daniel|rishi|oliver|google uk english male/.test(n)) s += 3;
      s += (FridayVoice.voiceQuality ? FridayVoice.voiceQuality(v).rank : 0) * 1.5;
      return { v: v, s: s };
    }).sort(function (a, b) { return b.s - a.s; });
    return scored[0].v;
  };

  FridayVoice.prototype.setVoiceURI = function (uri) {
    this.voiceURI = uri || "";
  };

  FridayVoice.prototype._ensureAudio = async function () {
    if (this._stream) {
      var live = this._stream.getAudioTracks().some(function (t) { return t.readyState === "live"; });
      if (live && this._ctx && this._ctx.state !== "closed") {
        if (this._ctx.state !== "running") { try { await this._ctx.resume(); } catch (e) {} }
        if (this._ctx.state === "running") return;
      }
      this._stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      this._stream = null;
      if (this._ctx) { try { this._ctx.close(); } catch (e) {} this._ctx = null; }
    }
    // 3.5.3: her voice (or the keep-awake tone) can leave the audio set to speaker-only ("playback"),
    // which blocks the mic with "AudioSession category is not compatible with audio capture".
    // Switch to play-and-record first, and if iPhone still refuses, try once more.
    audioSessionType("play-and-record");
    var micOpts = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } };
    try {
      this._stream = await navigator.mediaDevices.getUserMedia(micOpts);
    } catch (micErr) {
      if (!/audio ?session|not compatible with audio capture|NotAllowed|AbortError|NotReadable/i.test(String((micErr && (micErr.message || micErr.name)) || ""))) throw micErr;
      audioSessionType("auto");
      await new Promise(function (r) { setTimeout(r, 250); });
      audioSessionType("play-and-record");
      this._stream = await navigator.mediaDevices.getUserMedia(micOpts);
    }
    var Ctx = window.AudioContext || window.webkitAudioContext;
    this._ctx = new Ctx();
    if (this._ctx.state === "suspended") await this._ctx.resume();
    var src = this._ctx.createMediaStreamSource(this._stream);
    this._analyser = this._ctx.createAnalyser();
    this._analyser.fftSize = 1024;
    this._analyser.smoothingTimeConstant = 0.65;
    src.connect(this._analyser);
    this._data = new Uint8Array(this._analyser.fftSize);
  };

  FridayVoice.prototype._watchVolume = function () {
    var self = this;
    var tick = function () {
      if (!self.listening && !self._forceWatch) { self.volume = 0; return; }
      self._raf = requestAnimationFrame(tick);
      if (!self._analyser) return;
      self._analyser.getByteTimeDomainData(self._data);
      var sum = 0, i, v;
      for (i = 0; i < self._data.length; i++) {
        v = (self._data[i] - 128) / 128;
        sum += v * v;
      }
      var rms = Math.sqrt(sum / self._data.length);
      var level = Math.max(0, Math.min(1, (rms - 0.02) / 0.25));
      self.volume += (level - self.volume) * 0.35;
      self._onVolume(self.volume, "user");
      var now = performance.now();
      if (self.listening && self.opts.onSilence && !self._silenceFired) {
        // learn the room's background noise in the first half second
        if (now - self._listenStart < 450) self._floor = Math.max(self._floor || 0, self.volume);
        var loud = Math.max(0.1, Math.min(0.3, (self._floor || 0) * 1.8 + 0.06));
        if (self.volume > loud) {
          if (!self._heard) self._speechStart = now;
          self._heard = true; self._lastLoud = now;
        }
        var st = root.FridayStorage.get("settings", {}) || {};
        var tt = TURN_WAIT[st.talkTime] ? st.talkTime : "normal";
        // Without a read of your words yet, fall back to a plain pause.
        var pause = tt === "short" ? 1100 : tt === "long" ? 2900 : 1900;
        // a short burst ("um", "so") gets extra time to keep going
        if (self._heard && now - (self._speechStart || now) < 900) pause += 600;
        // During a pause, a quick read of what you said so far decides: answer now or keep listening.
        var turn = self._turn;
        var fresh = turn && turn.text && turn.at > self._lastLoud;
        if (fresh) pause = turnWait(turn.verdict, tt);
        else if (self._heard && self._mode === "whisper" && !self._checking && (self._checks || 0) < 6 &&
          now - self._lastLoud > CHECK_AT[tt] && self._chunks.length >= 2 && (!turn || turn.at < self._lastLoud)) self._interimCheck();
        var maxLen = tt === "long" ? 45000 : 30000;
        if ((self._heard && now - self._lastLoud > pause) || (!self._heard && now - self._listenStart > 8000) || (now - self._listenStart > maxLen)) {
          self._silenceFired = true;
          setTimeout(function () { self.opts.onSilence(); }, 0);
        }
      }
      if (self.volume > 0.22 && self.volume > self._peakHold * 1.12 && now - self._lastPeak > 120) {
        self._lastPeak = now;
        self._onSyllable();
      }
      self._peakHold += (self.volume - self._peakHold) * 0.12;
    };
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(tick);
  };

  FridayVoice.prototype.startListen = async function () {
    if (this.listening) return;
    this.stopSpeak();
    this.listening = true;
    this._heard = false;
    this._listenStart = performance.now();
    this._lastLoud = this._listenStart;
    this._silenceFired = false;
    this._floor = 0;
    this._speechStart = 0;
    this._chunks = [];
    this._listenId = (this._listenId || 0) + 1;
    this._turn = null;
    this._checks = 0;
    this._checking = false;
    this._liveText = "";
    this._lastWords = "";
    this._lastWordsAt = 0;
    this._loudHeard = false;
    this._onState("listen-start");
    var st = root.FridayStorage.get("settings", {}) || {};
    var L = nativeListen();
    // Live listening (words as you talk) unless it's off, or Talk over her needs the mic open the whole time.
    if (L && st.liveListen !== false && !st.bargeIn && !this._nativeBroken) {
      try {
        await this._startNative(L);
        return;
      } catch (e0) {
        this._nativeBroken = true;
        try { root.FridayStorage.set("liveListenError", { msg: String((e0 && e0.message) || e0), at: Date.now() }); } catch (e1) {}
        if (!this.listening) return;
      }
    }
    try {
      await this._ensureAudio();
      this._watchVolume();
      var mime = preferredMime();
      if (window.MediaRecorder && this._stream) {
        this._rec = mime ? new MediaRecorder(this._stream, { mimeType: mime }) : new MediaRecorder(this._stream);
        var self = this;
        this._rec.ondataavailable = function (e) { if (e.data && e.data.size) self._chunks.push(e.data); };
        this._rec.start(250);
        this._mode = "whisper";
      } else if (window.webkitSpeechRecognition) {
        this._mode = "webkit";
        this._wkPromise = this._startWebkit();
      } else {
        throw new Error("This phone cannot record audio in the browser.");
      }
    } catch (err) {
      this.listening = false;
      this._onState("listen-error", err);
      throw err;
    }
  };

  FridayVoice.prototype._startWebkit = function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      var rec = new webkitSpeechRecognition();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = function (e) {
        var t = "";
        for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
        self._webkitText = t;
        if (e.results[e.results.length - 1].isFinal) resolve(t.trim());
      };
      rec.onerror = function (e) { reject(new Error(e.error || "speech")); };
      rec.onend = function () { resolve((self._webkitText || "").trim()); };
      self._wk = rec;
      rec.start();
    });
  };

  // ---------- Live listening (iPhone speech recognition) ----------
  FridayVoice.prototype._startNative = async function (L) {
    var self = this;
    var lid = this._listenId;
    this._mode = "native";
    this._nativeRms = 0;
    var hs = [];
    var add = async function (ev, fn) {
      try { var h = await L.addListener(ev, fn); if (h) hs.push(h); } catch (e) {}
    };
    this._nativeHandles = hs;
    await add("partial", function (d) {
      if (lid !== self._listenId || !self.listening) return;
      self._onPartialText((d && d.text) || "");
    });
    await add("level", function (d) {
      if (lid !== self._listenId) return;
      self._nativeRms = +(d && d.rms) || 0;
    });
    await add("end", function (d) {
      if (lid !== self._listenId || !self.listening) return;
      if (d && d.text) self._liveText = d.text;
      self._fireSilence();
    });
    try {
      var lset = root.FridayStorage.get("settings", {}) || {};
      await L.start({ lang: "en-US", hints: knownNames(), onDevice: lset.onDeviceListen !== false });
    } catch (e) {
      this._dropNative();
      throw e;
    }
    if (lid !== this._listenId || !this.listening) { try { L.cancel(); } catch (e2) {} this._dropNative(); return; }
    this._nativeTimer = setInterval(function () { self._nativeTick(); }, 50);
  };

  FridayVoice.prototype._onPartialText = function (text) {
    var w = turnWords(text);
    this._liveText = String(text || "");
    if (w && w !== this._lastWords) {
      this._lastWords = w;
      this._lastWordsAt = performance.now();
      if (!this._speechStart) this._speechStart = this._lastWordsAt;
      this._heard = true;
    }
    if (this.opts.onPartial) { try { this.opts.onPartial(fixNames(this._liveText)); } catch (e) {} }
  };

  FridayVoice.prototype._fireSilence = function () {
    if (this._silenceFired || !this.listening) return;
    this._silenceFired = true;
    var self = this;
    setTimeout(function () { if (self.opts.onSilence) self.opts.onSilence(); }, 0);
  };

  FridayVoice.prototype._nativeTick = function () {
    if (!this.listening || this._mode !== "native") { this._dropNative(true); return; }
    var now = performance.now();
    var lvl = Math.max(0, Math.min(1, ((this._nativeRms || 0) * 3 - 0.02) / 0.25));
    this.volume += (lvl - this.volume) * 0.35;
    this._onVolume(this.volume, "user");
    if (now - this._listenStart < 450) this._floor = Math.max(this._floor || 0, this.volume);
    var loud = Math.max(0.12, Math.min(0.32, (this._floor || 0) * 1.8 + 0.07));
    if (this.volume > loud) { this._lastLoud = now; this._loudHeard = true; }
    if (this.volume > 0.22 && this.volume > this._peakHold * 1.12 && now - this._lastPeak > 120) {
      this._lastPeak = now;
      this._onSyllable();
    }
    this._peakHold += (this.volume - this._peakHold) * 0.12;
    if (this._silenceFired) return;
    var st = root.FridayStorage.get("settings", {}) || {};
    var tt = TURN_WAIT[st.talkTime] ? st.talkTime : "normal";
    var maxLen = tt === "long" ? 45000 : 30000;
    if (now - this._listenStart > maxLen) { this._fireSilence(); return; }
    if (!this._lastWordsAt) {
      // Nothing understood yet: give up after a while.
      if (now - this._listenStart > (this._loudHeard ? 10000 : 8000)) this._fireSilence();
      return;
    }
    // Sound right after your last word (a word iOS hasn't spelled out yet) counts as still talking, briefly.
    var act = Math.max(this._lastWordsAt, Math.min(this._loudHeard ? this._lastLoud : 0, this._lastWordsAt + 2500));
    var verdict = judgeTurn(this._liveText);
    this._verdict = verdict;
    if (now - act > turnWait(verdict, tt)) this._fireSilence();
  };

  FridayVoice.prototype._dropNative = function (keepHandles) {
    if (this._nativeTimer) { clearInterval(this._nativeTimer); this._nativeTimer = 0; }
    if (keepHandles) return;
    var hs = this._nativeHandles || [];
    this._nativeHandles = [];
    hs.forEach(function (h) { try { if (h && h.remove) h.remove(); } catch (e) {} });
  };

  // ---------- Quick read during a pause (Whisper listening) ----------
  FridayVoice.prototype._interimCheck = function () {
    var self = this;
    var rec = this._rec;
    if (!rec || !root.FridayStorage.hasApiKey()) return;
    var lid = this._listenId;
    var at = performance.now();
    var blob = new Blob(this._chunks.slice(), { type: rec.mimeType || "audio/webm" });
    if (blob.size < 1200) return;
    this._checking = true;
    this._checks = (this._checks || 0) + 1;
    var slow = new Promise(function (resolve, reject) { setTimeout(function () { reject(new Error("slow")); }, 3000); });
    Promise.race([this._transcribe(blob), slow]).then(function (text) {
      if (lid !== self._listenId) return;
      text = String(text || "").trim();
      self._turn = { text: text, verdict: text ? judgeTurn(text) : "unsure", at: at };
    }, function () {}).then(function () {
      if (lid === self._listenId) self._checking = false;
    });
  };

  FridayVoice.prototype.stopListen = async function () {
    if (!this.listening) return "";
    this.listening = false;
    this.volume = 0;
    this._onVolume(0, "idle");
    this._onState("listen-stop");
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
    if (this._mode === "native") {
      var L = nativeListen();
      var got = "";
      this._dropNative(true);
      try {
        var r = await Promise.race([L ? L.stop() : Promise.resolve(null), new Promise(function (res) { setTimeout(function () { res(null); }, 2500); })]);
        got = (r && r.text) || "";
      } catch (e) {}
      if (!got) got = this._liveText || "";
      this._dropNative();
      var outc = this._out;
      if (outc && outc.state !== "running") { try { await this._ensureRunning(); } catch (e9) {} }
      return fixNames(String(got).trim());
    }
    // A read taken after your last word is already the full text: no need to send it again.
    var turn = this._turn;
    if (this._mode === "whisper" && turn && turn.text && turn.at > this._lastLoud) {
      try { if (this._rec && this._rec.state === "recording") this._rec.stop(); } catch (e3) {}
      this._rec = null;
      return fixNames(turn.text);
    }
    if (this._mode === "webkit") {
      try { if (this._wk) this._wk.stop(); } catch (e) {}
      return fixNames((await this._wkPromise) || (this._webkitText || ""));
    }
    var rec = this._rec;
    if (!rec) return "";
    var chunks = this._chunks;
    var blob = await new Promise(function (resolve) {
      rec.onstop = function () {
        var type = rec.mimeType || "audio/webm";
        resolve(new Blob(chunks, { type: type }));
      };
      try { if (rec.state === "recording" && rec.requestData) rec.requestData(); } catch (e) {}
      try { rec.stop(); } catch (e) { resolve(new Blob(chunks)); }
    });
    this._rec = null;
    if (!blob || blob.size < 50) return "";
    return this._transcribe(blob);
  };

  FridayVoice.prototype._transcribe = async function (blob) {
    var key = root.FridayStorage.getApiKey();
    if (!key) throw new Error("Add a Groq API key in Settings first.");
    var fd = new FormData();
    var ext = (blob.type || "").indexOf("mp4") >= 0 ? "m4a" : "webm";
    fd.append("file", blob, "speech." + ext);
    fd.append("model", root.FRIDAY_CONFIG.WHISPER_MODEL);
    fd.append("language", "en");
    fd.append("response_format", "json");
    var hint = knownNames().slice(0, 30).join(", ");
    if (hint) fd.append("prompt", hint.slice(0, 220));
    var res = await fetch(root.FRIDAY_CONFIG.TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: "Bearer " + key },
      body: fd
    });
    if (!res.ok) {
      if (window.webkitSpeechRecognition) {
        // Fall back if Whisper rejects the file type.
        throw new Error("whisper-failed");
      }
      var txt = await res.text().catch(function () { return ""; });
      throw new Error("Could not transcribe (" + res.status + ").");
    }
    var data = await res.json();
    return fixNames((data && data.text || "").trim());
  };

  FridayVoice.prototype.listenOnce = async function () {
    await this.startListen();
  };

  // ---------- Speaking ----------
  // AI voices from Groq (Orpheus). Free plan allows about 100 short clips a day,
  // so she falls back to the iPhone voice whenever they're not available.
  var AI_VOICES = [
    { id: "ai:troy", name: "Troy", gender: "male", blurb: "AI voice · warm, deep" },
    { id: "ai:daniel", name: "Daniel", gender: "male", blurb: "AI voice · clear, calm" },
    { id: "ai:austin", name: "Austin", gender: "male", blurb: "AI voice · bright, casual" },
    { id: "ai:hannah", name: "Hannah", gender: "female", blurb: "AI voice · friendly" },
    { id: "ai:diana", name: "Diana", gender: "female", blurb: "AI voice · smooth, poised" },
    { id: "ai:autumn", name: "Autumn", gender: "female", blurb: "AI voice · soft, warm" }
  ];
  // 3.4.1: Google's Gemini voices, using the Gemini key you added (its own free daily allowance).
  var GEMINI_VOICES = [
    ["Kore", "female", "firm"], ["Aoede", "female", "breezy"], ["Leda", "female", "youthful"], ["Zephyr", "female", "bright"],
    ["Callirrhoe", "female", "easy-going"], ["Autonoe", "female", "bright"], ["Despina", "female", "smooth"], ["Erinome", "female", "clear"],
    ["Laomedeia", "female", "upbeat"], ["Achernar", "female", "soft"], ["Gacrux", "female", "mature"], ["Pulcherrima", "female", "forward"],
    ["Vindemiatrix", "female", "gentle"], ["Sulafat", "female", "warm"],
    ["Puck", "male", "upbeat"], ["Charon", "male", "informative"], ["Fenrir", "male", "excitable"], ["Orus", "male", "firm"],
    ["Enceladus", "male", "breathy"], ["Iapetus", "male", "clear"], ["Umbriel", "male", "easy-going"], ["Algieba", "male", "smooth"],
    ["Algenib", "male", "gravelly"], ["Rasalgethi", "male", "informative"], ["Alnilam", "male", "firm"], ["Schedar", "male", "even"],
    ["Achird", "male", "friendly"], ["Zubenelgenubi", "male", "casual"], ["Sadachbia", "male", "lively"], ["Sadaltager", "male", "knowledgeable"]
  ];
  GEMINI_VOICES.forEach(function (g) { AI_VOICES.push({ id: "ai:gem-" + g[0].toLowerCase(), name: g[0], gender: g[1], blurb: "Gemini voice · " + g[2], gemini: g[0] }); });
  var GEM_BASE = "https://generativelanguage.googleapis.com/v1beta";
  // 3.5.1: Google's current voice models first; the older previews stay as a fallback.
  var GEM_TTS_MODELS = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"];
  function gemNewSchema(model) { return /^gemini-3\.[8-9]|^gemini-[4-9]/.test(model); }
  function geminiKey() {
    var S = root.FridayStorage, list = S.get("connections", []) || [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c && c.type === "agent" && (c.provider === "gemini" || /generativelanguage/.test(c.baseUrl || ""))) { var k = S.getAgentKey(c.id); if (k) return k; }
    }
    return "";
  }
  FridayVoice.geminiKey = geminiKey;
  function wavFromPcm(pcm, rate) {
    var buf = new ArrayBuffer(44 + pcm.length), v = new DataView(buf), o = 0;
    function str(x) { for (var i = 0; i < x.length; i++) v.setUint8(o++, x.charCodeAt(i)); }
    str("RIFF"); v.setUint32(o, 36 + pcm.length, true); o += 4; str("WAVE"); str("fmt "); v.setUint32(o, 16, true); o += 4;
    v.setUint16(o, 1, true); o += 2; v.setUint16(o, 1, true); o += 2; v.setUint32(o, rate, true); o += 4; v.setUint32(o, rate * 2, true); o += 4;
    v.setUint16(o, 2, true); o += 2; v.setUint16(o, 16, true); o += 2; str("data"); v.setUint32(o, pcm.length, true); o += 4;
    new Uint8Array(buf, 44).set(pcm);
    return buf;
  }
  var TTS_URL = "https://api.groq.com/openai/v1/audio/speech";
  var TTS_MODEL = "canopylabs/orpheus-v1-english";
  var MOOD_VOICE = {
    normal: { rate: 1.0, pitch: 1.0, tag: "" },
    focus: { rate: 1.04, pitch: 1.0, tag: "" },
    hype: { rate: 1.06, pitch: 1.05, tag: "[cheerful]" },
    calm: { rate: 0.97, pitch: 0.99, tag: "[calm]" },
    bedtime: { rate: 0.94, pitch: 0.97, tag: "[whisper]" },
    headache: { rate: 0.9, pitch: 0.97, tag: "[calm]" }
  };

  FridayVoice.AI_VOICES = AI_VOICES;

  function voiceQuality(v) {
    var u = ((v.voiceURI || "") + " " + (v.name || "")).toLowerCase();
    if (/premium/.test(u)) return { rank: 3, label: "Premium" };
    if (/enhanced/.test(u)) return { rank: 2, label: "Enhanced" };
    if (/siri/.test(u)) return { rank: 2, label: "Siri" };
    if (/eloquence|bells|boing|bubbles|cellos|good news|bad news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|bahh|fred|junior|kathy|ralph/.test(u)) return { rank: 0, label: "Fun" };
    return { rank: 1, label: "Standard" };
  }
  FridayVoice.voiceQuality = voiceQuality;

  // Every iPhone voice, best quality first, grouped for the picker.
  FridayVoice.prototype.catalog = function (allLanguages) {
    var voices = this.listVoices().filter(function (v) {
      return allLanguages || /^en/i.test(v.lang || "");
    });
    return voices.map(function (v) {
      var q = voiceQuality(v);
      return { voice: v, uri: v.voiceURI, name: v.name.replace(/\s*\((enhanced|premium)\)/i, ""), lang: v.lang, quality: q.label, rank: q.rank };
    }).sort(function (a, b) {
      return b.rank - a.rank || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name);
    });
  };

  FridayVoice.prototype._moodVoice = function () {
    var s = root.FridayStorage.get("settings", {}) || {};
    var m = s.mood || "normal";
    var night = root.FridayNight && root.FridayNight.isNight();
    if (m === "normal" && night) m = "calm";
    var mv = Object.assign({}, MOOD_VOICE[m] || MOOD_VOICE.normal);
    var sp = parseFloat(s.voiceSpeed);
    if (sp > 0.5 && sp < 2) mv.rate *= sp;
    mv.volume = m === "headache" ? 0.45 : (night ? 0.65 : 1);
    return mv;
  };

  FridayVoice.prototype._aiVoiceId = function () {
    var uri = this.voiceURI || "";
    if (uri.indexOf("ai:") === 0) return uri.slice(3);
    // Automatic = the natural AI voice; the iPhone voice steps in when it's out for the day.
    if (!uri && this.autoAi) return this.autoAi;
    return "";
  };
  FridayVoice.autoAiFor = function (profile) {
    return profile && profile.voiceGender === "female" ? "diana" : "daniel";
  };
  // Friday speaks with a woman's voice and Jarvis with a man's. A saved voice of the other
  // kind (from before this was fixed) goes back to Automatic, once.
  var FEMALE_NAMES = /samantha|karen|moira|serena|fiona|kate|martha|victoria|tessa|ava|zoe|allison|susan|nicky|joelle|stephanie|catherine|kathy|shelley|sandy|flo|grandma|female/i;
  var MALE_NAMES = /daniel|arthur|aaron|fred|tom|rishi|oliver|alex|evan|nathan|gordon|lee|reed|ralph|rocko|eddy|grandpa|albert|junior|jamie|malcolm|\bmale/i;
  FridayVoice.voiceFitsGender = function (uri, gender, voices) {
    if (!uri || !gender) return true;
    if (uri.indexOf("ai:") === 0) {
      var a = AI_VOICES.filter(function (x) { return x.id === uri; })[0];
      return !a || a.gender === gender;
    }
    var v = (voices || []).filter(function (x) { return x.voiceURI === uri; })[0];
    var name = ((v && v.name) || "") + " " + uri;
    if (gender === "female") return !MALE_NAMES.test(name) || FEMALE_NAMES.test(name);
    return !FEMALE_NAMES.test(name) || MALE_NAMES.test(name);
  };

  FridayVoice.prototype._aiAllowed = function () {
    var vid = this._aiVoiceId();
    if (!vid) return false;
    if (vid.indexOf("gem-") === 0) return !!geminiKey() && Date.now() > (root.FridayStorage.get("gemVoicePauseUntil", 0) || 0);
    if (!root.FridayStorage.hasApiKey()) return false;
    var until = root.FridayStorage.get("aiVoicePauseUntil", 0) || 0;
    return Date.now() > until;
  };

  function splitForTTS(text, max, firstMax) {
    var parts = [];
    var sentences = String(text).match(/[^.!?…]+[.!?…]*["')\]]*\s*/g) || [text];
    sentences.forEach(function (s) {
      s = s.trim();
      while (s.length > max) {
        var cut = s.lastIndexOf(", ", max);
        if (cut < max * 0.4) cut = s.lastIndexOf(" ", max);
        if (cut < 1) cut = max;
        parts.push(s.slice(0, cut + 1).trim());
        s = s.slice(cut + 1).trim();
      }
      if (s) parts.push(s);
    });
    // Merge tiny pieces so we use fewer clips.
    var merged = [];
    parts.forEach(function (p) {
      var last = merged[merged.length - 1];
      var cap = merged.length === 1 && firstMax ? firstMax : max;
      if (last && (last + " " + p).length <= cap) merged[merged.length - 1] = last + " " + p;
      else merged.push(p);
    });
    // A long first piece: start talking at the first natural break so she answers sooner.
    if (firstMax && merged.length && merged[0].length > firstMax) {
      var f = merged[0], cut = -1, re = /[,;:]\s/g, m;
      while ((m = re.exec(f))) { if (m.index >= 25 && m.index <= firstMax) cut = m.index + 1; }
      if (cut > 0) merged.splice(0, 1, f.slice(0, cut).trim(), f.slice(cut).trim());
    }
    return merged;
  }
  FridayVoice.splitForTTS = splitForTTS;

  // Trim the quiet at the start and end of an AI clip, so the gaps between sentences are even.
  function trimSilence(ctx, buf) {
    try {
      var d = buf.getChannelData(0), n = d.length, sr = buf.sampleRate, th = 0.006;
      var a = 0;
      while (a < n && Math.abs(d[a]) < th) a++;
      var b = n - 1;
      while (b > a && Math.abs(d[b]) < th) b--;
      a = Math.max(0, a - Math.round(sr * 0.02));
      b = Math.min(n - 1, b + Math.round(sr * 0.07));
      var len = b - a + 1;
      if ((a === 0 && b === n - 1) || len < sr * 0.15) return buf;
      var out = ctx.createBuffer(buf.numberOfChannels, len, sr);
      for (var c = 0; c < buf.numberOfChannels; c++) out.getChannelData(c).set(buf.getChannelData(c).subarray(a, b + 1));
      return out;
    } catch (e) { return buf; }
  }
  FridayVoice.trimSilence = trimSilence;

  // The AI voice changes pitch when sped up, so keep its speed change small and natural.
  function aiRate() {
    var sp = parseFloat((root.FridayStorage.get("settings", {}) || {}).voiceSpeed);
    if (!(sp > 0.5 && sp < 2)) return 1;
    var r = 1 + (sp - 1) * 0.5;
    r = Math.max(0.94, Math.min(1.08, r));
    return Math.abs(r - 1) < 0.01 ? 1 : r;
  }
  FridayVoice.aiRate = aiRate;

  FridayVoice.prototype._fetchGemini = async function (text, voiceId, tag) {
    var S = root.FridayStorage, key = geminiKey();
    function fail(status, msg) {
      S.set("aiVoiceError", { provider: "gemini", status: status, msg: ("Gemini voice: " + (msg || "")).slice(0, 400), at: Date.now() });
    }
    if (!key) { fail("nokey", ""); throw new Error("tts no-gemini-key"); }
    var g = AI_VOICES.filter(function (x) { return x.id === "ai:" + voiceId; })[0];
    var styleWord = tag === "[cheerful]" ? "cheerful" : tag === "[calm]" ? "calm and gentle" : tag === "[whisper]" ? "soft and quiet" : "";
    var speech = { voiceConfig: { prebuiltVoiceConfig: { voiceName: g ? g.gemini : "Kore" } } };
    function bodyFor(model, withMeta) {
      var part;
      if (gemNewSchema(model)) {
        // Newer models read the text word for word, so the style goes in speech_metadata.
        part = { text: text };
        if (withMeta && styleWord) part.speech_metadata = { style: styleWord };
      } else {
        part = { text: (styleWord ? "Say in a " + styleWord + " way: " : "") + text };
      }
      return JSON.stringify({ contents: [{ parts: [part] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: speech } });
    }
    var http = root.FridayBrain && root.FridayBrain.http ? root.FridayBrain.http : function (u, i) { return fetch(u, i); };
    var known = S.get("gemTtsModel", ""), models = known && GEM_TTS_MODELS.indexOf(known) >= 0 ? [known].concat(GEM_TTS_MODELS.filter(function (m) { return m !== known; })) : GEM_TTS_MODELS;
    var notFound = [];
    for (var i = 0; i < models.length; i++) {
      var model = models[i], url = GEM_BASE + "/models/" + model + ":generateContent";
      async function send(withMeta) {
        var init = { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: bodyFor(model, withMeta) };
        var r;
        try { r = await http(url, init); }
        catch (netErr) { fail(0, String((netErr && netErr.message) || "")); throw new Error("tts net"); }
        if ((r.status === 401 || r.status === 403) && /^AQ\./.test(key)) {
          r = await http(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + key }, body: init.body });
        }
        return r;
      }
      var res = await send(true);
      var t = "";
      if (res.status === 400 && gemNewSchema(model)) {
        try { t = await res.text(); } catch (e) {}
        // If this model doesn't know speech_metadata, try once without it.
        if (/speech_metadata|unknown name|invalid json payload/i.test(t)) { res = await send(false); t = ""; }
        else { fail(400, t); throw new Error("tts 400"); }
      }
      if (res.status === 404) { notFound.push(model); continue; }
      if (!res.ok) {
        try { t = t || await res.text(); } catch (e) {}
        fail(res.status, t);
        var pause = /per day|daily|quota/i.test(t) ? 3 * 3600 * 1000 : (res.status === 429 ? 10 * 60 * 1000 : (res.status === 400 ? 0 : 30 * 60 * 1000));
        if (pause) S.set("gemVoicePauseUntil", Date.now() + pause);
        throw new Error("tts " + res.status);
      }
      var data = await res.json();
      var parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
      var part = parts.filter(function (p) { return p.inlineData && p.inlineData.data; })[0];
      if (!part) { fail("empty", "Google sent back no audio."); throw new Error("tts empty"); }
      var mime = part.inlineData.mimeType || "", rm = mime.match(/rate=(\d+)/), rate = rm ? +rm[1] : 24000;
      var bin = atob(part.inlineData.data), pcm = new Uint8Array(bin.length);
      for (var j = 0; j < bin.length; j++) pcm[j] = bin.charCodeAt(j);
      S.set("gemTtsModel", model);
      S.set("aiVoiceError", null);
      if (root.FridayBrain && root.FridayBrain.noteUse) root.FridayBrain.noteUse("Gemini", "tts");
      // Newer models send a finished WAV file; older ones send raw sound that needs a WAV header.
      var isWav = /wav/i.test(mime) || (pcm.length > 12 && pcm[0] === 82 && pcm[1] === 73 && pcm[2] === 70 && pcm[3] === 70);
      return isWav ? pcm.buffer : wavFromPcm(pcm, rate);
    }
    fail(404, "None of these voice models are available to this key: " + notFound.join(", "));
    throw new Error("tts 404");
  };

  FridayVoice.prototype._fetchClip = async function (text, voiceId, tag) {
    if (String(voiceId || "").indexOf("gem-") === 0) return this._fetchGemini(text, voiceId, tag);
    var key = root.FridayStorage.getApiKey();
    var input = (tag ? tag + " " : "") + text;
    var res = await fetch(TTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ model: TTS_MODEL, voice: voiceId, input: input, response_format: "wav" })
    });
    if (!res.ok) {
      var t = "";
      try { t = await res.text(); } catch (e) {}
      var em = t;
      try { var ej = JSON.parse(t); em = (ej.error && (ej.error.message || ej.error.code)) || t; } catch (e) {}
      root.FridayStorage.set("aiVoiceError", { provider: "groq", status: res.status, msg: String(em).slice(0, 400), at: Date.now() });
      var pause = /per day|daily|rpd|tpd/i.test(t) ? 3 * 3600 * 1000 : (res.status === 429 ? 10 * 60 * 1000 : 30 * 60 * 1000);
      if (res.status === 401) pause = 0;
      if (pause) root.FridayStorage.set("aiVoicePauseUntil", Date.now() + pause);
      throw new Error("tts " + res.status);
    }
    if (root.FridayBrain && root.FridayBrain.noteUse) root.FridayBrain.noteUse("", "tts");
    root.FridayStorage.set("aiVoiceError", null);
    return res.arrayBuffer();
  };

  // A fresh audio output, for when iOS has cut the old one off (after the mic, a call, another app).
  FridayVoice.prototype._reviveOut = function () {
    try { if (this._out && this._out.state !== "closed") this._out.close(); } catch (e) {}
    this._out = null;
    this._srcs = [];
    this._playhead = 0;
    this._keepOsc = null;
    return this._outCtx();
  };
  // iPhone mutes web audio on silent unless it's marked as playback (like music). Mark it while she talks,
  // and hand it back afterwards so other apps' music can carry on.
  function audioSessionType(t) {
    try { if (navigator.audioSession && navigator.audioSession.type !== t) navigator.audioSession.type = t; } catch (e) {}
  }
  FridayVoice.audioSessionType = audioSessionType;
  // In the app: send her voice to the main speaker (or AirPods), never the quiet earpiece the mic can leave behind.
  async function speakerOn() {
    var L = nativeListen();
    var st = root.FridayStorage.get("settings", {}) || {};
    if (!L || !L.speakerOn || st.bargeIn) return null;
    try {
      var r = await Promise.race([L.speakerOn(), new Promise(function (res) { setTimeout(function () { res(null); }, 700); })]);
      if (r && r.route) root.FridayStorage.set("voiceRoute", r.route);
      return r;
    } catch (e) { return null; }
  }
  function speakerOff() {
    var L = nativeListen();
    if (L && L.speakerOff) { try { L.speakerOff(); } catch (e) {} }
  }
  function diag(d) { try { root.FridayStorage.set("voiceDiag", Object.assign({ at: Date.now() }, d)); } catch (e) {} }
  FridayVoice.prototype._outCtx = function () {
    if (!this._out || this._out.state === "closed" || this._out.state === "interrupted") {
      if (this._out && this._out.state === "interrupted") { try { this._out.close(); } catch (e0) {} }
      var Ctx = window.AudioContext || window.webkitAudioContext;
      this._out = new Ctx();
      this._outGain = this._out.createGain();
      this._outAnalyser = this._out.createAnalyser();
      this._outAnalyser.fftSize = 512;
      this._outGain.connect(this._outAnalyser);
      this._outAnalyser.connect(this._out.destination);
      this._outData = new Uint8Array(this._outAnalyser.fftSize);
    }
    return this._out;
  };

  FridayVoice.prototype._playBuffer = function (arrayBuf, volume, gen) {
    var self = this;
    var ctx = this._outCtx();
    return new Promise(function (resolve, reject) {
      var done = false, guard = 0;
      function finish() { if (!done) { done = true; clearTimeout(guard); resolve(); } }
      function fail(e) { if (!done) { done = true; clearTimeout(guard); reject(e || new Error("audio")); } }
      var start = function (buffer) {
        if (!self.speaking || (gen && gen !== self._gen)) return finish();
        if (ctx.state !== "running") return fail(new Error("audio-suspended"));
        var src = ctx.createBufferSource();
        src.buffer = buffer;
        var rt = aiRate();
        if (rt !== 1 && src.playbackRate) src.playbackRate.value = rt;
        self._outGain.gain.value = volume;
        src.connect(self._outGain);
        self._src = src;
        src.onended = function () { self._src = null; finish(); };
        src.start();
        self._realEnvelope();
        // Safety net: never wait longer than the clip plus a little.
        guard = setTimeout(finish, (buffer.duration || 5) * 1000 / ((src.playbackRate && src.playbackRate.value) || 1) + 1500);
      };
      var resume = ctx.state === "running" ? Promise.resolve() : (ctx.resume ? ctx.resume() : Promise.resolve());
      Promise.resolve(resume).catch(function () {}).then(function () {
        var p = ctx.decodeAudioData(arrayBuf.slice(0), start, fail);
        if (p && p.catch) p.catch(fail);
      });
      setTimeout(function () { if (!self._src && !done && ctx.state !== "running") fail(new Error("audio-suspended")); }, 1500);
    });
  };

  // ---------- Gapless AI voice: clips are lined up back to back on one clock ----------
  FridayVoice.prototype._decode = function (arrayBuf) {
    var ctx = this._outCtx();
    return new Promise(function (resolve, reject) {
      var p = ctx.decodeAudioData(arrayBuf.slice(0), resolve, reject);
      if (p && p.catch) p.catch(reject);
    }).then(function (b) { return trimSilence(ctx, b); });
  };

  FridayVoice.prototype._ensureRunning = async function () {
    var ctx = this._outCtx();
    if (ctx.state === "running") return;
    try { if (ctx.resume) await Promise.race([ctx.resume(), new Promise(function (r) { setTimeout(r, 1200); })]); } catch (e) {}
    if (ctx.state === "running") return;
    // still not playing: start over with a new output
    ctx = this._reviveOut();
    try { if (ctx.resume) await Promise.race([ctx.resume(), new Promise(function (r) { setTimeout(r, 1200); })]); } catch (e2) {}
    if (ctx.state !== "running") { diag({ path: "none", issue: "suspended", state: ctx.state }); throw new Error("audio-suspended"); }
  };
  // Is sound really coming out? (iOS can leave the clock frozen after the mic was used.)
  FridayVoice.prototype._flowing = function () {
    var ctx = this._out;
    if (!ctx) return Promise.resolve(false);
    var a = ctx.currentTime;
    return new Promise(function (res) { setTimeout(function () { res(ctx.state === "running" && ctx.currentTime > a + 0.05); }, 350); });
  };

  FridayVoice.prototype._schedule = function (buffer, volume, gapAfter) {
    var ctx = this._outCtx();
    var self = this;
    var rate = aiRate();
    var src = ctx.createBufferSource();
    src.buffer = buffer;
    if (rate !== 1 && src.playbackRate) src.playbackRate.value = rate;
    this._outGain.gain.value = volume;
    src.connect(this._outGain);
    var t0 = Math.max(ctx.currentTime + 0.03, this._playhead || 0);
    src.start(t0);
    var end = t0 + buffer.duration / rate;
    this._playhead = end + (gapAfter || 0);
    this._srcs = this._srcs || [];
    this._srcs.push(src);
    this._src = src;
    src.onended = function () {
      var i = self._srcs ? self._srcs.indexOf(src) : -1;
      if (i >= 0) self._srcs.splice(i, 1);
      if (self._src === src) self._src = null;
    };
    if (!this._envTimer) this._realEnvelope();
    return end;
  };

  // Wait until the audio clock reaches time t (minus lead seconds), or she was stopped.
  FridayVoice.prototype._until = function (t, lead, gen) {
    var self = this;
    var ctx = this._out;
    if (!ctx || !t) return Promise.resolve();
    var deadline = Date.now() + Math.max(0, (t - ctx.currentTime) * 1000) + 1500;
    return new Promise(function (resolve) {
      (function check() {
        if (!self.speaking || (gen && gen !== self._gen) || Date.now() > deadline) return resolve();
        var left = t - (lead || 0) - ctx.currentTime;
        if (left <= 0) return resolve();
        setTimeout(check, Math.min(200, Math.max(15, left * 1000)));
      })();
    });
  };

  FridayVoice.prototype._drain = function (gen) {
    return this._until(this._playhead || 0, 0, gen);
  };

  FridayVoice.prototype._realEnvelope = function () {
    var self = this;
    this._stopEnvelope();
    var last = 0;
    this._envTimer = setInterval(function () {
      if (!self.speaking || !self._outAnalyser) return;
      self._outAnalyser.getByteTimeDomainData(self._outData);
      var sum = 0;
      for (var i = 0; i < self._outData.length; i++) { var v = (self._outData[i] - 128) / 128; sum += v * v; }
      var rms = Math.sqrt(sum / self._outData.length);
      var level = Math.max(0, Math.min(1, rms * 4.2));
      self.volume += (level - self.volume) * 0.5;
      self._onVolume(Math.max(0.12, self.volume), "friday");
      if (self.volume > 0.3 && self.volume > last * 1.15 && performance.now() - self._lastPeak > 120) {
        self._lastPeak = performance.now();
        self._onSyllable();
      }
      last += (self.volume - last) * 0.2;
    }, 33);
  };

  FridayVoice.prototype._speakSystem = function (text, profile, mv, lang, forceVoice) {
    var self = this;
    return new Promise(function (resolve) {
      var u = new SpeechSynthesisUtterance(text);
      var voice = null;
      if (lang) {
        // Translator: use an iPhone voice for that language so it sounds right.
        u.lang = lang;
        var pre = lang.slice(0, 2).toLowerCase();
        var all = self.listVoices();
        voice = all.filter(function (v) { return (v.lang || "").toLowerCase() === lang.toLowerCase(); })[0] ||
          all.filter(function (v) { return (v.lang || "").toLowerCase().indexOf(pre) === 0; })[0] || null;
      } else {
        voice = forceVoice || self.pickDefault(profile);
      }
      var T = nativeTTS();
      if (!lang) { var dg = root.FridayStorage.get("voiceDiag", null); if (!dg || Date.now() - (dg.at || 0) > 3000 || dg.path !== "iphone") diag({ path: "iphone", issue: self._aiAllowed() ? "fallback" : "chosen" }); }
      if (voice && voice._native && T) {
        self._fakeEnvelope(text);
        var done = false;
        var fin = function () { if (done) return; done = true; self._stopEnvelope(); resolve(); };
        try {
          T.speak({ text: text, lang: voice.lang || lang || "en-US", rate: mv.rate, pitch: mv.pitch, volume: mv.volume, voice: voice._index, category: "playback" }).then(fin, fin);
        } catch (e) { fin(); }
        setTimeout(fin, 6000 + text.length * 150);
        return;
      }
      if (voice) u.voice = voice;
      u.rate = mv.rate;
      u.pitch = mv.pitch;
      u.volume = mv.volume;
      self._utterance = u;
      self._fakeEnvelope(text);
      var settled = false;
      function end() { if (settled) return; settled = true; self._stopEnvelope(); resolve(); }
      u.onend = end;
      u.onerror = end;
      // iOS sometimes never fires onend; guard with a generous timeout.
      setTimeout(end, 4000 + text.length * 120);
      speechSynthesis.speak(u);
    });
  };

  FridayVoice.prototype._speakOne = async function (text, profile, gen, lang, pre, first, priv) {
    var mv = this._moodVoice();
    if (lang) { await this._drain(gen); await this._speakSystem(text, profile, mv, lang); return; }
    // 3.4 private messages: only the iPhone's own voice, so the words never leave the phone.
    if (priv) {
      var pv = speakable(text);
      if (!pv) return;
      await this._drain(gen);
      if (!this.speaking || gen !== this._gen) return;
      await this._speakSystem(pv, profile, mv, null, this.privateVoice(profile));
      return;
    }
    var say = speakable(text);
    if (!say) return;
    var rest = say;
    if (this._aiAllowed()) {
      var parts = splitForTTS(say, 190, first ? 110 : 0);
      var i = 0;
      try {
        var voiceId = this._aiVoiceId();
        var next = pre || this._fetchClip(parts[0], voiceId, mv.tag);
        var endAt = 0;
        for (i = 0; i < parts.length; i++) {
          if (!this.speaking || gen !== this._gen) return;
          var ab = await next;
          if (gen !== this._gen) return;
          if (i + 1 < parts.length) { next = this._fetchClip(parts[i + 1], voiceId, mv.tag); next.catch(function () {}); }
          var buf = await this._decode(ab);
          if (!this.speaking || gen !== this._gen) return;
          await this._ensureRunning();
          var p = parts[i];
          var gap = /[.!?…]["')\]]*$/.test(p) ? 0.26 : /[,;:]$/.test(p) ? 0.1 : 0.16;
          endAt = this._schedule(buf, mv.volume, gap);
          if (i === 0 && !(await this._flowing())) {
            // the sound is stuck: rebuild the output and try this clip again, once
            (this._srcs || []).forEach(function (x) { try { x.stop(); } catch (e5) {} });
            this._reviveOut();
            await this._ensureRunning();
            endAt = this._schedule(buf, mv.volume, gap);
            if (!(await this._flowing())) { diag({ path: "iphone", issue: "stuck", state: this._out && this._out.state }); throw new Error("audio-stuck"); }
            diag({ path: "ai", issue: "revived" });
          } else if (i === 0) diag({ path: "ai", issue: "" });
        }
        // Start fetching the next line now (more of the reply has arrived by now), then
        // hand over a moment early so it can be lined up with no gap.
        if (this._prefetchNext) this._prefetchNext();
        await this._until(endAt, 0.25, gen);
        return;
      } catch (e) {
        // fall through to the iPhone voice for whatever wasn't said yet
        rest = parts.slice(i).join(" ");
      }
    }
    if (!this.speaking || gen !== this._gen) return;
    await this._drain(gen);
    if (!this.speaking || gen !== this._gen || !rest) return;
    await this._speakSystem(rest, profile, mv);
  };

  // Queue a line. She speaks queued lines in order; used for streamed replies.
  FridayVoice.prototype.queue = function (text, profile, lang, opts) {
    text = String(text || "").trim();
    if (!text) return this.whenDone();
    var priv = !!(opts && opts.priv);
    this._queue = this._queue || [];
    var tail = this._queue[this._queue.length - 1];
    // the first line of a reply goes alone, so she starts talking as soon as possible
    var lead = !this._pumping && !this._queue.length;
    if (tail && !tail._lead && !tail._pre && !tail.lang && !lang && !priv && !tail._priv && (tail.text + " " + text).length <= 190) tail.text += " " + text;
    else this._queue.push({ text: text, profile: profile, lang: lang || null, _lead: lead, _priv: priv });
    if (!this._pumping) this._pump();
    return this.whenDone();
  };

  FridayVoice.prototype._pump = async function () {
    audioSessionType("playback");
    this._pumping = true;
    this.speaking = true;
    await speakerOn();
    this.speaking = true;
    this._onState("speak-start");
    this._startBargeIn();
    var gen = this._gen = (this._gen || 0) + 1;
    var first = true;
    var self = this;
    // Fetch the next line's first clip while this one plays.
    this._prefetchNext = function () {
      var nx = self._queue && self._queue[0];
      if (nx && !nx.lang && !nx._pre && !nx._priv && self._aiAllowed()) {
        nx._pre = self._fetchClip(splitForTTS(speakable(nx.text), 190)[0], self._aiVoiceId(), self._moodVoice().tag);
        nx._pre.catch(function () {});
      }
    };
    try {
      while (this._queue && this._queue.length && gen === this._gen) {
        var item = this._queue.shift();
        await this._speakOne(item.text, item.profile, gen, item.lang, item._pre, first, item._priv);
        first = false;
      }
      await this._drain(gen);
    } finally {
      if (gen === this._gen) {
        this._pumping = false;
        this.speaking = false;
        if (!this._keepOsc) audioSessionType("auto");
        if (!this.listening && !this._keepOsc) speakerOff();
        this._stopEnvelope();
        this._stopBargeIn();
        this._onVolume(0, "idle");
        this._onState("speak-end");
        var waiters = this._waiters || [];
        this._waiters = [];
        waiters.forEach(function (w) { w(); });
      }
    }
  };

  FridayVoice.prototype.whenDone = function () {
    var self = this;
    if (!this._pumping && !(this._queue && this._queue.length)) return Promise.resolve();
    return new Promise(function (resolve) { (self._waiters = self._waiters || []).push(resolve); });
  };

  FridayVoice.prototype.speak = function (text, profile) {
    this.stopSpeak();
    return this.queue(text, profile);
  };

  // 3.4: private messages are read with an iPhone voice only (Settings: Private messages voice).
  FridayVoice.prototype.speakPrivate = function (text, profile) {
    this.stopSpeak();
    return this.queue(text, profile, null, { priv: true });
  };
  FridayVoice.prototype.privateVoice = function (profile) {
    var voices = this.listVoices();
    if (!voices.length) return null;
    var want = (root.FridayStorage.get("settings", {}) || {}).privateVoiceURI || "";
    if (want) for (var i = 0; i < voices.length; i++) if (voices[i].voiceURI === want) return voices[i];
    // the best iPhone voice that fits her (Premium first)
    var gender = (profile && profile.voiceGender) || "";
    var best = null, bs = -1;
    voices.forEach(function (v) {
      if (!/^en/i.test(v.lang || "")) return;
      var q = voiceQuality(v);
      if (q.rank === 0) return;
      var s = q.rank * 10 + (FridayVoice.voiceFitsGender(v.voiceURI, gender, voices) ? 5 : 0) + (/^en-(us|gb)/i.test(v.lang || "") ? 1 : 0);
      if (s > bs) { bs = s; best = v; }
    });
    return best || this.pickDefault(profile);
  };

  FridayVoice.prototype.preview = function (uri, profile) {
    var old = this.voiceURI;
    var self = this;
    var name = (profile && profile.assistantName) || "Friday";
    var term = profile && profile.terms && profile.terms[0] ? ", " + profile.terms[0] : "";
    this.stopSpeak();
    if (uri && uri.indexOf("ai:") === 0) return this._previewAI(uri.slice(3), "Hi" + term + ", I'm " + name + ". This is how I'd sound.");
    this.voiceURI = uri;
    var p = this.queue("Hi" + term + ", I'm " + name + ". This is how I'd sound.", profile);
    // Restore the chosen voice as soon as this line has started, so nothing else uses the preview voice.
    setTimeout(function () { if (self.voiceURI === uri) self.voiceURI = old; }, 50);
    return p.then(function () { if (self.voiceURI === uri) self.voiceURI = old; });
  };

  FridayVoice.prototype._previewAI = async function (voiceId, line) {
    audioSessionType("playback");
    await speakerOn();
    var gen = this._gen = (this._gen || 0) + 1;
    this.speaking = true;
    this._onState("speak-start");
    try {
      var buf;
      try { buf = await this._fetchClip(line, voiceId, ""); }
      catch (e) {
        var last = root.FridayStorage.get("aiVoiceError", null);
        var gem = String(voiceId || "").indexOf("gem-") === 0;
        if (!last || Date.now() - (last.at || 0) > 15000) root.FridayStorage.set("aiVoiceError", { provider: gem ? "gemini" : "groq", status: 0, msg: String((e && e.message) || ""), at: Date.now() });
        return { ok: false, reason: aiVoiceReason() };
      }
      if (gen !== this._gen) return { ok: true };
      try { await this._playBuffer(buf, 1, gen); }
      catch (e2) {
        root.FridayStorage.set("aiVoiceError", { status: "audio", msg: "", at: Date.now() });
        return { ok: false, reason: aiVoiceReason() };
      }
      root.FridayStorage.set("aiVoicePauseUntil", 0);
      return { ok: true };
    } finally {
      if (gen === this._gen) {
        this.speaking = false;
        if (!this._keepOsc) audioSessionType("auto");
        this._stopEnvelope();
        this._onVolume(0, "idle");
        this._onState("speak-end");
      }
    }
  };

  // ---------- Talk over her (barge-in) ----------
  FridayVoice.prototype._startBargeIn = function () {
    var s = root.FridayStorage.get("settings", {}) || {};
    if (!s.bargeIn || !this._analyser || !this._stream) return;
    var self = this;
    var started = performance.now();
    var loudSince = 0;
    this._stopBargeIn();
    this._bargeTimer = setInterval(function () {
      if (!self.speaking || self.listening) return;
      if (performance.now() - started < 700) return;
      self._analyser.getByteTimeDomainData(self._data);
      var sum = 0;
      for (var i = 0; i < self._data.length; i++) { var v = (self._data[i] - 128) / 128; sum += v * v; }
      var rms = Math.sqrt(sum / self._data.length);
      if (rms > 0.11) {
        if (!loudSince) loudSince = performance.now();
        if (performance.now() - loudSince > 320) {
          self._stopBargeIn();
          if (self.opts.onBargeIn) self.opts.onBargeIn();
        }
      } else loudSince = 0;
    }, 50);
  };

  FridayVoice.prototype._stopBargeIn = function () {
    if (this._bargeTimer) clearInterval(this._bargeTimer);
    this._bargeTimer = 0;
  };

  FridayVoice.prototype._fakeEnvelope = function (text) {
    var self = this;
    var i = 0;
    this._stopEnvelope();
    this._envTimer = setInterval(function () {
      if (!self.speaking) { self._stopEnvelope(); return; }
      var pulse = 0.45 + 0.55 * Math.abs(Math.sin(performance.now() / 140 + i));
      self.volume = pulse;
      self._onVolume(pulse, "friday");
      if (performance.now() - self._lastPeak > 130) {
        self._lastPeak = performance.now();
        self._onSyllable();
        i += 1;
      }
    }, 40);
  };

  FridayVoice.prototype._stopEnvelope = function () {
    if (this._envTimer) clearInterval(this._envTimer);
    this._envTimer = 0;
    this.volume = 0;
  };

  FridayVoice.prototype.stopSpeak = function () {
    this._gen = (this._gen || 0) + 1;
    this._queue = [];
    this._stopEnvelope();
    this._stopBargeIn();
    var wasPumping = this._pumping;
    this._pumping = false;
    this.speaking = false;
    try { speechSynthesis.cancel(); } catch (e) {}
    var T = nativeTTS();
    if (T) { try { T.stop(); } catch (e3) {} }
    if (this._src) { try { this._src.stop(); } catch (e2) {} this._src = null; }
    (this._srcs || []).forEach(function (x) { try { x.stop(); } catch (e5) {} });
    this._srcs = [];
    this._playhead = 0;
    if (wasPumping) {
      var waiters = this._waiters || [];
      this._waiters = [];
      waiters.forEach(function (w) { w(); });
    }
  };

  // Background window: a tone too quiet to hear keeps her audio engine (and so the app) awake
  // while you're in another app. Turned off again when the window ends or you come back.
  FridayVoice.prototype.keepAlive = function (on) {
    try {
      if (on) {
        audioSessionType("playback");
        var ctx = this._outCtx();
        if (ctx.state !== "running" && ctx.resume) ctx.resume();
        if (!this._keepOsc) {
          var o = ctx.createOscillator(), g = ctx.createGain();
          o.frequency.value = 24;
          g.gain.value = 0.0004;
          o.connect(g); g.connect(ctx.destination);
          o.start();
          this._keepOsc = o; this._keepGain = g;
        }
      } else if (this._keepOsc) {
        try { this._keepOsc.stop(); } catch (e1) {}
        try { this._keepGain.disconnect(); } catch (e2) {}
        this._keepOsc = null; this._keepGain = null;
        if (!this.speaking) audioSessionType("auto");
      }
    } catch (e) {}
    return !!this._keepOsc;
  };

  FridayVoice.prototype.releaseMic = function () {
    this.stopSpeak();
    if (this.listening) {
      try { if (this._rec && this._rec.state === "recording") this._rec.stop(); } catch (e) {}
      if (this._mode === "native") {
        var L = nativeListen();
        try { if (L) L.cancel(); } catch (e4) {}
        this._dropNative();
      }
      this.listening = false;
    }
    if (this._stream) {
      this._stream.getTracks().forEach(function (t) { t.stop(); });
      this._stream = null;
    }
    if (this._ctx) { try { this._ctx.close(); } catch (e) {} this._ctx = null; }
  };

  root.FridayVoice = FridayVoice;
})(window);
