/* Friday profile config. No secrets. The Groq key is never stored here. */
(function (root) {
  "use strict";

  var PROFILES = {
    sky: {
      id: "sky",
      assistantName: "Friday",
      ownerName: "Sky",
      terms: ["boss", "sir"],
      addressPerTen: 4,
      shortcutName: "Friday 2",
      defaultLook: "N",
      voiceHint: "en-GB male",
      voiceGender: "male",
      voiceLang: "en-GB",
      greetingName: "Sky"
    },
    batsie: {
      id: "batsie",
      assistantName: "Friday",
      ownerName: "Batsie",
      terms: ["ma'am"],
      addressPerTen: 4,
      shortcutName: "Friday 2",
      defaultLook: "N",
      voiceHint: "en-GB female",
      voiceGender: "female",
      voiceLang: "en-GB",
      greetingName: "Batsie",
      daddyLabel: "DADDY!!",
      daddySms: "sms:"
    }
  };

  var LOOKS = {
    N: {
      id: "N",
      name: "Core & shells",
      blurb: "Glossy black core, four fractured shells, gold and silver dust when someone talks."
    },
    F: {
      id: "F",
      name: "Streams",
      blurb: "A fractured gold shell with a constant gold and silver flow that rises and falls when someone talks."
    },
    M: {
      id: "M",
      name: "Shells & streams",
      blurb: "The core and shells, plus the voice streams."
    },
    H: {
      id: "H",
      name: "Halo shell",
      blurb: "A fractured gold and silver particle shell around a glowing ring core."
    }
  };

  var DEFAULT_BUBBLES = {
    sky: [
      { id: "lights", kind: "lights", label: "Lights", gold: true, size: "lg", action: "shortcut", command: "lights on" },
      { id: "timer", kind: "timer", label: "", gold: false, size: "sm", action: "panel", panel: "timer" },
      { id: "tv", kind: "tv", label: "TV", gold: false, size: "lg", action: "shortcut", command: "tv on" },
      { id: "alarm", kind: "alarm", label: "", gold: true, size: "sm", action: "shortcut", command: "set an alarm" },
      { id: "cameras", kind: "cameras", label: "Cameras", gold: true, size: "lg", action: "shortcut", command: "cameras" },
      { id: "chat", kind: "chat", label: "", gold: false, size: "sm", action: "panel", panel: "chat" },
      { id: "music", kind: "music", label: "Music", gold: false, size: "lg", action: "url", url: "music://" },
      { id: "money", kind: "money", label: "", gold: true, size: "sm", action: "panel", panel: "money" },
      { id: "memory", kind: "memory", label: "Memory", gold: true, size: "lg", action: "panel", panel: "memory" },
      { id: "notes", kind: "notes", label: "", gold: false, size: "sm", action: "panel", panel: "notes" },
      { id: "automations", kind: "automations", label: "Automations", gold: false, size: "lg", action: "url", url: "shortcuts://" },
      { id: "weather", kind: "weather", label: "", gold: true, size: "sm", action: "shortcut", command: "weather" }
    ],
    batsie: [
      { id: "lights", kind: "lights", label: "Lights", gold: true, size: "lg", action: "shortcut", command: "lights on" },
      { id: "timer", kind: "timer", label: "", gold: false, size: "sm", action: "panel", panel: "timer" },
      { id: "tv", kind: "tv", label: "TV", gold: false, size: "lg", action: "shortcut", command: "tv on" },
      { id: "alarm", kind: "alarm", label: "", gold: true, size: "sm", action: "shortcut", command: "set an alarm" },
      { id: "daddy", kind: "messages", label: "Daddy", gold: true, size: "lg", action: "url", url: "sms:" },
      { id: "chat", kind: "chat", label: "", gold: false, size: "sm", action: "panel", panel: "chat" },
      { id: "music", kind: "music", label: "Music", gold: false, size: "lg", action: "url", url: "music://" },
      { id: "money", kind: "money", label: "", gold: true, size: "sm", action: "panel", panel: "money" },
      { id: "memory", kind: "memory", label: "Memory", gold: true, size: "lg", action: "panel", panel: "memory" },
      { id: "notes", kind: "notes", label: "", gold: false, size: "sm", action: "panel", panel: "notes" },
      { id: "automations", kind: "automations", label: "Automations", gold: false, size: "lg", action: "url", url: "shortcuts://" },
      { id: "weather", kind: "weather", label: "", gold: true, size: "sm", action: "shortcut", command: "weather" }
    ]
  };

  var SITE_URL = "https://wicked9787.github.io/friday/";
  var GITHUB_USER = "Wicked9787";
  var REPO = "friday";

  var MODEL = "openai/gpt-oss-20b";
  var CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
  var TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
  var WHISPER_MODEL = "whisper-large-v3-turbo";

  function queryParam(name) {
    try {
      return new URLSearchParams(location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  function resolveProfileId() {
    var q = (queryParam("u") || "").toLowerCase();
    if (q && PROFILES[q]) return q;
    if (root.FRIDAY_BAKED_PROFILE && PROFILES[root.FRIDAY_BAKED_PROFILE]) {
      return root.FRIDAY_BAKED_PROFILE;
    }
    try {
      var saved = localStorage.getItem("friday.profile");
      if (saved && PROFILES[saved]) return saved;
    } catch (e) {}
    return "sky";
  }

  function getProfile() {
    var id = resolveProfileId();
    try { localStorage.setItem("friday.profile", id); } catch (e) {}
    return PROFILES[id];
  }

  root.FRIDAY_CONFIG = {
    PROFILES: PROFILES,
    LOOKS: LOOKS,
    DEFAULT_BUBBLES: DEFAULT_BUBBLES,
    SITE_URL: SITE_URL,
    GITHUB_USER: GITHUB_USER,
    REPO: REPO,
    MODEL: MODEL,
    CHAT_URL: CHAT_URL,
    TRANSCRIBE_URL: TRANSCRIBE_URL,
    WHISPER_MODEL: WHISPER_MODEL,
    queryParam: queryParam,
    resolveProfileId: resolveProfileId,
    getProfile: getProfile
  };
})(window);
