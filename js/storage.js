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

  function getApiKey() {
    return rawGet(KEY_API) || "";
  }

  function setApiKey(key) {
    key = String(key || "").trim();
    if (!key) {
      rawDel(KEY_API);
      return;
    }
    rawSet(KEY_API, key);
  }

  function hasApiKey() {
    return getApiKey().length > 0;
  }

  function maskKey(key) {
    key = String(key || "");
    if (key.length < 8) return key ? "••••" : "";
    return key.slice(0, 3) + "••••" + key.slice(-4);
  }

  function exportBackup(includeKey) {
    var data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: get("profile", "sky"),
      settings: get("settings", {}),
      bubbles: get("bubbles", null),
      memory: get("memory", []),
      notes: get("notes", []),
      history: get("history", []),
      timers: get("timers", []),
      routines: get("routines", []),
      habits: get("habits", []),
      habitPrefs: get("habitPrefs", {})
    };
    if (includeKey) data.apiKey = getApiKey();
    return data;
  }

  function downloadBackup(includeKey) {
    var data = exportBackup(includeKey);
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    var stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = URL.createObjectURL(blob);
    a.download = "friday-backup-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  function applyBackup(data) {
    if (!data || typeof data !== "object") throw new Error("That file does not look like a Friday backup.");
    if (data.settings) set("settings", data.settings);
    if (data.bubbles) set("bubbles", data.bubbles);
    if (data.memory) set("memory", data.memory);
    if (data.notes) set("notes", data.notes);
    if (data.history) set("history", data.history);
    if (data.timers) set("timers", data.timers);
    if (data.routines) set("routines", data.routines);
    if (data.habits) set("habits", data.habits);
    if (data.habitPrefs) set("habitPrefs", data.habitPrefs);
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
    if (profile) rawSet(PREFIX + "profile", profile);
    if (key) setApiKey(key);
  }

  root.FridayStorage = {
    get: get,
    set: set,
    getApiKey: getApiKey,
    setApiKey: setApiKey,
    hasApiKey: hasApiKey,
    maskKey: maskKey,
    exportBackup: exportBackup,
    downloadBackup: downloadBackup,
    applyBackup: applyBackup,
    resetAll: resetAll
  };
})(window);
