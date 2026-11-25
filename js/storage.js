/* localStorage helpers, backup, and restore. Never logs the API key. */
(function (root) {
  "use strict";

  var PREFIX = "friday.";
  var KEY_API = PREFIX + "apiKey";

  function rawGet(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function rawSet(k, v) {
    try { localStorage.setItem(k, v); return true; } catch (e) { return false; }
  }
  function rawDel(k) {
    try { localStorage.removeItem(k); } catch (e) {}
  }

  function get(key, fallback) {
    var s = rawGet(PREFIX + key);
    if (s == null) return fallback;
    try { return JSON.parse(s); } catch (e) { return fallback; }
  }

  function set(key, value) {
    return rawSet(PREFIX + key, JSON.stringify(value));
  }

  /* 4.1: in the installed app, AI keys (your Groq key and every connection's key) live in the iPhone
     Keychain, for this device only, readable after the phone's first unlock. They're loaded into memory
     at startup so the rest of the app can read them instantly. An old copy in regular storage is only
     removed after the Keychain copy has been written and read back. The website keeps using storage. */
  var keyCache = null;           // { "apiKey": "...", "agentKey.<id>": "..." } while the Keychain is in use
  function kit() {
    var C = root.Capacitor;
    try { return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.FridayKit && C.Plugins.FridayKit.secretSet ? C.Plugins.FridayKit : null; } catch (e) { return null; }
  }
  async function kcGet(K, name) {
    try { var r = await K.secretGet({ key: "ai." + name }); return r && r.value != null ? String(r.value) : null; } catch (e) { return null; }
  }
  async function loadKeys() {
    var K = kit();
    if (!K) return;
    var names = ["apiKey"], cache = {};
    try { (get("connections", []) || []).forEach(function (c) { if (c && c.id) names.push("agentKey." + c.id); }); } catch (e) {}
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(PREFIX + "agentKey.") === 0 && names.indexOf(k.slice(PREFIX.length)) < 0) names.push(k.slice(PREFIX.length));
      }
    } catch (e) {}
    for (var j = 0; j < names.length; j++) {
      var name = names[j], local = rawGet(PREFIX + name), kc = await kcGet(K, name);
      if (local) {
        if (kc !== local) {
          try { await K.secretSet({ key: "ai." + name, value: local }); } catch (e) {}
          kc = await kcGet(K, name);
        }
        if (kc === local) rawDel(PREFIX + name);    // moved: the Keychain copy is confirmed
        else { cache[name] = local; continue; }     // Keychain unavailable: keep the old copy working
      }
      if (kc) cache[name] = kc;
    }
    keyCache = cache;
  }
  var keysReady = loadKeys().catch(function () {});
  function keyGet(name) { return keyCache ? (keyCache[name] || "") : (rawGet(PREFIX + name) || ""); }
  function keySet(name, value) {
    value = String(value || "").trim();
    var K = keyCache ? kit() : null;
    if (!K) { if (value) rawSet(PREFIX + name, value); else rawDel(PREFIX + name); return; }
    if (value) {
      keyCache[name] = value;
      K.secretSet({ key: "ai." + name, value: value }).then(function () { rawDel(PREFIX + name); }, function () { rawSet(PREFIX + name, value); });
    } else {
      delete keyCache[name];
      rawDel(PREFIX + name);
      try { K.secretDelete({ key: "ai." + name }).catch(function () {}); } catch (e) {}
    }
  }
  function keyStore() { return keyCache ? "keychain" : "storage"; }

  function getApiKey() { return keyGet("apiKey"); }

  function setApiKey(key) { keySet("apiKey", key); }

  function hasApiKey() {
    return getApiKey().length > 0;
  }

  // Keys for added agents (ChatGPT etc.) live only on this phone, never in backups.
  function getAgentKey(id) { return keyGet("agentKey." + id); }
  function setAgentKey(id, key) { keySet("agentKey." + id, key); }

  function maskKey(key) {
    key = String(key || "");
    if (key.length < 8) return key ? "••••" : "";
    return key.slice(0, 3) + "••••" + key.slice(-4);
  }

  function exportBackup(includeKey) {
    var data = {
      version: 3,
      exportedAt: new Date().toISOString(),
      profile: get("profile", "sky"),
      settings: get("settings", {}),
      bubbles: get("bubbles", null),
      memory: get("memory", []),
      notes: get("notes", []),
      history: get("history", []),
      timers: get("timers", []),
      connections: get("connections", []),
      lists: get("lists", null),
      bills: get("bills", []),
      countdowns: get("countdowns", []),
      spending: get("spending", []),
      habits: get("habits", null),
      routines: get("routines", null),
      summary: get("summary", null),
      usage: get("usage", {}),
      dismissedSuggestions: get("dismissedSuggestions", [])
    };
    if (includeKey) data.apiKey = getApiKey();
    return data;
  }

  // 3.5.4: in the installed app, downloads don't go anywhere, so the backup opens the iPhone
  // share sheet instead (Save to Files, AirDrop, Messages). The website still downloads it.
  // Returns a promise: { how: "share" | "share-web" | "download" | "copied", completed }.
  async function downloadBackup(includeKey) {
    set("lastBackupAt", Date.now());
    var data = exportBackup(includeKey);
    var text = JSON.stringify(data, null, 2);
    var stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    var name = "friday-backup-" + stamp + ".json";
    var C = root.Capacitor;
    var native = false;
    try { native = !!(C && C.isNativePlatform && C.isNativePlatform()); } catch (e0) {}
    var K = native && C.Plugins && C.Plugins.FridayKit;
    if (K && K.shareFile) {
      try { var r = await K.shareFile({ name: name, text: text }); return { how: "share", completed: !!(r && r.completed) }; }
      catch (e1) {}
    }
    if (native) {
      try {
        var file = new File([text], name, { type: "application/json" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: name });
          return { how: "share-web", completed: true };
        }
      } catch (e2) { if (e2 && e2.name === "AbortError") return { how: "share-web", completed: false }; }
      try { await navigator.clipboard.writeText(text); return { how: "copied", completed: true }; } catch (e3) {}
    }
    var blob = new Blob([text], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
    return { how: "download", completed: true };
  }

  function applyBackup(data) {
    if (!data || typeof data !== "object") throw new Error("That file does not look like a Friday backup.");
    if (data.settings) set("settings", data.settings);
    if (data.bubbles) set("bubbles", data.bubbles);
    if (data.memory) set("memory", data.memory);
    if (data.notes) set("notes", data.notes);
    if (data.history) set("history", data.history);
    if (data.timers) set("timers", data.timers);
    if (data.connections) set("connections", data.connections);
    if (data.lists) set("lists", data.lists);
    if (data.bills) set("bills", data.bills);
    if (data.countdowns) set("countdowns", data.countdowns);
    if (data.spending) set("spending", data.spending);
    if (data.habits) set("habits", data.habits);
    if (data.routines) set("routines", data.routines);
    if (data.summary) set("summary", data.summary);
    if (data.usage) set("usage", data.usage);
    if (data.dismissedSuggestions) set("dismissedSuggestions", data.dismissedSuggestions);
    if (data.profile) rawSet(PREFIX + "profile", data.profile);
    if (typeof data.apiKey === "string" && data.apiKey) setApiKey(data.apiKey);
  }

  function resetAll(keepKey) {
    var key = keepKey ? getApiKey() : "";
    var profile = rawGet(PREFIX + "profile");
    var keys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) keys.push(k);
      }
    } catch (e) {}
    keys.forEach(rawDel);
    if (keyCache) Object.keys(keyCache).forEach(function (n) { keySet(n, ""); });   // Keychain keys go too
    if (profile) rawSet(PREFIX + "profile", profile);
    if (key) setApiKey(key);
  }

  root.FridayStorage = {
    keysReady: keysReady,
    keyStore: keyStore,
    get: get,
    set: set,
    getApiKey: getApiKey,
    setApiKey: setApiKey,
    hasApiKey: hasApiKey,
    getAgentKey: getAgentKey,
    setAgentKey: setAgentKey,
    maskKey: maskKey,
    exportBackup: exportBackup,
    downloadBackup: downloadBackup,
    applyBackup: applyBackup,
    resetAll: resetAll
  };
})(window);
