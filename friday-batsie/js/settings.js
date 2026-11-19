/* Settings panel: looks, icons, layout, voice, shortcut, key, backup, restore, reset. */
(function (root) {
  "use strict";

  function cloneChips(list) {
    return (list || []).map(function (c) {
      return {
        id: c.id || ("c" + Math.random().toString(36).slice(2, 8)),
        label: c.label || "Chip",
        type: c.type || "shortcut",
        command: c.command || ""
      };
    });
  }

  function loadSettings() {
    var defaults = {
      look: null,
      voiceURI: "",
      shortcutName: null,
      widgetStyle: "clear",
      daddySms: "",
      layout: "orbit",
      iconId: "",
      morningBriefing: true,
      wakeGreeting: true,
      chips: null
    };
    var s = Object.assign(defaults, root.FridayStorage.get("settings", {}));
    if (!Array.isArray(s.chips)) {
      s.chips = cloneChips((root.FRIDAY_CONFIG && root.FRIDAY_CONFIG.DEFAULT_CHIPS) || []);
    }
    return s;
  }

  function saveSettings(s) {
    root.FridayStorage.set("settings", s);
  }

  function lookName(id) {
    var item = root.FRIDAY_CONFIG.LOOKS && root.FRIDAY_CONFIG.LOOKS[id];
    return item ? item.name : (id || "N");
  }

  function layoutName(id) {
    var list = (root.FRIDAY_CONFIG.LAYOUTS || []);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].name;
    return "Orbit";
  }

  function iconName(id) {
    var list = (root.FRIDAY_CONFIG.ICON_CHOICES || []);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].name;
    return "Current";
  }

  function uuid() {
    if (root.crypto && crypto.randomUUID) return crypto.randomUUID().toUpperCase();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    }).toUpperCase();
  }

  function b64(buf) {
    var b = new Uint8Array(buf), s = "", i;
    for (i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/(.{76})/g, "$1\n");
  }

  function xml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function appUrl(profileId) {
    var path = (location.pathname || "/").replace(/index\.html$/, "");
    if (path.slice(-1) !== "/") path += "/";
    return location.origin + path + "?u=" + encodeURIComponent(profileId);
  }

  function buildMobileconfig(iconB64, href, label, tag) {
    var id1 = uuid(), id2 = uuid();
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
      '<plist version="1.0"><dict>\n' +
      '<key>PayloadContent</key><array><dict>\n' +
      '<key>FullScreen</key><true/>\n' +
      '<key>Icon</key><data>\n' + iconB64 + '\n</data>\n' +
      '<key>IgnoreManifestScope</key><true/>\n' +
      '<key>IsRemovable</key><true/>\n' +
      '<key>Label</key><string>' + xml(label) + '</string>\n' +
      '<key>PayloadDescription</key><string>Web Clip</string>\n' +
      '<key>PayloadDisplayName</key><string>' + xml(label) + '</string>\n' +
      '<key>PayloadIdentifier</key><string>com.friday.' + tag + '.webclip</string>\n' +
      '<key>PayloadType</key><string>com.apple.webClip.managed</string>\n' +
      '<key>PayloadUUID</key><string>' + id1 + '</string>\n' +
      '<key>PayloadVersion</key><integer>1</integer>\n' +
      '<key>Precomposed</key><true/>\n' +
      '<key>URL</key><string>' + xml(href) + '</string>\n' +
      '</dict></array>\n' +
      '<key>PayloadDescription</key><string>Adds ' + xml(label) + ' to your Home Screen with her own icon.</string>\n' +
      '<key>PayloadDisplayName</key><string>' + xml(label) + '</string>\n' +
      '<key>PayloadIdentifier</key><string>com.friday.' + tag + '.profile</string>\n' +
      '<key>PayloadOrganization</key><string>Friday</string>\n' +
      '<key>PayloadRemovalDisallowed</key><false/>\n' +
      '<key>PayloadType</key><string>Configuration</string>\n' +
      '<key>PayloadUUID</key><string>' + id2 + '</string>\n' +
      '<key>PayloadVersion</key><integer>1</integer>\n' +
      '</dict></plist>\n';
  }

  function FridaySettings(opts) {
    this.profile = opts.profile;
    this.voice = opts.voice;
    this.onLook = opts.onLook || function () {};
    this.onLayout = opts.onLayout || function () {};
    this.onIcon = opts.onIcon || function () {};
    this.onChips = opts.onChips || function () {};
    this.onReset = opts.onReset || function () {};
    this.onToast = opts.onToast || function () {};
    this.values = loadSettings();
    if (!this.values.look) this.values.look = this.profile.defaultLook || "N";
    if (!this.values.shortcutName) this.values.shortcutName = this.profile.shortcutName || "Friday";
    if (!this.values.layout) this.values.layout = "orbit";
    if (this.profile.daddySms && !this.values.daddySms) this.values.daddySms = this.profile.daddySms;
    saveSettings(this.values);
    this._bind();
  }

  FridaySettings.prototype._syncHeaders = function () {
    var looks = document.getElementById("looks-current");
    var icons = document.getElementById("icons-current");
    var layouts = document.getElementById("layout-current");
    if (looks) looks.textContent = lookName(this.values.look);
    if (icons) icons.textContent = this.values.iconId ? iconName(this.values.iconId) : "Current";
    if (layouts) layouts.textContent = layoutName(this.values.layout);
  };

  FridaySettings.prototype._bindLooks = function () {
    var self = this;
    var looks = document.getElementById("looks");
    if (!looks) return;
    looks.innerHTML = "";
    var L = root.FRIDAY_CONFIG.LOOKS;
    var groups = root.FRIDAY_CONFIG.LOOK_GROUPS || [];
    groups.forEach(function (g) {
      var wrap = document.createElement("div");
      wrap.className = "look-group";
      var h = document.createElement("h2");
      h.textContent = g.name;
      wrap.appendChild(h);
      var grid = document.createElement("div");
      grid.className = "look-grid";
      (g.ids || []).forEach(function (id) {
        var item = L[id];
        if (!item) return;
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "look" + (self.values.look === id ? " on" : "");
        btn.setAttribute("data-look", id);
        btn.innerHTML = "<b>" + item.name + "</b><span>" + item.blurb + "</span>";
        btn.addEventListener("click", function () { self.setLook(id); });
        grid.appendChild(btn);
      });
      wrap.appendChild(grid);
      looks.appendChild(wrap);
    });
  };

  FridaySettings.prototype._bindIcons = function () {
    var self = this;
    var grid = document.getElementById("icon-grid");
    if (!grid) return;
    grid.innerHTML = "";
    (root.FRIDAY_CONFIG.ICON_CHOICES || []).forEach(function (item) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "icon-choice" + (self.values.iconId === item.id ? " on" : "");
      btn.setAttribute("data-icon", item.id);
      btn.innerHTML = "<img alt=\"\" src=\"icons/choices/" + item.id + "-180.png\"><b>" + item.name + "</b>";
      btn.addEventListener("click", function () { self.setIcon(item.id); });
      grid.appendChild(btn);
    });
  };

  FridaySettings.prototype._bindLayouts = function () {
    var self = this;
    var grid = document.getElementById("layout-grid");
    if (!grid) return;
    grid.innerHTML = "";
    (root.FRIDAY_CONFIG.LAYOUTS || []).forEach(function (item) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "layout-choice" + (self.values.layout === item.id ? " on" : "");
      btn.setAttribute("data-layout", item.id);
      btn.innerHTML = "<b>" + item.name + "</b><span>" + item.blurb + "</span>";
      btn.addEventListener("click", function () { self.setLayout(item.id); });
      grid.appendChild(btn);
    });
  };

  FridaySettings.prototype._bindChips = function () {
    var self = this;
    var box = document.getElementById("chip-editor");
    if (!box) return;
    box.innerHTML = "";
    (this.values.chips || []).forEach(function (chip, i) {
      var row = document.createElement("div");
      row.className = "chip-edit";
      var label = document.createElement("input");
      label.type = "text";
      label.value = chip.label || "";
      label.placeholder = "Label";
      var type = document.createElement("select");
      [["shortcut", "Shortcut"], ["weather", "Weather"], ["text", "Send as chat"]].forEach(function (opt) {
        var o = document.createElement("option");
        o.value = opt[0];
        o.textContent = opt[1];
        if (chip.type === opt[0]) o.selected = true;
        type.appendChild(o);
      });
      var cmd = document.createElement("input");
      cmd.type = "text";
      cmd.className = "chip-cmd";
      cmd.placeholder = chip.type === "shortcut" ? "Shortcut command" : "Optional message";
      cmd.value = chip.command || "";
      cmd.style.display = chip.type === "weather" ? "none" : "";
      var del = document.createElement("button");
      del.type = "button";
      del.className = "btn danger";
      del.textContent = "Remove";
      function write() {
        self.values.chips[i].label = label.value.trim() || "Chip";
        self.values.chips[i].type = type.value;
        self.values.chips[i].command = cmd.value.trim();
        saveSettings(self.values);
        self.onChips();
      }
      label.onchange = label.onblur = write;
      cmd.onchange = cmd.onblur = write;
      type.onchange = function () {
        cmd.style.display = type.value === "weather" ? "none" : "";
        write();
      };
      del.onclick = function () {
        self.values.chips.splice(i, 1);
        saveSettings(self.values);
        self._bindChips();
        self.onChips();
      };
      row.appendChild(label);
      row.appendChild(type);
      row.appendChild(del);
      row.appendChild(cmd);
      box.appendChild(row);
    });
  };

  FridaySettings.prototype._bind = function () {
    var self = this;
    this._bindLooks();
    this._bindIcons();
    this._bindLayouts();
    this._bindChips();
    this._syncHeaders();

    var briefing = document.getElementById("set-briefing");
    var wake = document.getElementById("set-wake");
    if (briefing) {
      briefing.checked = this.values.morningBriefing !== false;
      briefing.onchange = function () {
        self.values.morningBriefing = briefing.checked;
        saveSettings(self.values);
      };
    }
    if (wake) {
      wake.checked = this.values.wakeGreeting !== false;
      wake.onchange = function () {
        self.values.wakeGreeting = wake.checked;
        saveSettings(self.values);
      };
    }
    var addChip = document.getElementById("btn-chip-add");
    if (addChip) {
      addChip.onclick = function () {
        self.values.chips = self.values.chips || [];
        self.values.chips.push({ id: "c" + Math.random().toString(36).slice(2, 8), label: "New chip", type: "shortcut", command: "" });
        saveSettings(self.values);
        self._bindChips();
        self.onChips();
      };
    }

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
      self.onChips();
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

    var upd = document.getElementById("btn-update");
    if (upd) {
      upd.onclick = function () {
        upd.disabled = true;
        self.onToast("Checking for updates…");
        var work = Promise.resolve();
        if (navigator.serviceWorker) {
          work = navigator.serviceWorker.getRegistrations().then(function (regs) {
            return Promise.all(regs.map(function (r) { return r.unregister(); }));
          });
        }
        work.then(function () {
          if (!root.caches) return;
          return caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (k) { return caches.delete(k); }));
          });
        }).then(function () {
          location.reload();
        }).catch(function () {
          location.reload();
        });
      };
    }

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

  FridaySettings.prototype.setLook = function (id) {
    if (!id || !root.FRIDAY_CONFIG.LOOKS[id]) return;
    this.values.look = id;
    saveSettings(this.values);
    var looks = document.getElementById("looks");
    if (looks) {
      looks.querySelectorAll(".look").forEach(function (b) {
        b.classList.toggle("on", b.getAttribute("data-look") === id);
      });
    }
    this._syncHeaders();
    this.onLook(id);
  };

  FridaySettings.prototype.look = function () {
    return this.values.look || "N";
  };

  FridaySettings.prototype.setLayout = function (id) {
    this.values.layout = id || "orbit";
    saveSettings(this.values);
    var grid = document.getElementById("layout-grid");
    if (grid) {
      grid.querySelectorAll(".layout-choice").forEach(function (b) {
        b.classList.toggle("on", b.getAttribute("data-layout") === id);
      });
    }
    this._syncHeaders();
    this.onLayout(this.values.layout);
  };

  FridaySettings.prototype.layout = function () {
    return this.values.layout || "orbit";
  };

  FridaySettings.prototype.setIcon = function (id) {
    var self = this;
    this.values.iconId = id;
    saveSettings(this.values);
    var grid = document.getElementById("icon-grid");
    if (grid) {
      grid.querySelectorAll(".icon-choice").forEach(function (b) {
        b.classList.toggle("on", b.getAttribute("data-icon") === id);
      });
    }
    this._syncHeaders();
    this.onIcon(id);
    var tag = (this.profile.id || "sky").replace(/[^a-z0-9]/g, "") || "sky";
    var label = this.profile.assistantName || (tag === "batsie" ? "Jarvis" : "Friday");
    var href = appUrl(this.profile.id || "sky");
    fetch("icons/choices/" + id + "-180.png").then(function (r) {
      if (!r.ok) throw new Error("icon");
      return r.arrayBuffer();
    }).then(function (buf) {
      var file = buildMobileconfig(b64(buf), href, label, tag);
      var blob = new Blob([file], { type: "application/x-apple-aspen-config" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = label + "-" + id + ".mobileconfig";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
      self.onToast("Install it in Settings, then delete the old icon.");
    }).catch(function () {
      self.onToast("Could not build the icon file. Try again on the site.");
    });
  };

  root.FridaySettings = FridaySettings;
  root.FridayLoadSettings = loadSettings;
})(window);
