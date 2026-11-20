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
      shortcutName: "Friday",
      defaultLook: "N",
      voiceHint: "en-GB male",
      voiceGender: "male",
      voiceLang: "en-GB",
      greetingName: "Sky"
    },
    batsie: {
      id: "batsie",
      assistantName: "Jarvis",
      ownerName: "Batsie",
      terms: ["ma'am"],
      addressPerTen: 4,
      shortcutName: "Jarvis",
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
    N:  { id:"N",  group:"orbs", name:"Core & shells", blurb:"Glossy black core, four fractured shells, mixed dust when someone talks." },
    M:  { id:"M",  group:"orbs", name:"Shells & streams", blurb:"The core and shells, plus the voice streams." },
    F:  { id:"F",  group:"orbs", name:"Streams", blurb:"A fractured gold shell with a constant gold and silver flow." },
    H:  { id:"H",  group:"orbs", name:"Halo shell", blurb:"A fractured gold and silver particle shell around a glowing ring core." },
    F1: { id:"F1", group:"orbs", name:"F1 Flow through the core", blurb:"A constant gold and silver flow passing through a ring core." },
    F2: { id:"F2", group:"orbs", name:"F2 Flow + shell dust", blurb:"The flow, plus a fractured shell that sheds dust." },
    H1: { id:"H1", group:"orbs", name:"H1 Holographic sphere", blurb:"A fractured holographic particle sphere around a ring core." },
    H2: { id:"H2", group:"orbs", name:"H2 Sphere + black orb", blurb:"The holographic shell around a glossy black core, with inner cords." },
    H3: { id:"H3", group:"orbs", name:"H3 Sphere + wrap", blurb:"The holographic sphere with wrapping gold and silver strands." },
    H4: { id:"H4", group:"orbs", name:"H4 Gold & silver ring", blurb:"A gold and silver particle shell around a larger silver-leaning ring." },
    V1: { id:"V1", group:"orbs", name:"V1 Voice from the core", blurb:"Voice strands rise from the holographic core when someone talks." },
    V2: { id:"V2", group:"orbs", name:"V2 Shell follows the voice", blurb:"The outer shell moves with the voice and sheds dust." },
    I1: { id:"I1", group:"orbs", name:"I1 Inside strands", blurb:"A glossy black orb with gold and silver strands glowing inside." },
    I3: { id:"I3", group:"orbs", name:"I3 Wrapping strands", blurb:"A glossy black orb with strands wrapping the surface." },
    R:  { id:"R",  group:"orbs", name:"R Holographic", blurb:"A translucent holographic wireframe sphere, dense meridians and dust." },
    X1: { id:"X1", group:"nested", name:"X1 Nested fracture", blurb:"Gold spheres inside one another, all fractured, with crack lines, light filaments and a lens core." },
    X2: { id:"X2", group:"nested", name:"X2 Nested + black orb", blurb:"The nested fractured spheres around a glossy black glass core." },
    X3: { id:"X3", group:"nested", name:"X3 Nested silver", blurb:"Nested fractured spheres in silver and gold, with more light filaments." },
    X4: { id:"X4", group:"nested", name:"X4 Six-layer fracture", blurb:"Six fractured spheres stacked inside each other that drift as she talks." },
    X5: { id:"X5", group:"nested", name:"X5 Shattered core", blurb:"Four fractured gold spheres with spokes running into a black glass core." },
    X6: { id:"X6", group:"nested", name:"X6 Ice fracture", blurb:"Nested fractures in cool silver, with a hint of gold." },
    X7: { id:"X7", group:"nested", name:"X7 Seven-layer lattice", blurb:"Seven tight fractured layers with a dense web of filaments." },
    X8: { id:"X8", group:"nested", name:"X8 Gold eclipse", blurb:"Fractured spheres around a black core with a bright gold ring." },
    X9: { id:"X9", group:"nested", name:"X9 Fracture streams", blurb:"Three fractured spheres with gold and silver streams flowing through." },
    X10: { id:"X10", group:"nested", name:"X10 Twin shells", blurb:"Paired fractured shells, two close together inside two more." },
    X11: { id:"X11", group:"nested", name:"X11 Halo fracture", blurb:"Fractured spheres inside a soft particle halo." },
    X12: { id:"X12", group:"nested", name:"X12 Ember fracture", blurb:"Warm ember-gold fractures with dense crack lines that drift as she talks." },

    "1":  { id:"1",  group:"concepts", name:"1 Soft violet", blurb:"A minimal, soft violet glow." },
    "2":  { id:"2",  group:"concepts", name:"2 Teal rings", blurb:"Dark glass with teal sound-wave rings." },
    "3":  { id:"3",  group:"concepts", name:"3 Amber geometry", blurb:"A warm amber and rose geometric motif." },
    "4":  { id:"4",  group:"concepts", name:"4 Liquid chrome", blurb:"A crisp white and silver liquid-chrome blob." },
    "5":  { id:"5",  group:"concepts", name:"5 Aurora ribbon", blurb:"A soft aurora ribbon on deep navy." },
    "6":  { id:"6",  group:"concepts", name:"6 Coral waveform", blurb:"A coral voice wave on monochrome black." },
    "7":  { id:"7",  group:"concepts", name:"7 Emerald gem", blurb:"A faceted emerald and gold gem." },
    "8":  { id:"8",  group:"concepts", name:"8 Pastel bubbles", blurb:"Soft peach, mint, and lavender motes." },
    "9":  { id:"9",  group:"concepts", name:"9 Electric cloud", blurb:"An electric-blue particle cloud on a dark grid." },
    "10": { id:"10", group:"concepts", name:"10 Liquid Gold", blurb:"A molten gold AI core with metallic highlights." },
    "11": { id:"11", group:"concepts", name:"11 Dark Silver", blurb:"A liquid chrome core on deep graphite." },
    "12": { id:"12", group:"concepts", name:"12 Neural core", blurb:"A glowing cyan and violet neural-network core." },
    "13": { id:"13", group:"concepts", name:"13 Dual metal", blurb:"Gold and silver intertwined in one core." },
    "14": { id:"14", group:"concepts", name:"14 Liquid Gold wave", blurb:"A liquid-gold metal voice waveform." },
    "15": { id:"15", group:"concepts", name:"15 Dark Silver wave", blurb:"A chrome liquid-metal voice waveform." },
    "16": { id:"16", group:"concepts", name:"16 Obsidian wave", blurb:"A white-metal waveform on obsidian." },
    "17": { id:"17", group:"concepts", name:"17 Gold & Silver wave", blurb:"Gold and silver metal waves together." },
    "18": { id:"18", group:"concepts", name:"18 Gold Pulse", blurb:"A gold voice pulse of rings and radial ticks." },
    "19": { id:"19", group:"concepts", name:"19 Silver Glass", blurb:"A chrome voice ribbon with a glass ghost." },
    "20": { id:"20", group:"concepts", name:"20 Black Gold Luxe", blurb:"Spare gold line-art on deep black." },
    "21": { id:"21", group:"concepts", name:"21 Titanium", blurb:"A titanium metal voice ribbon." },
    "22": { id:"22", group:"concepts", name:"22 Carbon AI", blurb:"A smoky carbon voice wave." },
    "23": { id:"23", group:"concepts", name:"23 Midnight Gold & Silver", blurb:"Stereo gold and silver channels with signal pulses." },
    "24": { id:"24", group:"concepts", name:"24 Neural Threads", blurb:"Flowing gold and chrome threads with traveling pulses." },
    "25": { id:"25", group:"concepts", name:"25 Generative Dual", blurb:"A dusty gold and silver generative wave." },
    "26": { id:"26", group:"concepts", name:"26 Gold Dust", blurb:"A gold-heavy dusty voice wave." },
    "27": { id:"27", group:"concepts", name:"27 Silver Dust", blurb:"A silver-heavy dusty voice wave." },
    "28": { id:"28", group:"concepts", name:"28 Obsidian", blurb:"An equal gold and silver dust wave on black." },
    "28A":{ id:"28A",group:"concepts", name:"28A Twin rings", blurb:"The obsidian wave with two orbit rings and a larger core." },
    "28B":{ id:"28B",group:"concepts", name:"28B Trail core", blurb:"A larger core with a particle trail." },
    "28C":{ id:"28C",group:"concepts", name:"28C Alive ring", blurb:"A thinking shimmer on the ring, more alive while talking." },
    "28D":{ id:"28D",group:"concepts", name:"28D Hairline", blurb:"An ultra-minimal hairline ring and a quiet wave." },
    "29": { id:"29", group:"concepts", name:"29 Pearl", blurb:"A lighter pearl gold and silver dust wave." },

    C1: { id:"C1", group:"cords", name:"C1 Harp bundle", blurb:"Bundled vocal-cord strands, like a harp through the core." },
    C2: { id:"C2", group:"cords", name:"C2 Vocal folds", blurb:"A pair of vocal folds around a center gap." },
    C3: { id:"C3", group:"cords", name:"C3 Fanning strands", blurb:"Strands that fan from a narrow left point to a wide right." },
    C4: { id:"C4", group:"cords", name:"C4 Full-width weave", blurb:"A loose twelve-strand weave across the screen." },

    D1: { id:"D1", group:"dust", name:"D1 Dense & crisp", blurb:"Fine gold and silver dust, tightly interwoven." },
    D2: { id:"D2", group:"dust", name:"D2 Smoke drift", blurb:"Looser lines, particles drifting off like smoke." },
    D3: { id:"D3", group:"dust", name:"D3 Sparkle peaks", blurb:"The same core, with sparkles where the wave is loudest." },
    D4: { id:"D4", group:"dust", name:"D4 Full-width crossing", blurb:"No circle — a gold line and a silver line cross." }
  };

  var LOOK_GROUPS = [
    { id:"neural", name:"Neural", ids:["12","24"] },
    { id:"nested", name:"Nested fracture", ids:["X1","X2","X3","X4","X5","X6","X7","X8","X9","X10","X11","X12"] },
    { id:"orbs", name:"Orbs", ids:["N","M","F","H","F1","F2","H1","H2","H3","H4","V1","V2","I1","I3","R"] },
    { id:"concepts", name:"Concepts", ids:["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","28A","28B","28C","28D","29"] },
    { id:"cords", name:"Voice cords", ids:["C1","C2","C3","C4"] },
    { id:"dust", name:"Voice dust", ids:["D1","D2","D3","D4"] }
  ];


  var LAYOUTS = [
    { id:"orbit", name:"Orbit", blurb:"Bubbles float around the orb, like Concept 28." },
    { id:"ring", name:"Ring", blurb:"Bubbles sit evenly in a circle around the orb, Apple Watch style." },
    { id:"dock", name:"Dock", blurb:"A large orb in the center, and a frosted, scrollable row of bubbles at the bottom." },
    { id:"grid", name:"Grid", blurb:"A smaller orb at the top, with bubbles in a grid below." },
    { id:"arc", name:"Arc", blurb:"Bubbles in a semicircle under the orb." },
    { id:"orbonly", name:"Orb only", blurb:"Just the orb. Swipe up from the bottom to reveal your bubbles." },
    { id:"immersive", name:"Full orb (immersive)", blurb:"The orb fills the screen. Buttons fade back until you touch them. Swipe up for bubbles." },
    { id:"orbtop", name:"Orb up top", blurb:"The orb sits high, with her words big in the middle. Swipe up for bubbles." },
    { id:"orbdock", name:"Orb dock", blurb:"A small orb at the bottom, out of the way. Swipe up for bubbles." },
    { id:"orbclock", name:"Orb + clock", blurb:"A big clock and date over the orb. Swipe up for bubbles." },
    { id:"double", name:"Double ring", blurb:"Bubbles on two rings, from Concept 28A." },
    { id:"spiral", name:"Spiral", blurb:"Bubbles on a spiral under the orb, from Concept 28B." },
    { id:"home", name:"Home + dock", blurb:"A Home Screen grid with a dock of four, from the early concepts." },
    { id:"list", name:"List", blurb:"The orb above a list of bubbles, from the later concept screens." },
    { id:"sheet", name:"Sheet", blurb:"Bubbles in a bottom sheet, like Concept 28A." }
  ];

  var ICON_CHOICES = [
    { id:"I1", name:"I1 Inside" },
    { id:"I2", name:"I2" },
    { id:"I3", name:"I3 Wrap" },
    { id:"I4", name:"I4" },
    { id:"H1", name:"H1 Sphere" },
    { id:"H2", name:"H2 Black core" },
    { id:"H3", name:"H3 Wrap" },
    { id:"H4", name:"H4 Gold & silver" }
  ];

  var DEFAULT_CHIPS = [
    { id:"alarm", label:"Set alarm", type:"shortcut", command:"set an alarm" },
    { id:"lights", label:"Lights off", type:"shortcut", command:"lights off" },
    { id:"night", label:"Good night", type:"shortcut", command:"good night" },
    { id:"weather", label:"What's the weather", type:"weather", command:"" }
  ];

  var HOME_COORDS = { lat: 36.6, lon: -83.66, label: "Cumberland Gap" };

  var DEFAULT_BUBBLES = {
    sky: [
      { id: "lights", kind: "lights", label: "Lights", gold: true, size: "lg", action: "shortcut", command: "lights on" },
      { id: "timer", kind: "timer", label: "", gold: false, size: "sm", action: "panel", panel: "timer" },
      { id: "tv", kind: "tv", label: "TV", gold: false, size: "lg", action: "shortcut", command: "tv on" },
      { id: "alarm", kind: "alarm", label: "", gold: true, size: "sm", action: "shortcut", command: "set an alarm" },
      { id: "cameras", kind: "cameras", label: "Cameras", gold: true, size: "lg", action: "shortcut", command: "cameras" },
      { id: "camera", kind: "camera", label: "Camera", gold: false, size: "sm", action: "url", url: "camera://" },
      { id: "phone", kind: "phone", label: "Phone", gold: true, size: "sm", action: "url", url: "tel:" },
      { id: "chat", kind: "chat", label: "", gold: false, size: "sm", action: "panel", panel: "chat" },
      { id: "texts", kind: "messages", label: "Messages", gold: true, size: "lg", action: "url", url: "sms:" },
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
      { id: "camera", kind: "camera", label: "Camera", gold: false, size: "sm", action: "url", url: "camera://" },
      { id: "phone", kind: "phone", label: "Phone", gold: true, size: "sm", action: "url", url: "tel:" },
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
    LOOK_GROUPS: LOOK_GROUPS,
    LAYOUTS: LAYOUTS,
    ICON_CHOICES: ICON_CHOICES,
    DEFAULT_CHIPS: DEFAULT_CHIPS,
    HOME_COORDS: HOME_COORDS,
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
