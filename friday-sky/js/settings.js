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
      chips: null,
      render: "max",
      mood: "normal",
      nightMode: false,
      nightFrom: 22,
      nightTo: 7,
      fastReplies: true,
      bargeIn: false,
      briefingNews: true,
      iphoneTimers: true,
      voiceSpeed: 1,
      fallbackVoiceURI: "",
      webMode: "smart",
      handsFree: true,
      nightlyRecap: true,
      recapHour: 21,
      restingOrb: true,
      nightOrb: true,
      partnerMessages: true,
      partnerNames: "",
      partnerContact: "",
      talkTime: "normal",
      liveListen: true,
      textsInApp: true,
      bgMinutes: 3,
      talkStyle: "pill",
      orbTalk: true,
      hideOrbTyping: false,
      speakTyped: false,
      suggestions: true,
      font: "sf",
      uiSize: 1,
      refreshEvery: 0,
      refreshHour: 10,
      privateVoiceURI: "",
      onDeviceListen: true,
      healthBrief: false,
      pictures: true,
      cameraInApp: false,
      widgetReply: false,
      homeWifi: "",
      billAlerts: true,
      countdownAlerts: true
    };
    var stored = root.FridayStorage.get("settings", {}) || {};
    // 3.3: the best quality (Max) replaces HD once. Original stays Original.
    if (!stored.renderMax33) {
      if (stored.render !== "original") stored.render = "max";
      stored.renderMax33 = true;
      root.FridayStorage.set("settings", stored);
    }
    var s = Object.assign(defaults, stored);
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

  function isNativeApp() {
    try {
      if (root.Capacitor && typeof root.Capacitor.isNativePlatform === "function" && root.Capacitor.isNativePlatform()) {
        return true;
      }
    } catch (e) {}
    return location.protocol === "capacitor:";
  }

  var SHORTCUT_PROMPT = "Get the Shortcut Input as text and use it as the request. If it is empty, stop this shortcut. Make a lowercase copy of the request to check against, but when sending a message use the request's original words and capitalization. Check it in this order and only do the first one that matches:\n1. If it contains \"remind me\" or \"reminder\": take what to be reminded about and the date and time from the request, and add it to the Reminders app with an alert at that time (if no time is said, alert in one hour).\n2. If it starts with \"text\" or \"message\" (or \"send a text to\"): the contact name is the words after that up to the word \"saying\" (if there is no \"saying\", it is the next word), and the message body is everything after \"saying\". Send that body, with its original capitalization, to that contact with Send Message, without showing the compose sheet.\n3. If it starts with \"call\", the rest is a contact name; call that contact. If it starts with \"facetime\", the rest is a contact name; FaceTime that contact.\n4. If it contains \"calendar\", \"schedule\", \"appointment\" or \"what's on\": if it says \"add\" or \"schedule a\" or \"schedule an\", take the event name and the date and time from the request and add a calendar event with them (if no time is said, use tomorrow at 9 AM), then show a quiet notification that it was added. Otherwise find calendar events for today (or tomorrow if the request says tomorrow) and show their titles and times as a quiet notification.\n5. If it contains \"light\", \"lights\", \"lamp\", \"dim\", \"brighten\" or \"brightness\", or it is \"turn all on\", \"turn all off\", \"turn everything on\" or \"turn everything off\": find the room name if one is said (like living room, bedroom, kitchen, bathroom, porch); if no room is said, use every light in the home. Then: if it has a number with a percent sign or the word percent, or says \"to\" followed by a number (like \"50%\", \"50 percent\", \"set the lights to 50\"), turn those lights on and set their brightness to exactly that number. Otherwise if it says \"dim\", set their brightness to 30. Otherwise if it says \"brighten\", \"full\" or \"all the way up\", set their brightness to 100. Otherwise if it says \"off\", turn them off. Otherwise if it says a color (like red, blue, warm white), turn them on and set that color. Otherwise if it says \"on\", turn them on.\n6. If it contains \"apple tv\" or \"tv\": if it says \"off\", put the Apple TV to sleep. If it says \"on\", wake the Apple TV. If it says \"play\" or \"pause\", toggle Play/Pause on the Apple TV. If it says \"open\" followed by an app name (like Netflix, YouTube, Hulu, Disney+), open that app on the Apple TV. Otherwise, wake the Apple TV.\n7. If it contains \"homepod\", \"speaker\" or \"volume\", or says \"turn it up\" or \"turn it down\" (music on the iPhone itself is done by the app): if it says \"homepod\", set the playback destination to the HomePod first. Then if it says \"pause\", pause; if it says \"resume\", play; if it says \"skip\" or \"next\", skip forward; if it says \"previous\" or \"back\", skip back; if it says \"volume\" or \"turn it up\" or \"turn it down\" with a number, set the volume to that percent (up means 80, down means 30 if no number is said). Otherwise if it says \"play\" followed by words, search Apple Music for those words and play the first result; otherwise shuffle and play my music library.\n8. If it contains \"good night\" or \"goodnight\", run the Home scene \"Good Night\".\n9. If it contains \"scene\", take the words before or after \"scene\" as the scene name (drop words like run, set, turn on, the) and run the Home scene with that name.\n10. If it contains \"timer\", find the number of minutes in the request and start a timer in the Clock app for that many minutes.\n11. If it contains \"alarm\", find the time in the request and create an alarm for that time.\n12. If it contains \"do not disturb\", \"don't disturb\" or \"dnd\": if it says \"off\", turn the Do Not Disturb focus off; otherwise turn it on.\n13. If it contains \"battery\", get the battery level and show it as a quiet notification.\n14. If it contains \"cameras\", open the app Roku Smart Home.\n15. If it contains \"camera\", open the app Camera.\n16. Otherwise, do nothing.\nWhen any of steps 1 to 13 or step 16 is done, the very last action is Open URLs with {BACK_URL} so the phone goes straight back to {APP}. Do not open it after steps 14 or 15, because those open another app on purpose.\nDo not add any Speak Text or Dictate Text step anywhere; the app does all the talking and listening. Do not show alerts or ask questions. Make every notification silent.";
  // The prompt names this app's own address, so the Shortcut comes right back to Friday (or Jarvis).
  function shortcutPromptFor(profile) {
    var app = (profile && profile.assistantName) || "Friday";
    return SHORTCUT_PROMPT.replace(/\{BACK_URL\}/g, app.toLowerCase() + "://").replace(/\{APP\}/g, app);
  }

  var AGENT_PRESETS = (root.FridayBrain && root.FridayBrain.PRESETS) || {
    openai: { label: "ChatGPT / OpenAI", name: "ChatGPT", base: "https://api.openai.com/v1", model: "gpt-5-mini" },
    groq: { label: "Groq", name: "Groq", base: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b" },
    custom: { label: "Any other (OpenAI-compatible)", name: "", base: "", model: "" }
  };

  function loadConnections() {
    var list = root.FridayStorage.get("connections", []);
    return Array.isArray(list) ? list : [];
  }

  function saveConnections(list) {
    root.FridayStorage.set("connections", list || []);
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
    this.onAddBubble = opts.onAddBubble || function () {};
    this.onRender = opts.onRender || function () {};
    this.onNight = opts.onNight || function () {};
    this.onChange30 = opts.onChange30 || function () {};
    this.onLearnBubbles = opts.onLearnBubbles || function () {};
    this.values = loadSettings();
    if (!this.values.look) this.values.look = this.profile.defaultLook || "N";
    if (!this.values.shortcutName) this.values.shortcutName = this.profile.shortcutName || "Friday";
    if (!this.values.layout) this.values.layout = "orbit";
    if (this.profile.daddySms && !this.values.daddySms) this.values.daddySms = this.profile.daddySms;
    saveSettings(this.values);
    this._bind();
    this._pronouns();
  }

  // 3.5.1: Reed is a he, so his Settings say "Him" instead of "Her".
  FridaySettings.prototype._pronouns = function () {
    if ((this.profile || {}).pronoun !== "him") return;
    document.querySelectorAll('.shub-b[data-group="her"] .shub-l, .sgroup[data-group="her"] .sgroup-h').forEach(function (e) { e.textContent = "Him"; });
    var hf = document.querySelector('#qs-handsfree');
    var small = hf && hf.parentNode ? hf.parentNode.querySelector("small") : null;
    if (small) small.textContent = small.textContent.replace(/\bher\b/, "him");
  };

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
        btn.innerHTML = '<i class="look-thumb" data-thumb="' + id + '"></i><b>' + item.name + "</b><span>" + item.blurb + "</span>";
        btn.addEventListener("click", function () { self.setLook(id); });
        grid.appendChild(btn);
      });
      wrap.appendChild(grid);
      looks.appendChild(wrap);
    });
    this._bindThumbs(looks);
  };

  // Draw a still preview of each Look, a few at a time, once the Looks menu opens.
  FridaySettings.prototype._bindThumbs = function (looks) {
    var acc = document.getElementById("accord-looks");
    var started = false;
    function run() {
      if (started || !root.FridayOrb || !root.FridayOrb.thumbnail) return;
      started = true;
      var items = Array.prototype.slice.call(looks.querySelectorAll(".look-thumb[data-thumb]"));
      (function next() {
        var el = items.shift();
        if (!el) return;
        var url = root.FridayOrb.thumbnail(el.getAttribute("data-thumb"), 160);
        if (url) {
          looks.querySelectorAll('.look-thumb[data-thumb="' + el.getAttribute("data-thumb") + '"]').forEach(function (t) {
            t.style.backgroundImage = "url(" + url + ")";
            t.setAttribute("data-done", "1");
          });
        }
        setTimeout(next, 0);
      })();
    }
    if (!acc || acc.open) setTimeout(run, 50);
    if (acc) acc.addEventListener("toggle", function () { if (acc.open) run(); });
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
      btn.innerHTML = layoutPreview(item.id) + "<b>" + item.name + "</b><span>" + item.blurb + "</span>";
      btn.addEventListener("click", function () { self.setLayout(item.id); });
      grid.appendChild(btn);
    });
  };

  // A small picture of each layout: where the orb sits and where the bubbles go.
  var LP_FRAMES = { orbit: [0.46, 0.28], ring: [0.46, 0.26], dock: [0.42, 0.32], grid: [0.24, 0.2], arc: [0.34, 0.26], orbonly: [0.5, 0.34], immersive: [0.5, 0.42], orbtop: [0.27, 0.27], orbdock: [0.8, 0.15], orbclock: [0.58, 0.3], double: [0.44, 0.24], spiral: [0.3, 0.24], home: [0.22, 0.18], list: [0.28, 0.22], sheet: [0.25, 0.2] };
  function layoutPreview(id) {
    var W = 64, H = 112, f = LP_FRAMES[id] || LP_FRAMES.orbit, cx = W / 2, cy = f[0] * H, r = f[1] * W * 0.9;
    var g = "lpg" + id, dots = [], i, a;
    function dot(x, y, rr, gold) { dots.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (rr || 3.2) + '" fill="' + (gold ? "#e8c872" : "#3a3a3e") + '" stroke="rgba(232,200,114,.5)" stroke-width=".6"/>'); }
    if (id === "orbit") { [[-1.5, -1.2], [1.4, -1.0], [-1.7, 0.4], [1.6, 0.6], [-0.7, 1.6], [0.9, 1.7], [0, -1.8]].forEach(function (p, k) { dot(cx + p[0] * r * 0.9, cy + p[1] * r * 0.85, 3.4, k % 2); }); }
    else if (id === "ring" || id === "double") { for (i = 0; i < 8; i++) { a = i / 8 * Math.PI * 2; dot(cx + Math.cos(a) * r * 1.55, cy + Math.sin(a) * r * 1.55, 3, i % 2); } if (id === "double") for (i = 0; i < 10; i++) { a = i / 10 * Math.PI * 2 + 0.3; dot(cx + Math.cos(a) * r * 2.15, cy + Math.sin(a) * r * 2.15, 2.4, (i + 1) % 2); } }
    else if (id === "dock" || id === "sheet") { if (id === "sheet") dots.push('<rect x="3" y="70" width="58" height="40" rx="7" fill="rgba(255,255,255,.06)"/>'); for (i = 0; i < 5; i++) dot(10 + i * 11, id === "sheet" ? 84 : 100, 3.4, i % 2); if (id === "sheet") for (i = 0; i < 5; i++) dot(10 + i * 11, 98, 3.4, (i + 1) % 2); }
    else if (id === "grid" || id === "home") { for (i = 0; i < 12; i++) dot(12 + (i % 4) * 13.3, 50 + Math.floor(i / 4) * 14, 3.6, i % 3 === 0); if (id === "home") { dots.push('<rect x="5" y="94" width="54" height="14" rx="6" fill="rgba(255,255,255,.06)"/>'); for (i = 0; i < 4; i++) dot(13 + i * 12.7, 101, 3.2, i % 2); } }
    else if (id === "arc") { for (i = 0; i < 7; i++) { a = Math.PI * (0.1 + 0.8 * i / 6); dot(cx - Math.cos(a) * 24, cy + 18 + Math.sin(a) * 22, 3.2, i % 2); } }
    else if (id === "spiral") { for (i = 0; i < 9; i++) { a = i * 0.9; var rr = 10 + i * 2.6; dot(cx + Math.cos(a) * rr, cy + 26 + Math.sin(a) * rr * 0.7, 2.8, i % 2); } }
    else if (id === "list") { for (i = 0; i < 5; i++) { dots.push('<rect x="8" y="' + (52 + i * 11) + '" width="48" height="7" rx="3.5" fill="' + (i % 2 ? "#3a3a3e" : "rgba(232,200,114,.55)") + '"/>'); } }
    else { dots.push('<rect x="24" y="104" width="16" height="2.4" rx="1.2" fill="rgba(255,255,255,.35)"/>'); }
    if (id === "orbclock") dots.push('<text x="32" y="22" fill="#efece8" font-size="13" font-weight="300" text-anchor="middle" font-family="-apple-system,sans-serif">9:41</text><rect x="20" y="27" width="24" height="2" rx="1" fill="rgba(255,255,255,.3)"/>');
    if (id === "orbtop") dots.push('<rect x="12" y="60" width="40" height="3" rx="1.5" fill="rgba(255,255,255,.45)"/><rect x="18" y="66" width="28" height="3" rx="1.5" fill="rgba(255,255,255,.3)"/>');
    if (id === "orbdock") dots.push('<rect x="12" y="62" width="40" height="3" rx="1.5" fill="rgba(255,255,255,.45)"/>');
    var top = id === "immersive" ? "" : '<circle cx="44" cy="8" r="2" fill="rgba(255,255,255,.35)"/><circle cx="50" cy="8" r="2" fill="rgba(255,255,255,.35)"/><circle cx="56" cy="8" r="2" fill="rgba(255,255,255,.35)"/>';
    return '<svg class="lp" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><defs><radialGradient id="' + g + '"><stop offset="0" stop-color="#fff3cf"/><stop offset=".35" stop-color="#e8c872"/><stop offset=".7" stop-color="rgba(196,132,42,.45)"/><stop offset="1" stop-color="rgba(196,132,42,0)"/></radialGradient></defs>' +
      top + '<circle cx="' + cx + '" cy="' + cy.toFixed(1) + '" r="' + (r * 1.35).toFixed(1) + '" fill="url(#' + g + ')"/><circle cx="' + cx + '" cy="' + cy.toFixed(1) + '" r="' + (r * 0.42).toFixed(1) + '" fill="#0b0b0c" stroke="rgba(255,255,255,.5)" stroke-width=".6"/>' + dots.join("") + '</svg>';
  }

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
    var iconAccord = document.getElementById("accord-icons");
    if (isNativeApp() && iconAccord) {
      iconAccord.hidden = true;
      iconAccord.style.display = "none";
    } else {
      this._bindIcons();
    }
    this._bindLayouts();
    this._bindChips();
    this._bindConnections();
    this._bindShortcutSetup();
    this._bind30();
    this._bind31();
    this._bind33();
    this._bind34();
    this._bind35();
    this._bindCamera();
    this._bindStandby();
    this._bindSelf();
    this._bindNav();
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

    this._bindVoice();
    this._bindBrainMood();
    this._bindWidgets();

    var sc = document.getElementById("set-shortcut");
    sc.value = this.values.shortcutName;
    sc.onchange = sc.onblur = function () {
      self.values.shortcutName = sc.value.trim() || "Friday";
      saveSettings(self.values);
      self.onChips();
    };

    var key = document.getElementById("set-key");
    var mask = document.getElementById("key-mask");
    function keyPh() { key.placeholder = root.FridayStorage.hasApiKey() ? "Key saved. Paste a new one to replace it." : "Paste your Groq key"; }
    function syncKey() {
      keyPh();
      var mk = document.getElementById("mainkey-current");
      if (mk) mk.textContent = root.FridayStorage.hasApiKey() ? "Saved" : "Not set";
      mask.textContent = root.FridayStorage.hasApiKey() ? "Saved on this phone: " + root.FridayStorage.maskKey(root.FridayStorage.getApiKey()) : "No key saved yet.";
    }
    this._syncKey = syncKey;
    syncKey();
    document.getElementById("btn-key-save").onclick = function () {
      if (!key.value.trim()) { self.onToast("Paste a new key first."); return; }
      root.FridayStorage.setApiKey(key.value);
      key.value = "";
      mask.textContent = "Saved on this phone: " + root.FridayStorage.maskKey(root.FridayStorage.getApiKey());
      keyPh();
      self.onToast("Key saved on this phone.");
    };
    document.getElementById("btn-key-clear").onclick = function () {
      if (!confirm("Clear the Groq key from this phone?")) return;
      root.FridayStorage.setApiKey("");
      key.value = "";
      mask.textContent = "No key saved yet.";
      keyPh();
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

    document.getElementById("btn-backup").onclick = async function () {
      var r = null;
      try { r = await root.FridayStorage.downloadBackup(document.getElementById("backup-include-key").checked); } catch (e) {}
      if (!r) self.onToast("The backup didn't save. Try again.");
      else if (r.how === "copied") self.onToast("Backup copied. Paste it into a note in Notes to keep it.");
      else if (r.how === "download") self.onToast("Backup downloaded.");
      else self.onToast(r.completed ? "Backup saved." : "Backup not saved. Tap Save to Files next time.");
    };
    document.getElementById("btn-restore").onclick = function () {
      document.getElementById("restore-file").click();
    };
    var rp = document.getElementById("btn-restore-paste");
    if (rp) rp.onclick = async function () {
      var t = "";
      try { t = await navigator.clipboard.readText(); } catch (e) {}
      if (!t) t = root.prompt ? (root.prompt("Paste the backup text here") || "") : "";
      try {
        root.FridayStorage.applyBackup(JSON.parse(t));
        self.onToast("Backup restored. Reloading.");
        setTimeout(function () { location.reload(); }, 500);
      } catch (e2) { self.onToast("That doesn't look like a Friday backup. Copy the whole thing and try again."); }
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

  FridaySettings.prototype._bindVoice = function () {
    var self = this;
    var listEl = document.getElementById("voice-list");
    var fbSel = document.getElementById("set-voice-fallback");
    var allBox = document.getElementById("set-voice-all");
    var cur = document.getElementById("voice-current");
    var V = root.FridayVoice;
    var playing = null;
    function label(uri) {
      if (!uri) return "Automatic (natural AI voice)";
      if (uri.indexOf("ai:") === 0) {
        var a = (V.AI_VOICES || []).filter(function (x) { return x.id === uri; })[0];
        return a ? a.name + " (AI)" : "AI voice";
      }
      var v = self.voice.listVoices().filter(function (x) { return x.voiceURI === uri; })[0];
      return v ? v.name.replace(/\s*\((enhanced|premium)\)/i, "") : "Automatic";
    }
    function stopPreview() {
      self.voice.stopSpeak();
      if (playing) { playing.textContent = "▶"; playing.classList.remove("on"); playing = null; }
    }
    function row(uri, name, sub, tag) {
      var chosen = (self.values.voiceURI || "") === uri;
      var r = document.createElement("div");
      r.className = "voice-row" + (chosen ? " on" : "");
      r.setAttribute("role", "radio");
      r.setAttribute("aria-checked", chosen ? "true" : "false");
      r.tabIndex = 0;
      var check = document.createElement("span");
      check.className = "voice-check";
      check.textContent = chosen ? "✓" : "";
      var txt = document.createElement("span");
      txt.className = "voice-txt";
      var b = document.createElement("b"); b.textContent = name;
      txt.appendChild(b);
      if (tag) { var t = document.createElement("span"); t.className = "life-tag"; t.textContent = tag; b.appendChild(t); }
      var sm = document.createElement("small"); sm.textContent = sub;
      txt.appendChild(sm);
      var pv = document.createElement("button");
      pv.type = "button";
      pv.className = "voice-play";
      pv.textContent = "▶";
      pv.setAttribute("aria-label", "Preview " + name);
      pv.onclick = function (e) {
        e.stopPropagation();
        if (playing === pv) { stopPreview(); return; }
        stopPreview();
        self.voice.unlockAudio();
        if (uri.indexOf("ai:") === 0 && !root.FridayStorage.hasApiKey()) { self.onToast("AI voices need your Groq key."); return; }
        playing = pv; pv.textContent = "■"; pv.classList.add("on");
        self.voice.preview(uri, self.profile).then(function (res) {
          if (playing === pv) { pv.textContent = "▶"; pv.classList.remove("on"); playing = null; }
          if (uri.indexOf("ai:") === 0) aiStatus(res && res.ok === false ? res.reason : "AI voices are working.", !(res && res.ok === false));
        });
      };
      function choose() {
        stopPreview();
        self.values.voiceURI = uri;
        self.voice.setVoiceURI(uri);
        saveSettings(self.values);
        if (uri.indexOf("ai:") === 0) root.FridayStorage.set("aiVoicePauseUntil", 0);
        listEl.querySelectorAll(".voice-row").forEach(function (x) { x.classList.remove("on"); x.setAttribute("aria-checked", "false"); x.querySelector(".voice-check").textContent = ""; });
        r.classList.add("on"); r.setAttribute("aria-checked", "true"); check.textContent = "✓";
        if (cur) cur.textContent = label(uri);
      }
      r.onclick = choose;
      r.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } };
      r.appendChild(check); r.appendChild(txt); r.appendChild(pv);
      listEl.appendChild(r);
    }
    function head(text) {
      var h = document.createElement("div");
      h.className = "voice-head";
      h.textContent = text;
      listEl.appendChild(h);
    }
    function aiStatus(text, good) {
      var el = document.getElementById("ai-voice-status");
      if (!el) return;
      el.textContent = text || "";
      el.className = "voice-status" + (text ? (good ? " good" : " bad") : "");
    }
    function fill() {
      if (!listEl) return;
      var all = !!(allBox && allBox.checked);
      var cat = self.voice.catalog(all);
      listEl.innerHTML = "";
      var autoName = V.autoAiFor ? V.autoAiFor(self.profile) : "daniel";
      row("", "Automatic", "Natural AI voice (" + autoName.charAt(0).toUpperCase() + autoName.slice(1) + "). Uses the best iPhone voice when the free AI voice is out for the day.", "");
      head("AI voices · free, about 100 replies a day");
      var st = document.createElement("div");
      st.id = "ai-voice-status";
      listEl.appendChild(st);
      var tb = document.createElement("button");
      tb.type = "button";
      tb.className = "btn";
      tb.id = "btn-test-ai-voice";
      tb.textContent = "Test AI voices";
      tb.onclick = function () {
        stopPreview();
        self.voice.unlockAudio();
        if (!root.FridayStorage.hasApiKey()) { aiStatus("AI voices need your Groq key.", false); return; }
        aiStatus("Testing…", true);
        var pick = (self.values.voiceURI || "").indexOf("ai:") === 0 ? self.values.voiceURI : "ai:" + (V.autoAiFor ? V.autoAiFor(self.profile) : "diana");
        self.voice.preview(pick, self.profile).then(function (res) {
          aiStatus(res && res.ok === false ? res.reason : "AI voices are working.", !(res && res.ok === false));
        });
      };
      listEl.appendChild(tb);
      var why = V.aiVoiceReason ? V.aiVoiceReason() : "";
      if (why) aiStatus(why, false);
      (V.AI_VOICES || []).filter(function (a) { return !a.gemini; }).forEach(function (a) { row(a.id, a.name, a.blurb.replace(/^AI voice · /, "") + " · " + a.gender, "AI"); });
      var gemOn = V.geminiKey && V.geminiKey();
      head("Gemini voices" + (gemOn ? "" : " · add a Gemini key in Brains to use these"));
      (V.AI_VOICES || []).filter(function (a) { return a.gemini; }).forEach(function (a) { row(a.id, a.name, a.blurb.replace(/^Gemini voice · /, "") + " · " + a.gender, "Gemini"); });
      ["Premium", "Enhanced", "Siri", "Standard", "Fun"].forEach(function (q) {
        var items = cat.filter(function (c) { return c.quality === q; });
        if (!items.length) return;
        head("iPhone · " + q);
        items.forEach(function (c) { row(c.uri, c.name, c.lang, q === "Premium" || q === "Enhanced" ? q : ""); });
      });
      var hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = "Want better iPhone voices? Download Enhanced or Premium voices for free in iPhone Settings → Accessibility → Spoken Content → Voices → English. Then reopen this list.";
      listEl.appendChild(hint);
      if (fbSel) {
        var fb = self.values.fallbackVoiceURI || "";
        fbSel.innerHTML = "";
        var o0 = document.createElement("option"); o0.value = ""; o0.textContent = "Automatic (" + (self.profile.voiceHint || "best match") + ")"; if (!fb) o0.selected = true; fbSel.appendChild(o0);
        cat.forEach(function (c) { var o = document.createElement("option"); o.value = c.uri; o.textContent = c.name + " · " + c.lang + (c.quality !== "Standard" ? " · " + c.quality : ""); if (fb === c.uri) o.selected = true; fbSel.appendChild(o); });
      }
      if (cur) cur.textContent = label(self.values.voiceURI || "");
    }
    fill();
    if (window.speechSynthesis && speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = fill;
    root.addEventListener("friday:voices", fill);
    setTimeout(fill, 800);
    if (allBox) allBox.onchange = fill;
    if (fbSel) fbSel.onchange = function () { self.values.fallbackVoiceURI = fbSel.value; saveSettings(self.values); };
    var sp = document.getElementById("set-voice-speed"), spv = document.getElementById("voice-speed-val");
    if (sp) {
      sp.value = self.values.voiceSpeed || 1;
      if (spv) spv.textContent = (+sp.value).toFixed(2).replace(/0$/, "") + "×";
      sp.oninput = function () { if (spv) spv.textContent = (+sp.value).toFixed(2).replace(/0$/, "") + "×"; };
      sp.onchange = function () { self.values.voiceSpeed = +sp.value; saveSettings(self.values); };
    }
    var acc = document.getElementById("accord-voice");
    if (acc) acc.addEventListener("toggle", function () { if (!acc.open) stopPreview(); });
    var hint = document.getElementById("voice-hint");
    if (hint) hint.textContent = "Tap a voice to choose it, or ▶ to hear it first. AI voices sound the most natural; Premium iPhone voices come next.";
  };

  // ---------- 3.3: font and size ----------
  var FONTS = [
    { id: "sf", name: "SF Pro", note: "iPhone look", stack: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif' },
    { id: "inter", name: "Inter", note: "Clean, modern", stack: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif' },
    { id: "outfit", name: "Outfit", note: "Soft, round", stack: '"Outfit", -apple-system, BlinkMacSystemFont, sans-serif' },
    { id: "sora", name: "Sora", note: "Wide, techy", stack: '"Sora", -apple-system, BlinkMacSystemFont, sans-serif' },
    { id: "space", name: "Space Grotesk", note: "Techy", stack: '"Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif' },
    { id: "exo", name: "Exo 2", note: "Futuristic", stack: '"Exo 2", -apple-system, BlinkMacSystemFont, sans-serif' },
    { id: "rajdhani", name: "Rajdhani", note: "HUD, sci-fi", stack: '"Rajdhani", -apple-system, BlinkMacSystemFont, sans-serif' },
    { id: "orbitron", name: "Orbitron", note: "Sci-fi titles", stack: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif', title: '"Orbitron", -apple-system, BlinkMacSystemFont, sans-serif' }
  ];
  var SIZE_NAMES = { "1": "Normal", "0.9": "Small", "0.8": "Extra small", "0.72": "Tiny" };
  function applyType(v) {
    v = v || {};
    var f = FONTS.filter(function (x) { return x.id === (v.font || "sf"); })[0] || FONTS[0];
    var de = document.documentElement;
    de.style.setProperty("--font", f.stack);
    de.style.setProperty("--font-title", f.title || f.stack);
    var z = +v.uiSize || 1;
    if (!(z >= 0.6 && z <= 1.2)) z = 1;
    de.style.setProperty("--ui-zoom", String(z));
  }
  root.FridayApplyType = applyType;
  root.FridayFonts = FONTS;
  try { applyType(root.FridayLoadSettings ? root.FridayLoadSettings() : {}); } catch (e) {}

  FridaySettings.prototype._bind33 = function () {
    var self = this, v = this.values;
    function save() { saveSettings(v); }
    function talk() { if (root.__fridayApplyTalkbar) root.__fridayApplyTalkbar(); }
    function setText(id, t) { var e = document.getElementById(id); if (e) e.textContent = t; }
    function bubblesApi() { return root.__friday && root.__friday.bubbles; }

    // main screen
    var ts = document.getElementById("talk-style");
    function syncTs() {
      if (ts) ts.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-talk-style") === (v.talkStyle || "pill")); });
      setText("mainscreen-current", v.talkStyle === "dock" ? "Glass dock" : "Pill bar");
    }
    if (ts) ts.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-talk-style]");
      if (!b) return;
      v.talkStyle = b.getAttribute("data-talk-style");
      save(); syncTs(); talk();
    });
    syncTs();
    function bindToggle(id, key, dflt, after) {
      var el = document.getElementById(id);
      if (!el) return;
      el.checked = dflt ? v[key] !== false : v[key] === true;
      el.addEventListener("change", function () { v[key] = el.checked; save(); if (after) after(); talk(); });
    }
    bindToggle("set-orb-talk", "orbTalk", true);
    bindToggle("set-hide-orb", "hideOrbTyping", false);
    bindToggle("set-speak-typed", "speakTyped", false);
    bindToggle("set-suggestions", "suggestions", true, function () { syncQuick(); });
    bindToggle("set-pictures", "pictures", true);

    // quick switches on the hub mirror the real switches
    var pairs = [["qs-handsfree", "set-handsfree"], ["qs-live", "set-live-listen"], ["qs-suggest", "set-suggestions"]];
    function syncQuick() {
      pairs.forEach(function (p) {
        var q = document.getElementById(p[0]), o = document.getElementById(p[1]);
        if (q && o) q.checked = o.checked;
      });
    }
    pairs.forEach(function (p) {
      var q = document.getElementById(p[0]);
      if (q) q.addEventListener("change", function () {
        var o = document.getElementById(p[1]);
        if (!o) return;
        o.checked = q.checked;
        o.dispatchEvent(new Event("change"));
      });
    });
    this._syncQuick = syncQuick;
    syncQuick();

    // font and size
    var fg = document.getElementById("font-grid");
    function syncFont() {
      if (fg) fg.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-font") === (v.font || "sf")); });
      var f = FONTS.filter(function (x) { return x.id === (v.font || "sf"); })[0] || FONTS[0];
      var z = +v.uiSize || 1;
      setText("font-current", f.name + (z !== 1 ? " · " + (SIZE_NAMES[String(z)] || "Small") : ""));
      var us0 = document.getElementById("ui-size");
      if (us0) us0.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", +b.getAttribute("data-size") === z); });
    }
    if (fg && !fg.children.length) FONTS.forEach(function (f) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-font", f.id);
      b.style.fontFamily = f.title || f.stack;
      b.appendChild(document.createTextNode(f.name));
      var sm = document.createElement("small");
      sm.textContent = f.note;
      b.appendChild(sm);
      b.onclick = function () { v.font = f.id; save(); applyType(v); syncFont(); };
      fg.appendChild(b);
    });
    var us = document.getElementById("ui-size");
    if (us) us.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-size]");
      if (!b) return;
      v.uiSize = +b.getAttribute("data-size");
      save(); applyType(v); syncFont();
      var bb = bubblesApi(); if (bb) bb.layout();
    });
    applyType(v);
    syncFont();

    // links (Connections page): one step, with a bubble on her home screen
    function normLink(url) {
      url = String(url || "").trim();
      if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && /^[\w.-]+\.[a-z]{2,}([\/:?#]|$)/i.test(url)) url = "https://" + url;
      return url;
    }
    function addLink(name, url, extra) {
      var list = loadConnections();
      var c = Object.assign({ id: "c" + Math.random().toString(36).slice(2, 9), name: name, url: url, kind: "link" }, extra || {});
      list.push(c);
      saveConnections(list);
      if (self._renderConnections) self._renderConnections();
      var bb = bubblesApi();
      if (bb && bb.add) { try { bb.add({ kind: "link", label: name, gold: true, size: "lg", action: "url", url: url, connectionId: c.id, addedAt: Date.now() }); } catch (e) {} }
      return c;
    }
    self._addLink = addLink;
    var la = document.getElementById("btn-link-add");
    if (la) la.onclick = function () {
      var ne = document.getElementById("link-name"), ue = document.getElementById("link-url");
      var name = String((ne || {}).value || "").trim(), url = normLink((ue || {}).value);
      if (!name) { setText("link-status", "Give it a name, like Refresh apps or Spotify."); return; }
      if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) { setText("link-status", "Paste a link that starts with https:// or an app link like spotify://."); return; }
      addLink(name, url);
      ne.value = ""; ue.value = "";
      setText("link-status", "Added " + name + ". It's on her home screen, and you can say “open " + name + "”.");
    };
    var rr = document.getElementById("btn-ready-refresh");
    if (rr) rr.onclick = function () {
      if (loadConnections().some(function (c) { return c.ready === "refresh"; })) {
        setText("refresh-status", "Refresh apps is already in your links. Tap its bubble or say “refresh my apps”.");
        return;
      }
      var R = root.FridayRefresh;
      (R ? R.url() : Promise.resolve("localdevvpn://enable?scheme=altload")).then(function (url) {
        addLink("Refresh apps", url, { ready: "refresh" });
        setText("refresh-status", "Added. Tap the Refresh apps bubble or say “refresh my apps”: LocalDevVPN comes on and your installer opens, then you tap Refresh.");
      });
    };

    // refresh reminder
    var re = document.getElementById("refresh-every"), rh = document.getElementById("refresh-hour");
    function hourLabel(h) { return (h % 12 || 12) + (h < 12 ? " AM" : " PM"); }
    if (rh && !rh.options.length) for (var h = 6; h <= 22; h++) { var o = document.createElement("option"); o.value = String(h); o.textContent = hourLabel(h); rh.appendChild(o); }
    function syncRefresh() {
      var n = +v.refreshEvery || 0;
      if (re) re.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", +b.getAttribute("data-every") === n); });
      if (rh) rh.value = String(v.refreshHour || 10);
      setText("refresh-current", n ? "Every " + n + " days" : "Off");
    }
    function reschedule() { if (root.FridayRefresh && root.FridayRefresh.schedule) root.FridayRefresh.schedule(true); }
    if (re) re.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-every]");
      if (!b) return;
      v.refreshEvery = +b.getAttribute("data-every");
      save(); syncRefresh(); reschedule();
      if (v.refreshEvery && root.__fridayTurnOnNotifications) root.__fridayTurnOnNotifications();
    });
    if (rh) rh.onchange = function () { v.refreshHour = +rh.value || 10; save(); syncRefresh(); reschedule(); };
    var rn = document.getElementById("btn-refresh-now");
    if (rn) rn.onclick = function () { if (root.FridayRefresh) root.FridayRefresh.run(); };
    syncRefresh();

    // Cloudflare (two boxes: account ID + token)
    var cfo = document.getElementById("btn-cf-open"), cfb = document.getElementById("cf-box");
    if (cfo && cfb) cfo.onclick = function () { cfb.hidden = !cfb.hidden; };
    var cfs = document.getElementById("btn-cf-site");
    if (cfs) cfs.onclick = function () { try { window.open("https://dash.cloudflare.com/profile/api-tokens", "_blank"); } catch (e) {} };
    var cfa = document.getElementById("btn-cf-add");
    if (cfa) cfa.onclick = function () {
      var B = root.FridayBrain;
      var acc = String((document.getElementById("cf-account") || {}).value || "").trim();
      var tokEl = document.getElementById("cf-token");
      var tok = String((tokEl || {}).value || "").trim();
      var say = function (t) { setText("paste-key-status", t); };
      if (!/^[a-f0-9]{32}$/i.test(acc)) { say("The Account ID is 32 letters and numbers. Find it on the right side of your Cloudflare dashboard."); return; }
      if (tok.length < 20) { say("Paste the whole Cloudflare API token."); return; }
      if (!B || !B.addCloudflare) return;
      cfa.disabled = true;
      say("Checking Cloudflare…");
      B.addCloudflare(acc, tok, say).then(function (r) {
        cfa.disabled = false;
        if (r.ok) {
          if (tokEl) tokEl.value = "";
          if (self._renderConnections) self._renderConnections();
          if (self._syncBrain) self._syncBrain();
          say("Cloudflare is added and on as a backup brain (model " + r.model + "). You can also say “ask Cloudflare …”.");
        } else {
          say(r.reason === "auth" ? "Cloudflare didn't accept that token. Make a token with the Workers AI template and paste it again." : "Cloudflare didn't answer (" + r.reason + "). Check the Account ID and token.");
        }
      });
    };
  };

  // ---------- 3.5: Personal Voice, steps and sleep, home Wi-Fi, NFC stickers ----------
  FridaySettings.prototype._bind35 = function () {
    var self = this, v = this.values, prof = this.profile || {};
    function el(id) { return document.getElementById(id); }
    function N() { return root.FridayNative; }
    var pv = el("btn-personal-voice");
    if (pv) pv.onclick = function () {
      if (!N() || !N().kit.personalVoice) { self.onToast("Personal Voice works in the installed app."); return; }
      N().kit.personalVoice().then(function (r) {
        var st = el("pv-status");
        var msg = r.status === "authorized" ? (r.voices && r.voices.length ? "Allowed. Pick “" + r.voices[0].name + "” in the voice list below." : "Allowed, but there's no Personal Voice on this iPhone yet. Make one in iPhone Settings → Accessibility → Personal Voice.")
          : r.status === "denied" ? "Not allowed. Turn it on in iPhone Settings → Accessibility → Personal Voice → Allow Apps to Request to Use." : "Personal Voice isn't available on this iPhone.";
        if (st) st.textContent = msg;
        if (self._renderVoices) try { self._renderVoices(); } catch (e) {}
      });
    };
    var hb = el("set-health-brief");
    if (hb) {
      hb.checked = v.healthBrief === true;
      hb.onchange = function () {
        v.healthBrief = hb.checked; saveSettings(v);
        if (hb.checked && N() && N().kit.health) N().kit.health().then(function (r) { if (!r.ok) self.onToast("Health isn't available. Turn on HealthKit in AltLoad's entitlements and reinstall."); });
      };
    }
    var hw = el("btn-home-wifi"), hws = el("homewifi-status");
    function syncWifi() { if (hws && v.homeWifi) hws.textContent = "Home Wi-Fi: " + v.homeWifi + ". On another network, Apple Home or your Shortcut takes over straight away."; }
    if (hw) hw.onclick = function () {
      if (!N() || !N().kit.wifiName) { self.onToast("This works in the installed app."); return; }
      N().kit.wifiName(true).then(function (ss) {
        if (!ss) { self.onToast("I can't see the Wi-Fi name. Turn on Access Wi-Fi Information in AltLoad, reinstall, and allow location."); return; }
        v.homeWifi = ss; saveSettings(v); syncWifi(); self.onToast("Home Wi-Fi saved: " + ss);
      });
    };
    syncWifi();
    var nh = el("nfc-hint");
    if (nh) { var sc = prof.scheme || (prof.assistantName || "Friday").toLowerCase(); nh.innerHTML = nh.innerHTML.replace(/friday:\/\//g, sc + "://"); }
  };

  // 3.5.2: camera inside the app (off by default; the Shortcut opens Apple's Camera until you turn this on)
  FridaySettings.prototype._bindCamera = function () {
    var v = this.values, el = document.getElementById("set-camera-inapp");
    if (!el) return;
    el.checked = v.cameraInApp === true;
    el.onchange = function () { v.cameraInApp = el.checked; saveSettings(v); };
  };

  // ---------- 3.5.6: StandBy widget that shows her current orb look ----------
  function standbyScript(name, scheme) {
    return [
      "// " + name + " StandBy: her current orb look, from " + name + "'s folder in Files.",
      "// Needs a Scriptable File Bookmark named \"" + name + "\" pointing to On My iPhone > " + name + " > Widget.",
      "const NAME = " + JSON.stringify(name) + ", SCHEME = " + JSON.stringify(scheme) + ";",
      "const fm = FileManager.local();",
      "const mode = String(args.widgetParameter || '').toLowerCase();",
      "const w = new ListWidget();",
      "w.backgroundColor = new Color('#000000');",
      "w.url = SCHEME + '://listen';",
      "w.setPadding(4, 4, 4, 4);",
      "let dir = null;",
      "try { dir = fm.bookmarkedPath(NAME); } catch (e) {}",
      "if (!dir) {",
      "  const t = w.addText('Open Scriptable settings > File Bookmarks and add the ' + NAME + ' > Widget folder, named ' + NAME + '.');",
      "  t.font = Font.systemFont(11); t.textColor = new Color('#e8c872');",
      "} else {",
      "  let info = {};",
      "  try { info = JSON.parse(fm.readString(fm.joinPath(dir, 'friday-widget.json'))); } catch (e) {}",
      "  const frame = Math.floor(Date.now() / 900000) % 4;",
      "  let img = null;",
      "  try { img = Image.fromFile(fm.joinPath(dir, 'orb-' + frame + '.jpg')) || Image.fromFile(fm.joinPath(dir, 'orb-0.jpg')); } catch (e) {}",
      "  w.addSpacer();",
      "  const small = mode === 'info' || mode === 'clock';",
      "  if (img) { const s = w.addStack(); s.addSpacer(); const im = s.addImage(img); im.imageSize = new Size(small ? 100 : 140, small ? 100 : 140); s.addSpacer(); }",
      "  if (mode === 'clock') {",
      "    w.addSpacer(2);",
      "    const d = w.addDate(new Date()); d.applyTimeStyle(); d.font = Font.boldRoundedSystemFont(22); d.textColor = new Color('#f2e6c8'); d.centerAlignText();",
      "  }",
      "  if (mode === 'info') {",
      "    w.addSpacer(4);",
      "    const ago = info.talkedAt ? Math.round((Date.now() - info.talkedAt) / 60000) : null;",
      "    const when = ago === null ? 'Tap to talk' : ago < 2 ? 'Just talked' : ago < 60 ? 'Talked ' + ago + ' min ago' : ago < 1440 ? 'Talked ' + Math.round(ago / 60) + ' h ago' : 'Tap to talk';",
      "    const t1 = w.addText((info.name || NAME) + ' · ' + when); t1.font = Font.semiboldSystemFont(11); t1.textColor = new Color('#e8c872'); t1.centerAlignText();",
      "    if (info.reply) { const t2 = w.addText(info.reply); t2.font = Font.systemFont(10); t2.textColor = new Color('#eeeeee'); t2.lineLimit = 3; t2.centerAlignText(); }",
      "  }",
      "  w.addSpacer();",
      "}",
      "w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);",
      "if (config.runsInWidget) Script.setWidget(w); else await w.presentSmall();",
      "Script.complete();"
    ].join("\n");
  }
  // 3.6: Friday's own personality: her foundation, traits, change ledger, patterns, last reflection.
  // Identity review and Reset (your override). Friday only.
  FridaySettings.prototype._bindSelf = function () {
    var self = this, box = document.getElementById("self-box"), acc = document.getElementById("accord-self");
    if (!box || !acc) return;
    var P = function () { return root.FridayPersona; };
    if (!P() || !P().on(this.profile)) { box.hidden = true; acc.hidden = true; return; }
    box.hidden = false; acc.hidden = false;
    var name = (this.profile && this.profile.assistantName) || "Friday";
    function el(id) { return document.getElementById(id); }
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    var paint = function () {
      var m = P().selfModel();
      el("self-feel").textContent = (m.mood ? "Mood today: " + m.mood.label + " · " : "") + "Maturity: " + m.maturity.label + " (" + m.maturity.basis + ")";
      el("self-current").textContent = m.mood ? m.mood.label : m.maturity.label;
      el("self-note").textContent = "“" + m.foundation.statement + "”";
      el("self-traits").innerHTML = m.traits.map(function (t) {
        var pct = Math.round(t.v * 10), basePct = Math.round(t.base * 10), origPct = Math.round(t.original * 10);
        var bright = t.status === "developing" || t.status === "reconsidering";
        return '<div style="display:flex;align-items:center;gap:8px;margin:3px 0;font-size:12.5px"><span style="width:104px;color:rgba(239,236,232,.85)">' + esc(t.label) + '</span>' +
          '<span style="position:relative;flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.08)"><span style="position:absolute;left:0;top:0;bottom:0;width:' + pct + '%;border-radius:3px;background:' + (bright ? "#e9d3a0" : "rgba(232,200,114,.75)") + '"></span>' +
          '<span style="position:absolute;top:-3px;bottom:-3px;width:2px;left:' + basePct + '%;background:rgba(255,255,255,.4)"></span>' +
          (origPct !== basePct ? '<span style="position:absolute;top:-2px;width:5px;height:10px;border-radius:3px;margin-left:-2px;left:' + origPct + '%;background:rgba(120,170,255,.8)"></span>' : '') + '</span>' +
          '<span style="width:34px;text-align:right;color:' + (bright ? "#e9d3a0" : "rgba(239,236,232,.6)") + '">' + t.v + (t.status === "reconsidering" ? "?" : "") + '</span></div>';
      }).join("") + '<div class="sub" style="margin-top:6px">The white line is her current baseline. A blue mark shows where she started, once her baseline has moved. A bright bar is still settling, and a ? means she\'s reconsidering it. Each trait can develop up to 1.5 points in any 30 days.</div>';
      el("self-ledger").innerHTML = m.recent.length ? m.recent.map(function (e) { return '<div style="margin:0 0 6px">' + esc(new Date(e.at).toLocaleDateString([], { month: "short", day: "numeric" })) + " · " + esc(P().changeText(e)) + (e.evidence ? '<br><span style="opacity:.7">Because: ' + esc(e.evidence) + "</span>" : "") + "</div>"; }).join("") : "Nothing has changed yet.";
      var pats = m.patterns.map(function (o) { return "• " + esc(o.text); }).concat(m.provisional.slice(-4).map(function (o) { return '• <span style="opacity:.7">' + esc(o.text) + " (still testing)</span>"; }));
      el("self-patterns").innerHTML = pats.length ? pats.join("<br>") : "None yet.";
      var lr = m.foundation.lastReview, el2 = P().reviewEligible();
      var dot0 = function (t) { t = String(t || "").trim(); return t && !/[.!?]$/.test(t) ? t + "." : t; };
      el("self-review").textContent = (lr ? "Last review " + new Date(lr.at).toLocaleDateString([], { month: "short", day: "numeric" }) + " (" + (lr.by === "friday" ? "she started it" : "you asked") + "): " + (lr.evolved ? "her identity evolved. " : "she kept her identity. ") + dot0(lr.reason) + " " : "No identity review yet. ") +
        (el2.ok ? "She'll review her identity after her next reflection." : "She'll start one herself when her experience warrants it.") + " Identity version " + m.foundation.version + ".";
      var R = P().reflections(), r = R[R.length - 1];
      var dot = function (t) { t = String(t || "").trim(); return t && !/[.!?]$/.test(t) ? t + "." : t; };
      el("self-reflect").textContent = r ? new Date(r.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + ": " + dot(r.learned || r.happened || "") + (r.selfCritique ? " Self-check: " + dot(r.selfCritique) : "") + (r.applied.length ? " Changed: " + r.applied.join(", ") + "." : " No personality changes.") : "She hasn't reflected yet. She will once you've talked a bit with the app open.";
    };
    paint();
    if (!this._selfWatch) { this._selfWatch = true; root.addEventListener("friday:self", paint); }
    el("btn-self-review").onclick = function () {
      var b = el("btn-self-review"); b.disabled = true; b.textContent = "Reviewing…";
      P().reviewIdentity({ by: "owner" }).then(function (r) { self.onToast(r.text); paint(); }, function () { self.onToast("The review didn't finish. Try again later."); })
        .then(function () { b.disabled = false; b.textContent = "Ask for an identity review"; });
    };
    el("btn-self-reset").onclick = function () {
      if (!confirm("Reset " + name + "'s personality to how she started? Her traits and patterns start over. Her history and Memory are kept.")) return;
      P().reset();
      self.onToast(name + "'s personality is reset.");
    };
  };

  FridaySettings.prototype._bindStandby = function () {
    var self = this, v = this.values, prof = this.profile || {};
    var name = prof.assistantName || "Friday", scheme = name.toLowerCase() === "reed" ? "jarvis" : name.toLowerCase();
    var wr = document.getElementById("set-widget-reply");
    if (wr) { wr.checked = v.widgetReply === true; wr.onchange = function () { v.widgetReply = wr.checked; saveSettings(v); if (root.__fridaySyncWidget) root.__fridaySyncWidget(true); }; }
    var cp = document.getElementById("btn-standby-copy");
    if (cp) cp.onclick = function () {
      var txt = standbyScript(name, scheme);
      root.__fridayLastStandby = txt;
      var done = function () { self.onToast("StandBy script copied. Paste it into a new Scriptable script."); };
      try { navigator.clipboard.writeText(txt).then(done, function () { self.onToast("Couldn't copy. Try again."); }); } catch (e) { self.onToast("Couldn't copy. Try again."); }
      if (root.__fridaySyncWidget) root.__fridaySyncWidget(true);
    };
  };
  root.FridayStandbyScript = standbyScript;

  // ---------- 3.4: private line ----------
  FridaySettings.prototype._bind34 = function () {
    var self = this, v = this.values;
    var PL = root.FridayPrivate;
    var prof = this.profile || {};
    // 3.5.1: Jarvis is now called Reed, but his app address stays jarvis:// so old links keep working.
    var other = prof.id === "batsie" ? "Friday" : "Reed", otherScheme = prof.id === "batsie" ? "friday" : "jarvis";
    var partner = String(v.partnerNames || (prof.id === "batsie" ? "Sky" : "Batsie")).split(",")[0].trim() || (prof.id === "batsie" ? "Sky" : "Batsie");
    function el(id) { return document.getElementById(id); }
    function setText(id, t) { var e = el(id); if (e) e.textContent = t; }
    var pairBtn = el("btn-private-pair"), verBtn = el("btn-private-verify"), unBtn = el("btn-private-unpair"), wordsEl = el("private-words"), steps = el("private-steps");
    async function sync() {
      if (!PL || !PL.available()) { setText("private-current", "Not available"); if (steps) steps.textContent = "This phone can't lock messages."; return; }
      var st = await PL.status();
      setText("private-current", !st.paired ? (st.sent ? "Waiting for " + other : "Not paired") : (st.verified ? "Paired · words checked" : "Paired · check the words"));
      if (steps) {
        if (!st.paired && !st.sent) steps.innerHTML = "<b>1.</b> Tap <b>Pair</b>. A text with your key opens: tap Send.<br><b>2.</b> " + partner + " opens it in " + other + " (tap the link). " + other + " sends a key back the same way.<br><b>3.</b> You both see 4 safety words. If they match, tap <b>The words match</b> on both phones.";
        else if (!st.paired) steps.innerHTML = "Your key is on its way to " + partner + ". When " + other + " sends a key back, open it here (tap the link in the text). Didn't go through? Tap <b>Send my key again</b>.";
        else if (!st.verified) steps.innerHTML = "Check these 4 words with " + partner + " in person or on a call. " + other + " shows them in Settings → Phone → Messages → Private line. Same words? Tap <b>The words match</b>. Different? Tap Unpair and start again.";
        else steps.innerHTML = "Say <b>“tell " + partner + " privately …”</b> or <b>“send " + partner + " a private message”</b>, or type in Private messages. " + partner + " replies through " + other + " the same way.";
      }
      if (pairBtn) { pairBtn.textContent = st.paired || st.sent ? "Send my key again" : "Pair with " + other; pairBtn.className = st.paired ? "btn" : "btn gold"; }
      if (wordsEl) {
        wordsEl.hidden = !st.paired;
        wordsEl.innerHTML = "";
        (st.words || []).forEach(function (w) { var sp = document.createElement("span"); sp.textContent = w; wordsEl.appendChild(sp); });
      }
      if (verBtn) verBtn.hidden = !(st.paired && !st.verified);
      if (unBtn) unBtn.hidden = !(st.paired || st.haveKey);
    }
    this._syncPrivate = sync;
    if (pairBtn) pairBtn.onclick = function () {
      if (!root.__fridayPrivateSendKey) return;
      pairBtn.disabled = true;
      root.__fridayPrivateSendKey().then(function (r) {
        pairBtn.disabled = false;
        if (!r || !r.ok) self.onToast(r && r.reason === "no-contact" ? "Add " + partner + "'s name in Contacts (just below) first." : "Couldn't open the text.");
        sync();
      }, function () { pairBtn.disabled = false; });
    };
    if (verBtn) verBtn.onclick = function () { PL.verify(true).then(function () { self.onToast("Private line is ready."); sync(); }); };
    if (unBtn) unBtn.onclick = function () {
      if (!confirm("Unpair the private line? You'll need to pair again to send private messages.")) return;
      PL.unpair().then(sync);
    };
    var op = el("btn-private-open");
    if (op) op.onclick = function () { if (root.__friday && root.__friday.openPanel) root.__friday.openPanel("private"); };
    // voice for private messages (iPhone voices only)
    var sel = el("private-voice");
    function fillVoices() {
      if (!sel || !root.__friday || !root.__friday.voice || !root.__friday.voice.catalog) return;
      var cat = root.__friday.voice.catalog(false);
      sel.innerHTML = "";
      var o0 = document.createElement("option"); o0.value = ""; o0.textContent = "Best iPhone voice (automatic)"; sel.appendChild(o0);
      cat.filter(function (c) { return c.rank > 0; }).forEach(function (c) {
        var o = document.createElement("option"); o.value = c.uri; o.textContent = c.name + " · " + c.quality + (c.lang ? " (" + c.lang + ")" : ""); sel.appendChild(o);
      });
      sel.value = v.privateVoiceURI || "";
      if (sel.value !== (v.privateVoiceURI || "")) sel.value = "";
    }
    if (sel) {
      sel.onchange = function () { v.privateVoiceURI = sel.value; saveSettings(v); };
      sel.addEventListener("focus", fillVoices);
      setTimeout(fillVoices, 1500);
    }
    var vt = el("btn-private-voice-test");
    if (vt) vt.onclick = function () {
      var V = root.__friday && root.__friday.voice;
      if (V && V.speakPrivate) V.speakPrivate("This is how private messages from " + partner + " will sound.", prof);
    };
    var od = el("set-ondevice-listen");
    if (od) { od.checked = v.onDeviceListen !== false; od.onchange = function () { v.onDeviceListen = od.checked; saveSettings(v); }; }
    setText("private-receive", "When a private message comes in, " + partner + " taps the link in the text to open " + other + ". Or set up the message automation (below) so " + other + " opens and reads it by herself. Either way works.");
    sync();
  };

  // ---------- 3.1: Settings in pages ----------
  FridaySettings.prototype._bindNav = function () {
    var self = this;
    var menu = document.getElementById("settings-menu"), back = document.getElementById("settings-back"), title = document.getElementById("settings-title");
    function show(pid) {
      if (pid === "messages" && self._syncPrivate) self._syncPrivate();
      document.querySelectorAll("#panel-settings .spage").forEach(function (p) { p.hidden = p.id !== "sp-" + pid; });
      if (menu) menu.hidden = !!pid;
      if (back) back.hidden = !pid;
      var pg = pid ? document.getElementById("sp-" + pid) : null;
      if (title) title.textContent = pg ? pg.getAttribute("data-title") : "Settings";
      var body = document.querySelector("#panel-settings .body");
      if (body) body.scrollTop = 0;
      self.page = pid || "";
      if (pid === "phone" && self._refreshPhone) self._refreshPhone();
      if (pid) {
        var item = document.querySelector('#settings-menu .smenu-item[data-page="' + pid + '"]');
        var grp = item && item.closest(".sgroup");
        if (grp && self.pickGroup) self.pickGroup(grp.getAttribute("data-group"));
      } else if (self._syncQuick) self._syncQuick();
    }
    this.showPage = show;
    function pickGroup(g) {
      g = g || self._group || "her";
      self._group = g;
      document.querySelectorAll("#settings-menu .sgroup").forEach(function (el) { el.hidden = el.getAttribute("data-group") !== g; });
      document.querySelectorAll("#settings-hub .shub-b").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-group") === g); });
    }
    this.pickGroup = pickGroup;
    var hub = document.getElementById("settings-hub");
    if (hub) hub.addEventListener("click", function (e) { var b = e.target.closest(".shub-b"); if (b) pickGroup(b.getAttribute("data-group")); });
    pickGroup("her");
    if (menu) menu.addEventListener("click", function (e) { var b = e.target.closest(".smenu-item"); if (b) show(b.getAttribute("data-page")); });
    if (back) back.onclick = function () { show(""); };
    root.__fridaySettingsShow = function (id) {
      if (self._syncPrivate) self._syncPrivate();
      var el = document.getElementById(id);
      var pg = el && el.closest ? el.closest(".spage") : null;
      if (pg) show(pg.id.replace("sp-", ""));
      if (el && el.tagName === "DETAILS") el.open = true;
      return el;
    };
    show("");
  };

  // ---------- 3.1: talk time, phone jobs, Back Tap, contacts, widget styles ----------
  FridaySettings.prototype._bind31 = function () {
    var self = this, v = this.values, prof = this.profile || {};
    var name = prof.assistantName || "Friday", scheme = prof.scheme || name.toLowerCase();
    function setText(id, t) { var e = document.getElementById(id); if (e) e.textContent = t; }
    function copyText(text, msg) {
      function fallback() {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
        try { document.execCommand("copy"); } catch (e) {}
        ta.remove();
        self.onToast(msg);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { self.onToast(msg); }, fallback);
      else fallback();
    }
    document.querySelectorAll(".sc-assistant").forEach(function (e) { e.textContent = name; });
    setText("bt-url", scheme + "://listen");
    setText("rt-url", scheme + "://msg?kind=text&from=");
    var cw = document.getElementById("btn-copy-wake");
    if (cw) cw.onclick = function () { copyText(scheme + "://listen", "Copied. Paste it into Open URLs."); };

    // bubbles that learn
    var lb = document.getElementById("set-learn-bubbles");
    if (lb) {
      lb.checked = root.FridayStorage.get("bubblesLearn", false) === true;
      lb.onchange = function () { self.onLearnBubbles(lb.checked); };
    }

    // talk time
    var tt = document.getElementById("talk-time");
    function syncTalk() { if (tt) tt.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-talk") === (v.talkTime || "normal")); }); }
    if (tt) tt.addEventListener("click", function (e) { var b = e.target.closest("button[data-talk]"); if (!b) return; v.talkTime = b.getAttribute("data-talk"); saveSettings(v); syncTalk(); });
    syncTalk();

    // phone jobs: what's done in the app vs the Shortcut
    var N = root.FridayNative;
    function refreshPhone() {
      var list = document.getElementById("phone-list");
      if (!list) return;
      var app = !!(N && N.isApp());
      var hi = root.FridayStorage.get("homeInfo", null);
      var homeOk = !!(app && N.home.available() && N.home._status && N.home._status.ok);
      var kitOk = !!(app && N.kit && N.kit.available());
      var aidotOk = !!(app && N.aidot && N.aidot.ready());
      var texts = (self.values || {}).textsInApp !== false;
      var rows = [
        ["Timers ring when closed", app && N.notify.available() ? (N.notify.allowed() ? "In the app" : "Turn on notifications") : "Shortcut", app && N.notify.allowed()],
        ["Reminders", app && N.calendar.available() ? "In the app" : "Shortcut", app && N.calendar.available()],
        ["Calendar", app && N.calendar.available() ? "In the app" : "Shortcut", app && N.calendar.available()],
        ["Battery", app ? "In the app" : "Shortcut", app],
        ["Contacts", app && N.contacts.names().length ? N.contacts.names().length + " synced" : "Not synced", app && N.contacts.names().length],
        ["AiDot lights", aidotOk ? "In the app (" + N.aidot.lights().length + " lights, home Wi-Fi)" : (app && N.aidot && N.aidot.available() ? "Sign in below" : "Shortcut"), aidotOk],
        ["Apple Home lights and scenes", homeOk ? "In the app" + (hi ? " (" + hi.lights + " lights)" : "") : (app && N.home.available() ? "App first, then Shortcut" : "Shortcut"), homeOk],
        ["Opening apps (Music, Spotify…)", app ? "In the app" : "Shortcut", app],
        ["Music on this iPhone", kitOk ? "In the app" : "Shortcut", kitOk],
        ["Calls", kitOk && texts && N.contacts.available() ? "In the app (you confirm)" : "Shortcut", kitOk && texts],
        ["Texts", kitOk && texts ? "In the app (you tap Send)" : "Shortcut", kitOk && texts],
        ["HomePod, Apple TV, volume", "Shortcut", false],
        ["Alarms, Do Not Disturb, Camera app", "Shortcut", false]
      ];
      var nbtn = document.getElementById("btn-notify-on");
      var nOn = !!(app && N.notify.available() && N.notify.allowed());
      if (nbtn) nbtn.hidden = nOn;
      var nsub = document.getElementById("notify-sub");
      if (nsub) nsub.hidden = nOn;
      list.innerHTML = "";
      rows.forEach(function (r) {
        var li = document.createElement("li");
        if (r[2]) li.className = "inapp";
        var a = document.createElement("span"); a.textContent = r[0];
        var b = document.createElement("span"); b.textContent = r[1];
        li.appendChild(a); li.appendChild(b); list.appendChild(li);
      });
    }
    this._refreshPhone = refreshPhone;
    refreshPhone();
    var nb = document.getElementById("btn-notify-on");
    if (nb) nb.onclick = function () { if (root.__fridayTurnOnNotifications) root.__fridayTurnOnNotifications().then(refreshPhone); };
    var hc = document.getElementById("btn-home-check");
    if (hc) hc.onclick = function () {
      if (!N || !N.isApp() || !N.home.available()) { setText("home-status", "Lights go through your Shortcut in this version."); return; }
      setText("home-status", "Checking…");
      N.home._status = null;
      N.home.ready().then(function (ok) {
        var hi = root.FridayStorage.get("homeInfo", null);
        var why;
        if (ok) why = "Lights work right in the app" + (hi ? ": " + hi.lights + " lights, " + (hi.scenes || []).length + " scenes." : ".");
        else if (!hi) why = "She couldn't check your Home just now. Try again in a moment.";
        else if (hi.authorization && hi.authorization !== "authorized") why = "Home access is off for this app. Turn on Home Information in iPhone Settings → " + ((self.profile && self.profile.assistantName) || "Friday") + ".";
        else if (!hi.homes) why = "Home access is on, but iOS isn't showing this install any homes. That usually means the Home permission didn't come through when AltStore signed the app. The LightsTest version is the one that carries it.";
        else if (!hi.lights) why = "She can see your Home (" + (hi.accessories || 0) + " accessories) but none of them are lights" + (hi.otherPlugs ? ". If a lamp is on a smart plug or switch, rename it in the Home app to include \u201clight\u201d or \u201clamp\u201d" : "") + ".";
        else why = "Something stopped her from reaching your lights. Try again in a moment.";
        setText("home-status", why + (ok ? "" : " She still tries the app first every time, then hands off to your Shortcut if it doesn't work."));
        refreshPhone();
      });
    };

    // AiDot lights: sign in once, then she controls them over home Wi-Fi
    var AIDOT_COUNTRIES = [["Afghanistan","jp"],["Albania","eu"],["Anguilla","us"],["Antigua and Barbuda","us"],["Argentina","us"],["Armenia","jp"],["Australia","jp"],["Austria","eu"],["Azerbaijan","jp"],["Bahamas","us"],["Bahrain","jp"],["Bangladesh","jp"],["Barbados","us"],["Belgium","eu"],["Belize","us"],["Bermuda","us"],["Bhutan","jp"],["Bolivia","us"],["Brazil","us"],["Brunei","jp"],["Bulgaria","eu"],["Cambodia","jp"],["Canada","us"],["Cayman Islands","us"],["Chile","us"],["Colombia","us"],["Costa Rica","us"],["Croatia","eu"],["Cuba","us"],["Cyprus","jp"],["Czech Republic","eu"],["Denmark","eu"],["Dominican Republic","us"],["Ecuador","us"],["El Salvador","us"],["Estonia","eu"],["Finland","eu"],["France","eu"],["French Guiana","us"],["Georgia","jp"],["Germany","eu"],["Greece","eu"],["Grenada","us"],["Guatemala","us"],["Guyana","us"],["Haiti","us"],["Honduras","us"],["Hungary","eu"],["Iceland","eu"],["India","jp"],["Indonesia","jp"],["Iran","jp"],["Iraq","jp"],["Ireland","eu"],["Israel","eu"],["Italy","eu"],["Jamaica","us"],["Japan","jp"],["Jordan","jp"],["Kazakhstan","jp"],["Korea","jp"],["Kuwait","jp"],["Kyrgyzstan","jp"],["Laos","jp"],["Latvia","eu"],["Lebanon","jp"],["Liechtenstein","eu"],["Lithuania","eu"],["Luxembourg","eu"],["Malaysia","jp"],["Maldives","jp"],["Malta","eu"],["Mexico","us"],["Moldova","eu"],["Monaco","eu"],["Mongolia","jp"],["Montenegro","eu"],["Montserrat","us"],["Myanmar","jp"],["Nepal","jp"],["Netherlands","eu"],["New Zealand","jp"],["Nicaragua","us"],["North Korea","jp"],["North Macedonia","eu"],["Norway","eu"],["Oman","jp"],["Pakistan","jp"],["Palestine","jp"],["Panama","us"],["Paraguay","us"],["Peru","us"],["Philippines","jp"],["Poland","eu"],["Portugal","eu"],["Qatar","jp"],["Romania","eu"],["Russia","eu"],["San Marino","eu"],["Saudi Arabia","jp"],["Serbia","eu"],["Singapore","jp"],["Slovakia","eu"],["Slovenia","eu"],["Spain","eu"],["Sri Lanka","jp"],["St.Kitts and Nevis","us"],["St.Lucia","us"],["St.Vincent and the Grenadines","us"],["Suriname","us"],["Sweden","eu"],["Switzerland","eu"],["Syria","jp"],["Tajikistan","jp"],["Thailand","jp"],["Togo","jp"],["Trinidad and Tobago","us"],["Turkey","eu"],["Turkmenistan","jp"],["Turks & Caicos","us"],["Ukraine","eu"],["United Arab Emirates","jp"],["United Kingdom","eu"],["United States","us"],["Uruguay","us"],["Uzbekistan","jp"],["Venezuela","us"],["Vietnam","jp"],["Virgin Islands","us"],["Yemen","jp"]];
    function aidotReason(r) {
      r = String(r || "");
      if (/wrong-password|560080/.test(r)) return "AiDot says that email or password isn't right.";
      if (/network|offline|URLError/i.test(r)) return "Couldn't reach AiDot. Check your internet and try again.";
      if (/^missing/.test(r)) return "Type your AiDot email and password.";
      if (/^app$/.test(r)) return "AiDot lights work in the installed app.";
      if (/no-wifi/.test(r)) return "You're not on Wi-Fi. Lights are switched over your home Wi-Fi.";
      if (/away/.test(r)) return "You're on a different Wi-Fi than home, so Apple Home or your Shortcut handles lights here.";
      if (/unreachable|timeout|not-found/.test(r)) return "The light didn't answer on this Wi-Fi. If iPhone asked about Local Network, tap Allow (or turn it on in iPhone Settings → " + ((self.profile && self.profile.assistantName) || "Friday") + " → Local Network), then try again. Make sure you're on your home Wi-Fi.";
      if (/login-/.test(r)) return "The light said no to the sign-in. Tap Update light list, then try again.";
      if (/signed-out/.test(r)) return "Sign in to AiDot first.";
      return "Something went wrong (" + r.slice(0, 80) + ").";
    }
    function syncAidot() {
      var A = N && N.aidot;
      var info = A ? A.info() : null;
      var signed = !!(info && info.signedIn);
      var lights = A ? A.lights() : [];
      var cur = document.getElementById("aidot-current");
      if (cur) cur.textContent = !A || !A.available() ? "In the app" : signed ? lights.length + (lights.length === 1 ? " light" : " lights") : "Off";
      var si = document.getElementById("aidot-signin");
      if (si) si.hidden = signed;
      var act = document.getElementById("aidot-actions");
      if (act) act.hidden = !signed;
      if (signed) setText("aidot-status", "Signed in as " + (info.user || "you") + (info.country ? " (" + info.country + ")" : "") + ". " + (lights.length ? "Say things like “turn the " + (lights[0].room || lights[0].name || "bedroom").toLowerCase() + " light blue” or “lights to 40 percent”." : "No lights in this AiDot account yet. Add them in the AiDot app, then tap Update light list."));
      else if (!A || !A.available()) setText("aidot-status", "AiDot lights work in the installed app.");
      var ul = document.getElementById("aidot-list");
      if (!ul) return;
      ul.innerHTML = "";
      if (!signed) return;
      lights.forEach(function (d) {
        var li = document.createElement("li");
        li.className = "inapp";
        var a = document.createElement("span");
        a.textContent = d.name + (d.room ? " · " + d.room : "") + (d.rgb ? " · color" : d.cct ? " · white shades" : "");
        var b = document.createElement("span");
        b.className = "aidot-btns";
        [["On", { on: true }], ["Off", { on: false }]].forEach(function (x) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btn mini";
          btn.textContent = x[0];
          btn.onclick = function () {
            setText("aidot-status", "Switching " + d.name + "…");
            A.control([d.id], x[1]).then(function (r) {
              setText("aidot-status", r.ok ? d.name + " is " + (x[1].on ? "on." : "off.") : aidotReason(r.reason));
            });
          };
          b.appendChild(btn);
        });
        li.appendChild(a); li.appendChild(b); ul.appendChild(li);
      });
    }
    var ac = document.getElementById("aidot-country");
    if (ac && !ac.options.length) {
      AIDOT_COUNTRIES.forEach(function (c) {
        var o = document.createElement("option");
        o.value = c[0]; o.textContent = c[0]; o.setAttribute("data-region", c[1]);
        ac.appendChild(o);
      });
      ac.value = (N && N.aidot && N.aidot.info() && N.aidot.info().country) || "United States";
    }
    var asb = document.getElementById("btn-aidot-signin");
    if (asb) asb.onclick = function () {
      var A = N && N.aidot;
      if (!A || !A.available()) { setText("aidot-status", aidotReason("app")); return; }
      var u = String((document.getElementById("aidot-user") || {}).value || "").trim();
      var pe = document.getElementById("aidot-pass");
      var pw = String((pe || {}).value || "");
      if (!u || !pw) { setText("aidot-status", aidotReason("missing")); return; }
      var opt = ac && ac.options[ac.selectedIndex];
      var country = opt ? opt.value : "United States", region = opt ? opt.getAttribute("data-region") : "us";
      asb.disabled = true;
      setText("aidot-status", "Signing in to AiDot…");
      A.signIn(country, region, u, pw).then(function (r) {
        asb.disabled = false;
        if (pe) pe.value = "";
        if (!r.ok) { setText("aidot-status", aidotReason(r.reason)); return; }
        var ue = document.getElementById("aidot-user"); if (ue) ue.value = "";
        syncAidot();
        refreshPhone();
        self.onToast("AiDot connected: " + A.lights().length + " lights.");
      });
    };
    function aidotAll(on) {
      var A = N && N.aidot;
      if (!A) return;
      setText("aidot-status", on ? "Turning all on…" : "Turning all off…");
      A.control([], { on: on }).then(function (r) {
        if (!r.ok) { setText("aidot-status", aidotReason(r.reason)); return; }
        var miss = r.failed.map(function (f) { return f.name; }).filter(Boolean);
        setText("aidot-status", r.done.length + " light" + (r.done.length === 1 ? "" : "s") + (on ? " on." : " off.") + (miss.length ? " Didn't answer: " + miss.join(", ") + "." : ""));
      });
    }
    var aon = document.getElementById("btn-aidot-allon"); if (aon) aon.onclick = function () { aidotAll(true); };
    var aoff = document.getElementById("btn-aidot-alloff"); if (aoff) aoff.onclick = function () { aidotAll(false); };
    var arf = document.getElementById("btn-aidot-refresh");
    if (arf) arf.onclick = function () {
      setText("aidot-status", "Updating your lights from AiDot…");
      N.aidot.refresh().then(function (r) { syncAidot(); refreshPhone(); if (!r.ok) setText("aidot-status", aidotReason(r.reason)); });
    };
    var afd = document.getElementById("btn-aidot-find");
    if (afd) afd.onclick = function () {
      setText("aidot-status", "Looking for your lights on this Wi-Fi…");
      N.aidot.find().then(function (r) {
        syncAidot();
        if (!r.ok) setText("aidot-status", aidotReason(r.reason));
        else if (r.reason) setText("aidot-status", aidotReason(r.reason));
        else setText("aidot-status", "Found " + r.found + " of " + r.total + " lights on this Wi-Fi." + (r.found < r.total ? " Lights that are switched off at the wall can't answer." : ""));
      });
    };
    var aso = document.getElementById("btn-aidot-signout");
    if (aso) aso.onclick = function () {
      if (!confirm("Sign out of AiDot on this phone? Lights go back to Apple Home and your Shortcut.")) return;
      N.aidot.signOut().then(function () { syncAidot(); refreshPhone(); setText("aidot-status", "Signed out. Your AiDot password was removed from this phone."); });
    };
    root.addEventListener("friday:aidot", function () { syncAidot(); refreshPhone(); });
    syncAidot();
    if (N && N.aidot && N.aidot.available()) N.aidot.status().then(function () { syncAidot(); refreshPhone(); });

    // contacts
    function syncContactsUi() {
      var names = N ? N.contacts.names() : [];
      var dl = document.getElementById("contact-names");
      if (dl) { dl.innerHTML = ""; names.slice(0, 600).forEach(function (n) { var o = document.createElement("option"); o.value = n; dl.appendChild(o); }); }
      var pc = document.getElementById("set-partner-contact");
      if (pc && names.length) pc.setAttribute("list", "contact-names");
      if (names.length) setText("contacts-status", names.length + " contacts synced. “Text Mom” or “call Daddy” now goes to the exact contact. Names only, kept on this phone.");
    }
    var cs = document.getElementById("btn-contacts-sync");
    if (cs) cs.onclick = function () {
      if (!N) { self.onToast("Contacts sync works in the installed app."); return; }
      setText("contacts-status", "Syncing…");
      N.contacts.sync().then(function (r) { if (r.ok) syncContactsUi(); else setText("contacts-status", r.reason); refreshPhone(); });
    };
    syncContactsUi();
    root.addEventListener("friday:contacts", syncContactsUi);

    // widget styles
    var box = document.getElementById("widget-styles");
    var dir = root.FRIDAY_BAKED_PROFILE === "batsie" ? "friday-batsie/scriptable/" : "scriptable/";
    var src = null;
    function load() {
      if (src !== null) return Promise.resolve(src);
      return fetch(dir + "Friday-Widget.js").then(function (r) { return r.ok ? r.text() : ""; }).then(function (t) { src = t || ""; return src; }, function () { return ""; });
    }
    var STYLES = [
      ["obsidian", "Obsidian", "HD orb, greeting, weather and Talk."],
      ["clock", "Clock", "Big live time, date and weather."],
      ["upnext", "Up next", "Your next events and reminders."],
      ["minimal", "Minimal", "Greeting and weather. No orb."],
      ["classic", "Classic", "The original drawn orb."],
      ["fractured:x1", "Fractured · Gold", "Just the orb. No words. Tap to talk."],
      ["fractured:x6", "Fractured · Ice", "Just the orb, silver and blue."],
      ["fractured:x12", "Fractured · Ember", "Just the orb, warm copper."],
      ["fractured:x10", "Fractured · Twin shells", "Just the orb, two shells."],
      ["fractured:x8", "Fractured · Ring", "Just the orb, with a ring and core."],
      ["standby:x1", "StandBy clock", "For StandBy: big live time over the orb while it charges on its side."]
    ];
    function preview(full) {
      var parts = String(full).split(":"), id = parts[0], look = parts[1];
      if (look) {
        var clock = id === "standby" ? '<div class="wp-time">9:41</div><div class="wp-date">Sat, Nov 21</div>' : "";
        return '<div class="wp-orb' + (clock ? " wp-dim" : "") + '" aria-hidden="true"><img src="icons/widget/orb-' + look + '.png" alt="" loading="lazy">' + clock + '</div>';
      }
      return previewSvg(id);
    }
    function previewSvg(id) {
      var orb = '<radialGradient id="wo' + id + '"><stop offset="0" stop-color="#fff3cf"/><stop offset=".35" stop-color="#e8c872"/><stop offset=".7" stop-color="rgba(196,132,42,.4)"/><stop offset="1" stop-color="rgba(196,132,42,0)"/></radialGradient>';
      var bg = '<rect width="160" height="76" rx="14" fill="#0b0a08"/><rect width="160" height="76" rx="14" fill="url(#wb' + id + ')"/>';
      var defs = '<defs>' + orb + '<linearGradient id="wb' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1c1810"/><stop offset="1" stop-color="#050505"/></linearGradient></defs>';
      var t = function (x, y, w, h, a) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + h / 2 + '" fill="rgba(239,236,232,' + a + ')"/>'; };
      var body = "";
      if (id === "obsidian" || id === "classic") body = t(12, 12, 38, 4, .5) + t(12, 24, 70, 8, .9) + t(12, 38, 56, 4, .5) + '<rect x="12" y="52" width="40" height="13" rx="6.5" fill="none" stroke="#e8c872"/>' + '<circle cx="122" cy="38" r="' + (id === "classic" ? 24 : 30) + '" fill="url(#wo' + id + ')"/><circle cx="122" cy="38" r="9" fill="#0b0b0c" stroke="rgba(255,255,255,.55)" stroke-width=".8"/>';
      else if (id === "clock") body = '<text x="12" y="42" fill="#efece8" font-size="30" font-weight="200" font-family="-apple-system,sans-serif">9:41</text>' + t(12, 50, 60, 4, .55) + t(12, 60, 46, 4, .4) + '<circle cx="124" cy="38" r="26" fill="url(#wo' + id + ')"/><circle cx="124" cy="38" r="8" fill="#0b0b0c" stroke="rgba(255,255,255,.55)" stroke-width=".8"/>';
      else if (id === "upnext") body = '<text x="12" y="18" fill="#f3dc9a" font-size="8" font-weight="600" font-family="-apple-system,sans-serif">UP NEXT</text>' + '<text x="12" y="31" fill="#d9b468" font-size="7" font-family="-apple-system,sans-serif">3:00 PM</text>' + t(12, 35, 76, 6, .9) + '<text x="12" y="53" fill="#d9b468" font-size="7" font-family="-apple-system,sans-serif">Tomorrow 9:00 AM</text>' + t(12, 57, 60, 6, .9) + '<circle cx="136" cy="20" r="14" fill="url(#wo' + id + ')"/><circle cx="136" cy="20" r="4.5" fill="#0b0b0c" stroke="rgba(255,255,255,.5)" stroke-width=".6"/>';
      else body = t(12, 12, 38, 4, .5) + t(12, 30, 96, 9, .9) + t(12, 46, 70, 4, .5) + '<rect x="12" y="56" width="40" height="12" rx="6" fill="none" stroke="#e8c872"/>';
      return '<svg viewBox="0 0 160 76" aria-hidden="true">' + defs + bg + body + '</svg>';
    }
    if (box) {
      box.innerHTML = "";
      STYLES.forEach(function (st) {
        var c = document.createElement("div");
        c.className = "wstyle";
        c.innerHTML = preview(st[0]) + "<b>" + st[1] + "</b><small>" + st[2] + "</small>";
        var b = document.createElement("button");
        b.type = "button"; b.className = "btn gold"; b.textContent = "Copy script";
        b.onclick = function () {
          load().then(function (t) {
            if (!t) { self.onToast("Still loading. Tap again in a second."); return; }
            var pp = st[0].split(":");
            var out = t.replace(/const PRESET = "[a-z]+"/, 'const PRESET = "' + pp[0] + '"');
            if (pp[1]) out = out.replace(/const ORB_PICK = "[a-z0-9]+"/, 'const ORB_PICK = "' + pp[1] + '"');
            copyText(out, st[1] + " widget copied. Paste it into a new Scriptable script." + (pp[0] === "standby" ? " For StandBy: charge the phone on its side, press and hold the widgets, tap +, pick Scriptable, then this script." : ""));
          });
        };
        c.appendChild(b);
        box.appendChild(c);
      });
      load();
    }
  };

  // ---------- 3.0: recap, hands-free, routines, messages, charging display, battery ----------
  FridaySettings.prototype._bind30 = function () {
    var self = this, v = this.values, prof = this.profile || {};
    function setText(id, t) { var e = document.getElementById(id); if (e) e.textContent = t; }
    function bindTog(id, key) {
      var el = document.getElementById(id);
      if (!el) return;
      el.checked = v[key] !== false;
      el.onchange = function () { v[key] = el.checked; saveSettings(v); self.onChange30(key); };
    }
    bindTog("set-recap", "nightlyRecap");
    bindTog("set-handsfree", "handsFree");
    bindTog("set-rest-orb", "restingOrb");
    bindTog("set-night-orb", "nightOrb");
    bindTog("set-partner-msgs", "partnerMessages");
    bindTog("set-live-listen", "liveListen");
    bindTog("set-texts-inapp", "textsInApp");
    var vt = document.getElementById("btn-voice-test");
    if (vt) vt.onclick = function () {
      var V = self.voice;
      if (!V) return;
      setText("voice-test-status", "Playing…");
      try { V.unlockAudio(); } catch (e0) {}
      root.FridayStorage.set("voiceDiag", null);
      var started = Date.now();
      V.speak("Testing, one, two, three. Can you hear me?", self.profile).then(function () {
        var d = root.FridayStorage.get("voiceDiag", null) || {};
        var why = root.FridayVoice && root.FridayVoice.aiVoiceReason ? root.FridayVoice.aiVoiceReason() : "";
        var msg;
        if (d.path === "ai") msg = d.issue === "revived" ? "Played with the AI voice, after fixing sound that iOS had cut off." : "Played with the AI voice.";
        else if (d.path === "iphone" && d.issue === "stuck") msg = "The AI voice's sound was cut off by iOS, so she used the iPhone voice. If you heard nothing, close and reopen the app.";
        else if (d.path === "iphone" && d.issue === "chosen") msg = "Played with the iPhone voice (that's the voice you picked).";
        else if (d.path === "iphone") msg = "Played with the iPhone voice, because the AI voice isn't available" + (why ? ": " + why : ".");
        else if (d.path === "none") msg = "No sound: iOS has her audio paused (" + (d.state || "unknown") + "). Close and reopen the app.";
        else msg = Date.now() - started < 400 ? "Nothing played. Turn the volume up and check silent mode, then try again." : "Done.";
        var rt = String(root.FridayStorage.get("voiceRoute", "") || "");
        var where = /Receiver/i.test(rt) ? " Sound went to the earpiece (top speaker)." : /Speaker/i.test(rt) ? " Sound went to the main speaker." : /Bluetooth|Headphones|AirPlay|Car/i.test(rt) ? " Sound went to your headphones or speaker." : "";
        setText("voice-test-status", msg + where + " If you heard nothing, check the volume.");
      });
    };
    var bgSeg = document.getElementById("bg-minutes");
    if (bgSeg) {
      var curBg = function () { var m = parseInt(v.bgMinutes, 10); return isNaN(m) ? 3 : m; };
      var markBg = function () { [].forEach.call(bgSeg.querySelectorAll("button"), function (b) { b.classList.toggle("on", parseInt(b.dataset.bg, 10) === curBg()); b.setAttribute("aria-pressed", parseInt(b.dataset.bg, 10) === curBg() ? "true" : "false"); }); };
      [].forEach.call(bgSeg.querySelectorAll("button"), function (b) {
        b.onclick = function () { v.bgMinutes = parseInt(b.dataset.bg, 10); saveSettings(v); markBg(); };
      });
      markBg();
      var bw = root.FridayStorage.get("bgWindow", null);
      if (bw && bw.start) {
        var secs = Math.round((bw.awake || 0) / 1000);
        setText("bg-status", "Last time in the background she stayed awake for " + (secs >= 60 ? Math.floor(secs / 60) + " min " + (secs % 60) + " s" : secs + " s") + " (set to " + bw.mins + " min).");
      }
    }
    var lls = document.getElementById("live-listen-status");
    if (lls) {
      var lerr = root.FridayStorage.get("liveListenError", null);
      var why = lerr ? String(lerr.msg || "") : "";
      var nice = /speech-denied|speech-restricted/.test(why) ? "Speech Recognition is turned off for this app in iPhone Settings."
        : /mic-denied/.test(why) ? "The microphone is turned off for this app in iPhone Settings."
        : why ? "It didn't start last time (" + why.slice(0, 60) + ")." : "";
      lls.textContent = !(root.FridayVoice && root.FridayVoice.liveAvailable && root.FridayVoice.liveAvailable())
        ? "Works in the installed app."
        : nice ? nice + " She's using Whisper for now; it tries again next time you open the app." : "Ready.";
    }
    var rh = document.getElementById("set-recap-hour");
    if (rh) {
      rh.innerHTML = "";
      for (var h = 17; h <= 23; h++) {
        var o = document.createElement("option");
        o.value = String(h);
        o.textContent = (h - 12) + ":00 PM";
        rh.appendChild(o);
      }
      rh.value = String(v.recapHour == null ? 21 : v.recapHour);
      rh.onchange = function () { v.recapHour = parseInt(rh.value, 10); saveSettings(v); };
    }
    var isB = prof.id === "batsie";
    var other = isB ? "Friday" : "Reed";
    var scheme = prof.scheme || String(prof.assistantName || "Friday").toLowerCase();
    var defNames = isB ? "Sky, Daddy" : "Batsie";
    var pn = document.getElementById("set-partner-names"), pc = document.getElementById("set-partner-contact");
    function firstName() { return String(v.partnerNames || defNames).split(",")[0].trim(); }
    function syncPartner() {
      var nm = firstName();
      setText("partner-current", nm);
      setText("partner-sub", "Say \u201Ctell " + nm + " dinner's ready\u201D. It goes to them as a normal text, and " + other + " reads it out loud on their phone.");
      setText("ps-sender", v.partnerContact || nm);
      setText("ps-prefix", "From " + other + ":");
      setText("ps-url", scheme + "://msg?text=");
      setText("bs-url", scheme + "://charging");
      if (pc) pc.placeholder = nm;
    }
    if (pn) { pn.placeholder = defNames; pn.value = v.partnerNames || ""; pn.onchange = function () { v.partnerNames = pn.value.trim(); saveSettings(v); syncPartner(); }; }
    if (pc) { pc.value = v.partnerContact || ""; pc.onchange = function () { v.partnerContact = pc.value.trim(); saveSettings(v); syncPartner(); }; }
    var cu = document.getElementById("btn-copy-msg-url");
    if (cu) cu.onclick = function () {
      var text = scheme + "://msg?text=";
      function fallback() {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
        try { document.execCommand("copy"); } catch (e) {}
        ta.remove();
        self.onToast("Copied. Paste it in Open URLs.");
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { self.onToast("Copied. Paste it in Open URLs."); }, fallback);
      else fallback();
    };
    syncPartner();
    var X = root.FridayExtras;
    function syncRoutines() {
      if (!X) return;
      setText("routines-current", X.routines().length + " saved");
      var box = document.getElementById("routines-box");
      // redraw when routines change elsewhere (not while you're typing in one)
      if (box && !box.contains(document.activeElement) && box.querySelectorAll(".routine-card").length !== X.routines().length) X.renderRoutines(box);
    }
    if (X) X.renderRoutines(document.getElementById("routines-box"));
    syncRoutines();
    root.addEventListener("friday:routines", syncRoutines);
  };

  FridaySettings.prototype._bindBrainMood = function () {
    var self = this, v = this.values;
    function tog(id, key, after) {
      var el = document.getElementById(id);
      if (!el) return;
      el.checked = v[key] !== false && v[key] !== undefined ? !!v[key] : false;
      if (key === "fastReplies" || key === "briefingNews" || key === "iphoneTimers") el.checked = v[key] !== false;
      el.onchange = function () { v[key] = el.checked; saveSettings(v); if (after) after(); };
    }
    tog("set-fast", "fastReplies");
    tog("set-barge", "bargeIn");
    tog("set-news", "briefingNews");
    tog("set-iphone-timers", "iphoneTimers");
    tog("set-night", "nightMode", function () { self.onNight(); syncMood(); });

    var wm = document.getElementById("web-mode");
    function syncWeb() { if (wm) wm.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-web") === (v.webMode || "smart")); }); }
    if (wm) wm.addEventListener("click", function (e) { var b = e.target.closest("button[data-web]"); if (!b) return; v.webMode = b.getAttribute("data-web"); saveSettings(v); syncWeb(); });
    syncWeb();

    var mx = document.getElementById("render-max"), hd = document.getElementById("render-hd"), og = document.getElementById("render-og");
    function syncRender() {
      var r = v.render === "original" ? "original" : (v.render === "hd" ? "hd" : "max");
      if (mx) mx.classList.toggle("on", r === "max");
      if (hd) hd.classList.toggle("on", r === "hd");
      if (og) og.classList.toggle("on", r === "original");
    }
    if (mx) mx.onclick = function () { v.render = "max"; saveSettings(v); syncRender(); self.onRender("max"); };
    if (hd) hd.onclick = function () { v.render = "hd"; saveSettings(v); syncRender(); self.onRender("hd"); };
    if (og) og.onclick = function () { v.render = "original"; saveSettings(v); syncRender(); self.onRender("original"); };
    syncRender();

    var row = document.getElementById("mood-row"), cur = document.getElementById("mood-current");
    var moods = root.FridayMoods || { normal: { name: "Normal" } };
    function syncMood() {
      var m = v.mood || "normal";
      if (row) row.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-mood") === m); });
      if (cur) cur.textContent = (moods[m] ? moods[m].name : "Normal") + (v.nightMode ? " · night mode" : "");
    }
    if (row) {
      row.innerHTML = "";
      Object.keys(moods).forEach(function (k) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "life-tab"; b.setAttribute("data-mood", k); b.textContent = moods[k].name;
        b.onclick = function () { v.mood = k; saveSettings(v); syncMood(); try { root.dispatchEvent(new CustomEvent("friday:mood", { detail: { from: "settings" } })); } catch (e) {} };
        row.appendChild(b);
      });
    }
    root.addEventListener("friday:mood", function () { var fresh = root.FridayStorage.get("settings", {}) || {}; v.mood = fresh.mood || "normal"; syncMood(); });
    syncMood();

    function hours(sel, val) {
      if (!sel) return;
      sel.innerHTML = "";
      for (var h = 0; h < 24; h++) {
        var o = document.createElement("option");
        o.value = h;
        o.textContent = (h % 12 || 12) + ":00 " + (h < 12 ? "AM" : "PM");
        if (+val === h) o.selected = true;
        sel.appendChild(o);
      }
    }
    var nf = document.getElementById("set-night-from"), nt = document.getElementById("set-night-to");
    hours(nf, v.nightFrom == null ? 22 : v.nightFrom);
    hours(nt, v.nightTo == null ? 7 : v.nightTo);
    if (nf) nf.onchange = function () { v.nightFrom = +nf.value; saveSettings(v); self.onNight(); };
    if (nt) nt.onchange = function () { v.nightTo = +nt.value; saveSettings(v); self.onNight(); };

    var bs = document.getElementById("brain-status"), bc = document.getElementById("brain-current");
    function syncBrain() {
      var backups = loadConnections().filter(function (c) { return c.type === "agent" && c.backup; }).map(function (c) { return c.name; });
      var u = root.FridayStorage.get("usage.brain", null);
      var today = u && u.date === new Date().toDateString() ? u : { total: 0, tts: 0, models: {} };
      var per = Object.keys(today.models || {}).map(function (k) { return k.replace(/^.*\//, "") + " " + today.models[k]; }).join(", ");
      var meter = "Today: " + (today.total || 0) + " replies" + (per ? " (" + per + ")" : "") + " · AI voice " + (today.tts || 0) + " of about 100 clips. Each Groq brain has its own free daily limit, about 1,000 replies.";
      if (bs) bs.textContent = (backups.length ? "Backup brains: " + backups.join(", ") + ". " : "No backup brain yet. Add a free one (Gemini, OpenRouter, Cerebras, Mistral) in Connections and turn on Backup brain. ") + meter;
      if (bc) bc.textContent = backups.length ? "Groq + " + backups.length + " backup" + (backups.length > 1 ? "s" : "") : "Groq";
    }
    this._syncBrain = syncBrain;
    syncBrain();
    var accB = document.getElementById("accord-brain");
    if (accB) accB.addEventListener("toggle", function () { if (accB.open) syncBrain(); });
  };

  FridaySettings.prototype._bindWidgets = function () {
    var self = this;
    var nm = this.profile.assistantName || "Friday";
    document.querySelectorAll(".assist-name").forEach(function (el) { el.textContent = nm; });
    var texts = {};
    function load(file) {
      return fetch(file).then(function (r) { return r.ok ? r.text() : ""; }).catch(function () { return ""; });
    }
    var acc = document.getElementById("accord-widgets");
    var dir = window.FRIDAY_BAKED_PROFILE === "batsie" ? "friday-batsie/scriptable/" : "scriptable/";
    function prefetch() {
      if (texts.w != null) return;
      texts.w = ""; texts.l = "";
      load(dir + "Friday-Widget.js").then(function (t) { texts.w = t; });
      load(dir + "Friday-LockScreen.js").then(function (t) { texts.l = t; });
    }
    if (acc) acc.addEventListener("toggle", function () { if (acc.open) prefetch(); });
    function copy(text, what) {
      if (!text) { self.onToast("Still loading. Tap again in a second."); prefetch(); return; }
      function fallback() {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
        var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
        ta.remove();
        self.onToast(ok ? what + " copied. Paste it in Scriptable." : "Couldn't copy. Try again.");
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { self.onToast(what + " copied. Paste it in Scriptable."); }, fallback);
      else fallback();
    }
    var bw = document.getElementById("btn-copy-widget"), bl = document.getElementById("btn-copy-lock");
    if (bw) bw.onclick = function () { copy(texts.w, "Widget script"); };
    if (bl) bl.onclick = function () { copy(texts.l, "Lock Screen script"); };
  };

  FridaySettings.prototype._syncConnectionsHeader = function () {
    var all = loadConnections();
    var links = all.filter(function (c) { return c.type !== "agent"; }).length;
    var brains = all.filter(function (c) { return c.type === "agent"; }).length;
    var el = document.getElementById("connections-current");
    if (el) el.textContent = links ? links + (links === 1 ? " link" : " links") : "None";
    var le = document.getElementById("links-empty");
    if (le) le.hidden = links > 0;
    var be = document.getElementById("brains-empty");
    if (be) be.hidden = brains > 0;
  };

  FridaySettings.prototype._bindConnections = function () {
    var self = this;
    var listEl = document.getElementById("connections-list");
    var iconsEl = document.getElementById("conn-icons");
    if (!listEl) return;
    var selectedKind = "link";
    var icons = root.FridayBubbleIcons || {};

    function current() { return loadConnections(); }

    function renderIcons() {
      if (!iconsEl) return;
      iconsEl.innerHTML = "";
      Object.keys(icons).forEach(function (kind) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = kind === selectedKind ? "on" : "";
        btn.setAttribute("data-kind", kind);
        btn.setAttribute("aria-label", kind);
        btn.innerHTML = icons[kind];
        btn.addEventListener("click", function () {
          selectedKind = kind;
          renderIcons();
        });
        iconsEl.appendChild(btn);
      });
    }

    function renderList() {
      var list = current();
      listEl.innerHTML = "";
      var linksEl = document.getElementById("links-list");
      if (linksEl) linksEl.innerHTML = "";
      list.forEach(function (c, i) {
        var row = document.createElement("div");
        row.className = "connection-row";
        var name = document.createElement("div");
        name.className = "conn-name";
        name.textContent = c.name || "Connection";
        var open = document.createElement("button");
        open.type = "button";
        open.className = "btn";
        open.textContent = c.type === "agent" ? "New key" : "Open";
        open.addEventListener("click", function () {
          if (c.type === "agent") {
            var k = prompt("Paste a new API key for " + (c.name || "this agent") + ". It stays on this phone.");
            if (k && k.trim()) { root.FridayStorage.setAgentKey(c.id, k); self.onToast("Key saved on this phone."); }
            return;
          }
          if (!c.url) return;
          try { location.href = c.url; } catch (e) {}
        });
        var add = document.createElement("button");
        add.type = "button";
        add.className = "btn gold";
        add.textContent = "Bubble";
        if (c.type === "agent") {
          add.textContent = "Test";
          add.className = "btn";
          add.onclick = function () {
            add.disabled = true; add.textContent = "Testing…";
            root.FridayBrain.test(c).then(function () {
              self.onToast(c.name + " is working.");
            }, function (e) { self.onToast(e.message || (c.name + " didn't answer.")); }).then(function () { add.disabled = false; add.textContent = "Test"; });
          };
        }
        if (c.type !== "agent") add.addEventListener("click", function () {
          self.onAddBubble({
            kind: c.kind || "link",
            label: c.name || "Connection",
            gold: true,
            size: "lg",
            action: "url",
            url: c.url,
            connectionId: c.id
          });
        });
        var del = document.createElement("button");
        del.type = "button";
        del.className = "btn danger";
        del.textContent = "Remove";
        del.addEventListener("click", function () {
          if (c.type === "agent") root.FridayStorage.setAgentKey(c.id, "");
          var next = current().filter(function (x, idx) { return idx !== i; });
          saveConnections(next);
          renderList();
        });
        var url = document.createElement("div");
        url.className = "conn-url";
        url.textContent = c.type === "agent"
          ? "AI · " + (c.model || "") + " · say “ask " + (c.name || "") + " …”" + (c.backup ? " · backup brain" : "")
          : (c.url || "");
        row.appendChild(name);
        row.appendChild(open);
        row.appendChild(add);
        row.appendChild(del);
        row.appendChild(url);
        if (c.type === "agent") {
          var bk = document.createElement("label");
          bk.className = "toggle-row conn-backup";
          bk.textContent = "Backup brain";
          var cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = !!c.backup;
          cb.onchange = function () {
            var all = current();
            all.forEach(function (x) { if (x.id === c.id) x.backup = cb.checked; });
            saveConnections(all);
            renderList();
            if (self._syncBrain) self._syncBrain();
          };
          bk.appendChild(cb);
          row.appendChild(bk);
        }
        if (c.type === "agent" || !linksEl) listEl.appendChild(row);
        else linksEl.appendChild(row);
      });
      self._syncConnectionsHeader();
    }
    self._renderConnections = renderList;

    var addBtn = document.getElementById("btn-conn-add");
    if (addBtn) {
      addBtn.onclick = function () {
        var name = (document.getElementById("conn-name") || {}).value;
        var url = (document.getElementById("conn-url") || {}).value;
        name = String(name || "").trim();
        url = String(url || "").trim();
        if (!name) { self.onToast("Give the connection a name."); return; }
        var type = typeEl ? typeEl.value : "link";
        if (type !== "link") {
          var base = String(document.getElementById("conn-base").value || "").trim();
          var model = String(document.getElementById("conn-model").value || "").trim();
          var akey = String(document.getElementById("conn-key").value || "").trim();
          if (!base) { self.onToast("Add the agent's base URL."); return; }
          if (!/^https?:\/\//i.test(base)) base = "https://" + base;
          if (!model) { self.onToast("Add a model name."); return; }
          if (!akey && type !== "groq") { self.onToast("Paste the AI's API key."); return; }
          var agentId = "a" + Math.random().toString(36).slice(2, 9);
          var alist = current();
          var pr0 = AGENT_PRESETS[type] || {};
          var backupBox = document.getElementById("conn-backup");
          alist.push({ id: agentId, name: name, type: "agent", provider: type, style: pr0.style || "openai", baseUrl: base, model: model, kind: selectedKind || "chat", backup: !!(backupBox && backupBox.checked) });
          saveConnections(alist);
          if (akey) root.FridayStorage.setAgentKey(agentId, akey);
          ["conn-name", "conn-key"].forEach(function (id) { document.getElementById(id).value = ""; });
          renderList();
          if (self._syncBrain) self._syncBrain();
          self.onToast(name + " added. Say “ask " + name + " …”.");
          return;
        }
        if (!url) { self.onToast("Add a link or app scheme."); return; }
        if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && /^[\w.-]+\.[a-z]{2,}([\/:?#]|$)/i.test(url)) url = "https://" + url;
        var list = current();
        list.push({
          id: "c" + Math.random().toString(36).slice(2, 9),
          name: name,
          url: url,
          kind: selectedKind || "link"
        });
        saveConnections(list);
        document.getElementById("conn-name").value = "";
        document.getElementById("conn-url").value = "";
        renderList();
        self.onToast("Connection saved on this phone.");
      };
    }
    var typeEl = document.getElementById("conn-type");
    if (typeEl && typeEl.options.length < 3) {
      var gFree = document.createElement("optgroup"); gFree.label = "AI · free";
      var gPaid = document.createElement("optgroup"); gPaid.label = "AI · paid or other";
      Object.keys(AGENT_PRESETS).forEach(function (k) {
        var pr = AGENT_PRESETS[k];
        if (pr.twoBox) return; // Cloudflare has its own two-box form under Paste a key
        var o = document.createElement("option");
        o.value = k; o.textContent = pr.label || pr.name || k;
        (pr.free ? gFree : gPaid).appendChild(o);
      });
      typeEl.appendChild(gFree); typeEl.appendChild(gPaid);
    }
    var findBtn = document.getElementById("btn-conn-models");
    if (findBtn) findBtn.onclick = function () {
      var t = typeEl ? typeEl.value : "custom";
      var pr = AGENT_PRESETS[t] || {};
      var base = String(document.getElementById("conn-base").value || "").trim();
      var key = String(document.getElementById("conn-key").value || "").trim();
      if (!key && t === "groq") key = root.FridayStorage.getApiKey();
      if (!base) { self.onToast("Add the base URL first."); return; }
      if (!key) { self.onToast("Paste the API key first, then Find models."); return; }
      findBtn.disabled = true; findBtn.textContent = "Looking…";
      root.FridayBrain.listModels(pr.style || "openai", base, key).then(function (ids) {
        var dl = document.getElementById("conn-models");
        dl.innerHTML = "";
        ids.forEach(function (id) { var o = document.createElement("option"); o.value = id; dl.appendChild(o); });
        self.onToast(ids.length ? ids.length + " models found. Tap the model box to pick one." : "No models came back. Check the key.");
        var mi = document.getElementById("conn-model");
        if (ids.length && ids.indexOf(mi.value) < 0) {
          var free = ids.filter(function (x) { return /:free$/.test(x); });
          mi.value = (free[0] || ids[0]);
        }
      }, function () {
        self.onToast("Couldn't list models. Check the key and address.");
      }).then(function () { findBtn.disabled = false; findBtn.textContent = "Find models"; });
    };
    if (typeEl) {
      typeEl.onchange = function () {
        var t = typeEl.value;
        var isAgent = t !== "link";
        document.getElementById("conn-agent-fields").classList.toggle("hidden", !isAgent);
        document.getElementById("conn-url").classList.toggle("hidden", isAgent);
        if (isAgent) {
          var pr = AGENT_PRESETS[t] || AGENT_PRESETS.custom;
          document.getElementById("conn-base").value = pr.base;
          document.getElementById("conn-model").value = pr.model;
          var nm = document.getElementById("conn-name");
          var names = Object.keys(AGENT_PRESETS).map(function (k) { return AGENT_PRESETS[k].name; });
          if (!nm.value.trim() || names.indexOf(nm.value.trim()) >= 0) nm.value = pr.name;
          var kh = document.getElementById("conn-keyhint");
          if (kh) {
            kh.innerHTML = "";
            if (t === "groq") kh.textContent = "Leave the key blank to use your main Groq key. ";
            if (pr.keyUrl) {
              var a = document.createElement("a");
              a.href = pr.keyUrl; a.target = "_blank"; a.rel = "noopener"; a.textContent = "Get a key";
              kh.appendChild(document.createTextNode((pr.free ? "Free key, no card needed in most cases. " : "")));
              kh.appendChild(a);
            }
          }
          var bb = document.getElementById("conn-backup");
          if (bb) bb.checked = !!pr.free;
        }
      };
    }
    // "Paste a key": one box, she does the rest
    var pkBtn = document.getElementById("btn-paste-key");
    var pkIn = document.getElementById("paste-key");
    function pkSay(t) { var e = document.getElementById("paste-key-status"); if (e) e.textContent = t; }
    var PAID = { anthropic: 1, openai: 1, xai: 1, deepseek: 1 };
    if (pkBtn && pkIn) pkBtn.onclick = function () {
      var B = root.FridayBrain;
      var key = String(pkIn.value || "").trim();
      if (!B || !B.addKey) return;
      if (key.length < 16) { pkSay("That doesn't look like a whole key. Copy the full key and paste it again."); return; }
      var first = B.guessProviders(key)[0];
      if (PAID[first] && !confirm("This looks like a paid " + ((B.PRESETS[first] || {}).name || "AI") + " key, so using it can cost money. Add it anyway?")) return;
      pkBtn.disabled = true;
      pkSay("Working out whose key this is…");
      B.addKey(key, pkSay).then(function (r) {
        pkBtn.disabled = false;
        if (r.ok) {
          pkIn.value = "";
          renderList();
          if (self._syncBrain) self._syncBrain();
          if (self._syncKey) self._syncKey();
          var msg = r.main ? "That's a Groq key. It's now her main key."
            : r.already ? (r.name + " is already added. It's on as a backup brain.")
            : r.name + " is added and on as a backup brain (model " + r.model + ")." + (r.limited ? " It's at its limit right now, so it starts helping once that resets." : "") + (r.paid ? " This one is paid." : "") + " You can also say “ask " + r.name + " …”.";
          pkSay(msg);
          self.onToast(r.main ? "Groq key saved." : (r.name + " added as a backup brain."));
        } else {
          pkSay(r.reason === "auth" ? "No AI service accepted that key. Check you copied all of it, or make a new key."
            : r.reason === "offline" ? "Couldn't reach the internet. Try again when you're online."
            : r.reason === "short" ? "That doesn't look like a whole key."
            : "That key didn't work with any free service she knows (" + r.reason + "). You can still add it by hand under Connections.");
        }
      });
    };
    document.querySelectorAll("[data-keyurl]").forEach(function (b) {
      b.onclick = function () { try { window.open(b.getAttribute("data-keyurl"), "_blank"); } catch (e) { location.href = b.getAttribute("data-keyurl"); } };
    });
    renderIcons();
    renderList();
    if (typeEl && typeEl.onchange) typeEl.onchange();
  };

  FridaySettings.prototype._bindShortcutSetup = function () {
    var self = this;
    var ta = document.getElementById("shortcut-prompt");
    if (!ta) return;
    var promptText = shortcutPromptFor(this.profile);
    ta.value = promptText;
    var nm = this.shortcutName();
    document.querySelectorAll(".sc-setup-name").forEach(function (el) { el.textContent = nm; });
    var openBtn = document.getElementById("btn-shortcut-open");
    if (openBtn) openBtn.onclick = function () { try { location.href = "shortcuts://create-shortcut"; } catch (e) {} };
    var btn = document.getElementById("btn-shortcut-copy");
    if (btn) btn.onclick = function () {
      function fallback() {
        ta.removeAttribute("readonly");
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        var ok = false;
        try { ok = document.execCommand("copy"); } catch (e) {}
        ta.setAttribute("readonly", "");
        self.onToast(ok ? "Copied. Paste it in the Shortcuts app." : "Press and hold the text to copy it.");
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(promptText).then(function () {
          self.onToast("Copied. Paste it in the Shortcuts app.");
        }, fallback);
      } else fallback();
    };
  };

  FridaySettings.prototype.copyShortcutPrompt = function () {
    var b = document.getElementById("btn-shortcut-copy");
    if (b) b.click();
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
    if (isNativeApp()) return;
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
    var label = this.profile.assistantName || (tag === "batsie" ? "Reed" : "Friday");
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
