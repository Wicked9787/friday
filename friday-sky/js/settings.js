/* Settings panel: looks, voice, shortcut, key, backup, restore, reset. */
(function (root) {
  "use strict";

  function loadSettings() {
    return Object.assign({
      look: null,
      voiceURI: "",
      shortcutName: null,
      widgetStyle: "clear",
      daddySms: ""
    }, root.FridayStorage.get("settings", {}));
  }

  function saveSettings(s) {
    root.FridayStorage.set("settings", s);
  }

  function FridaySettings(opts) {
    this.profile = opts.profile;
    this.voice = opts.voice;
    this.onLook = opts.onLook || function () {};
    this.onReset = opts.onReset || function () {};
    this.onToast = opts.onToast || function () {};
    this.values = loadSettings();
    if (!this.values.look) this.values.look = this.profile.defaultLook || "N";
    if (!this.values.shortcutName) this.values.shortcutName = this.profile.shortcutName || "Friday";
    if (this.profile.daddySms && !this.values.daddySms) this.values.daddySms = this.profile.daddySms;
    saveSettings(this.values);
    this._bind();
  }

  FridaySettings.prototype._bind = function () {
    var self = this;
    var looks = document.getElementById("looks");
    looks.innerHTML = "";
    var L = root.FRIDAY_CONFIG.LOOKS;
    Object.keys(L).forEach(function (id) {
      var item = L[id];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "look" + (self.values.look === id ? " on" : "");
      btn.innerHTML = "<b>" + item.name + "</b><span>" + item.blurb + "</span>";
      btn.addEventListener("click", function () {
        self.values.look = id;
        saveSettings(self.values);
        self._bind();
        self.onLook(id);
      });
      looks.appendChild(btn);
    });

    var voiceSel = document.getElementById("set-voice");
    function fillVoices() {
      var voices = self.voice.listVoices();
      var cur = self.values.voiceURI;
      voiceSel.innerHTML = "";
      var opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = "Automatic (" + (self.profile.voiceHint || "best match") + ")";
      voiceSel.appendChild(opt0);
      voices.forEach(function (v) {
        var o = document.createElement("option");
        o.value = v.voiceURI;
        o.textContent = v.name + " · " + v.lang;
        if (v.voiceURI === cur) o.selected = true;
        voiceSel.appendChild(o);
      });
    }
    fillVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = fillVoices;
    }
    voiceSel.onchange = function () {
      self.values.voiceURI = voiceSel.value;
      self.voice.setVoiceURI(voiceSel.value);
      saveSettings(self.values);
    };
    document.getElementById("voice-hint").textContent = "Suggested for this phone: " + (this.profile.voiceHint || "") + ".";

    var sc = document.getElementById("set-shortcut");
    sc.value = this.values.shortcutName;
    sc.onchange = sc.onblur = function () {
      self.values.shortcutName = sc.value.trim() || "Friday";
      saveSettings(self.values);
    };

    var key = document.getElementById("set-key");
    var mask = document.getElementById("key-mask");
    mask.textContent = root.FridayStorage.hasApiKey() ? "Saved on this phone: " + root.FridayStorage.maskKey(root.FridayStorage.getApiKey()) : "No key saved yet.";
    document.getElementById("btn-key-save").onclick = function () {
      if (!key.value.trim()) { self.onToast("Paste a new key first."); return; }
      root.FridayStorage.setApiKey(key.value);
      key.value = "";
      mask.textContent = "Saved on this phone: " + root.FridayStorage.maskKey(root.FridayStorage.getApiKey());
      self.onToast("Key saved on this phone.");
    };
    document.getElementById("btn-key-clear").onclick = function () {
      if (!confirm("Clear the Groq key from this phone?")) return;
      root.FridayStorage.setApiKey("");
      key.value = "";
      mask.textContent = "No key saved yet.";
      self.onToast("Key cleared.");
    };

    var daddyRow = document.getElementById("row-daddy");
    var daddy = document.getElementById("set-daddy");
    if (this.profile.id === "batsie") {
      daddyRow.style.display = "";
      daddy.value = (this.values.daddySms || "").replace(/^sms:/, "");
      daddy.onchange = daddy.onblur = function () {
        var v = daddy.value.trim();
        self.values.daddySms = v ? (v.indexOf("sms:") === 0 ? v : "sms:" + v.replace(/[^\d+]/g, "")) : "sms:";
        saveSettings(self.values);
        root.dispatchEvent(new CustomEvent("friday:daddy"));
      };
    } else {
      daddyRow.style.display = "none";
    }

    document.getElementById("set-widget").value = this.values.widgetStyle || "clear";
    document.getElementById("set-widget").onchange = function () {
      self.values.widgetStyle = this.value;
      saveSettings(self.values);
    };

    document.getElementById("btn-backup").onclick = function () {
      root.FridayStorage.downloadBackup(document.getElementById("backup-include-key").checked);
      self.onToast("Backup downloaded.");
    };
    document.getElementById("btn-restore").onclick = function () {
      document.getElementById("restore-file").click();
    };
    document.getElementById("restore-file").onchange = function (ev) {
      var file = ev.target.files && ev.target.files[0];
      ev.target.value = "";
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          root.FridayStorage.applyBackup(data);
          self.onToast("Backup restored. Reloading.");
          setTimeout(function () { location.reload(); }, 500);
        } catch (e) {
          self.onToast("That file could not be read.");
        }
      };
      reader.readAsText(file);
    };

    document.getElementById("btn-reset").onclick = function () {
      if (!confirm("Clear Friday’s memory, notes, chat, and layout on this phone? The Groq key can stay.")) return;
      var keep = confirm("Keep the Groq API key on this phone?");
      root.FridayStorage.resetAll(keep);
      self.onReset();
    };
  };

  FridaySettings.prototype.shortcutName = function () {
    return this.values.shortcutName || "Friday";
  };
  FridaySettings.prototype.look = function () {
    return this.values.look || "N";
  };

  root.FridaySettings = FridaySettings;
  root.FridayLoadSettings = loadSettings;
})(window);
