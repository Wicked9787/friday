/* Tap-to-talk: Groq Whisper with webkitSpeechRecognition fallback, plus speechSynthesis. */
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
    if (this.voiceURI) {
      for (var i = 0; i < voices.length; i++) if (voices[i].voiceURI === this.voiceURI) return voices[i];
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
      if (/enhanced|premium|siri|neural/.test(n)) s += 1;
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

  FridayVoice.prototype.speak = function (text, profile) {
    var self = this;
    this.stopSpeak();
    text = String(text || "").trim();
    if (!text) return Promise.resolve();
    return new Promise(function (resolve) {
      var u = new SpeechSynthesisUtterance(text);
      var voice = self.pickDefault(profile);
      if (voice) u.voice = voice;
      u.rate = 1.02;
      u.pitch = 1.0;
      self._utterance = u;
      self.speaking = true;
      self._onState("speak-start");
      self._fakeEnvelope(text);
      u.onend = function () {
        self.speaking = false;
        self._stopEnvelope();
        self._onVolume(0, "idle");
        self._onState("speak-end");
        resolve();
      };
      u.onerror = function () {
        self.speaking = false;
        self._stopEnvelope();
        self._onVolume(0, "idle");
        self._onState("speak-end");
        resolve();
      };
      speechSynthesis.speak(u);
    });
  };

  FridayVoice.prototype._fakeEnvelope = function (text) {
    var self = this;
    var words = text.split(/\s+/);
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
    this._stopEnvelope();
    this.speaking = false;
    try { speechSynthesis.cancel(); } catch (e) {}
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
