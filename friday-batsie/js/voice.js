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
  }

  FridayVoice.prototype.listVoices = function () {
    return speechSynthesis.getVoices() || [];
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
    this._stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
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
        if (self.volume > 0.12) { self._heard = true; self._lastLoud = now; }
        if ((self._heard && now - self._lastLoud > 1300) || (!self._heard && now - self._listenStart > 8000)) {
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
    this._chunks = [];
    this._onState("listen-start");
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

  FridayVoice.prototype.stopListen = async function () {
    if (!this.listening) return "";
    this.listening = false;
    this.volume = 0;
    this._onVolume(0, "idle");
    this._onState("listen-stop");
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
    if (this._mode === "webkit") {
      try { if (this._wk) this._wk.stop(); } catch (e) {}
      return (await this._wkPromise) || (this._webkitText || "");
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
    return (data && data.text || "").trim();
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
  var TTS_URL = "https://api.groq.com/openai/v1/audio/speech";
  var TTS_MODEL = "canopylabs/orpheus-v1-english";
  var MOOD_VOICE = {
    normal: { rate: 1.02, pitch: 1.0, tag: "" },
    focus: { rate: 1.08, pitch: 1.0, tag: "" },
    hype: { rate: 1.1, pitch: 1.08, tag: "[cheerful]" },
    calm: { rate: 0.94, pitch: 0.98, tag: "[calm]" },
    bedtime: { rate: 0.9, pitch: 0.96, tag: "[whisper]" }
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
    mv.volume = night ? 0.65 : 1;
    return mv;
  };

  FridayVoice.prototype._aiVoiceId = function () {
    var uri = this.voiceURI || "";
    if (uri.indexOf("ai:") === 0) return uri.slice(3);
    return "";
  };

  FridayVoice.prototype._aiAllowed = function () {
    if (!this._aiVoiceId()) return false;
    if (!root.FridayStorage.hasApiKey()) return false;
    var until = root.FridayStorage.get("aiVoicePauseUntil", 0) || 0;
    return Date.now() > until;
  };

  function splitForTTS(text, max) {
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
      if (last && (last + " " + p).length <= max) merged[merged.length - 1] = last + " " + p;
      else merged.push(p);
    });
    return merged;
  }

  FridayVoice.prototype._fetchClip = async function (text, voiceId, tag) {
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
      var pause = /per day|daily|rpd|tpd/i.test(t) ? 3 * 3600 * 1000 : (res.status === 429 ? 10 * 60 * 1000 : 30 * 60 * 1000);
      if (res.status === 401) pause = 0;
      if (pause) root.FridayStorage.set("aiVoicePauseUntil", Date.now() + pause);
      throw new Error("tts " + res.status);
    }
    if (root.FridayBrain && root.FridayBrain.noteUse) root.FridayBrain.noteUse("", "tts");
    return res.arrayBuffer();
  };

  FridayVoice.prototype._outCtx = function () {
    if (!this._out || this._out.state === "closed") {
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
        self._outGain.gain.value = volume;
        src.connect(self._outGain);
        self._src = src;
        src.onended = function () { self._src = null; finish(); };
        src.start();
        self._realEnvelope();
        // Safety net: never wait longer than the clip plus a little.
        guard = setTimeout(finish, (buffer.duration || 5) * 1000 + 1500);
      };
      var resume = ctx.state === "running" ? Promise.resolve() : (ctx.resume ? ctx.resume() : Promise.resolve());
      Promise.resolve(resume).catch(function () {}).then(function () {
        var p = ctx.decodeAudioData(arrayBuf.slice(0), start, fail);
        if (p && p.catch) p.catch(fail);
      });
      setTimeout(function () { if (!self._src && !done && ctx.state !== "running") fail(new Error("audio-suspended")); }, 1500);
    });
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

  FridayVoice.prototype._speakSystem = function (text, profile, mv) {
    var self = this;
    return new Promise(function (resolve) {
      var u = new SpeechSynthesisUtterance(text);
      var voice = self.pickDefault(profile);
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

  FridayVoice.prototype._speakOne = async function (text, profile, gen) {
    var mv = this._moodVoice();
    if (this._aiAllowed()) {
      try {
        var parts = splitForTTS(text, 190);
        var voiceId = this._aiVoiceId();
        var next = this._fetchClip(parts[0], voiceId, mv.tag);
        for (var i = 0; i < parts.length; i++) {
          if (!this.speaking || gen !== this._gen) return;
          var buf = await next;
          if (gen !== this._gen) return;
          if (i + 1 < parts.length) next = this._fetchClip(parts[i + 1], voiceId, mv.tag);
          await this._playBuffer(buf, mv.volume, gen);
        }
        return;
      } catch (e) {
        // fall through to the iPhone voice for this line
      }
    }
    if (!this.speaking || gen !== this._gen) return;
    await this._speakSystem(text, profile, mv);
  };

  // Queue a line. She speaks queued lines in order; used for streamed replies.
  FridayVoice.prototype.queue = function (text, profile) {
    text = String(text || "").trim();
    if (!text) return this.whenDone();
    this._queue = this._queue || [];
    this._queue.push({ text: text, profile: profile });
    if (!this._pumping) this._pump();
    return this.whenDone();
  };

  FridayVoice.prototype._pump = async function () {
    this._pumping = true;
    this.speaking = true;
    this._onState("speak-start");
    this._startBargeIn();
    var gen = this._gen = (this._gen || 0) + 1;
    try {
      while (this._queue && this._queue.length && gen === this._gen) {
        var item = this._queue.shift();
        await this._speakOne(item.text, item.profile, gen);
      }
    } finally {
      if (gen === this._gen) {
        this._pumping = false;
        this.speaking = false;
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

  FridayVoice.prototype.preview = function (uri, profile) {
    var old = this.voiceURI;
    var self = this;
    var name = (profile && profile.assistantName) || "Friday";
    var term = profile && profile.terms && profile.terms[0] ? ", " + profile.terms[0] : "";
    this.stopSpeak();
    this.voiceURI = uri;
    var p = this.queue("Hi" + term + ", I'm " + name + ". This is how I'd sound.", profile);
    // Restore the chosen voice as soon as this line has started, so nothing else uses the preview voice.
    setTimeout(function () { if (self.voiceURI === uri) self.voiceURI = old; }, 50);
    return p.then(function () { if (self.voiceURI === uri) self.voiceURI = old; });
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
    if (this._src) { try { this._src.stop(); } catch (e2) {} this._src = null; }
    if (wasPumping) {
      var waiters = this._waiters || [];
      this._waiters = [];
      waiters.forEach(function (w) { w(); });
    }
  };

  FridayVoice.prototype.releaseMic = function () {
    this.stopSpeak();
    if (this.listening) {
      try { if (this._rec && this._rec.state === "recording") this._rec.stop(); } catch (e) {}
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
