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
    var ok = rawSet(PREFIX + key, JSON.stringify(value));
    if (key === "connections") mirrorBrains(value);
    if (key !== "vaultSavedAt" && key !== "vaultRestored") scheduleVault();
    return ok;
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
  /* 4.2: the extra brains (Gemini, OpenRouter, Cloudflare…) also keep a copy of their settings in the
     Keychain (no keys in it; each key already lives there on its own). If an update ever leaves her
     brain list without them, she puts back every brain whose key is still in the Keychain, the same way
     the Groq key always survives. Removing a brain in Settings removes it from the copy too. */
  var brainsChecked = false, restoredBrains = 0;
  function brainCopy(list) {
    return (Array.isArray(list) ? list : []).filter(function (c) { return c && c.type === "agent" && c.id; }).map(function (c) {
      var o = {};
      ["id", "name", "type", "provider", "style", "baseUrl", "model", "kind", "backup"].forEach(function (k) { if (c[k] != null) o[k] = c[k]; });
      return o;
    });
  }
  function mirrorBrains(list) {
    if (!brainsChecked) return;            // never overwrite the copy before it has been read at startup
    var K = kit();
    if (!K) return;
    try { K.secretSet({ key: "ai.brains", value: JSON.stringify(brainCopy(list)) }).catch(function () {}); } catch (e) {}
  }
  async function restoreBrains(K) {
    var raw = await kcGet(K, "brains"), saved = null;
    try { saved = raw ? JSON.parse(raw) : null; } catch (e) { saved = null; }
    if (!Array.isArray(saved) || !saved.length) return 0;
    var list = get("connections", []);
    if (!Array.isArray(list)) list = [];
    var have = {}, back = 0;
    list.forEach(function (c) { if (c && c.id) have[c.id] = true; });
    for (var i = 0; i < saved.length; i++) {
      var b = saved[i];
      if (!b || !b.id || b.type !== "agent" || have[b.id]) continue;
      if (!(await kcGet(K, "agentKey." + b.id))) continue;   // no key left: nothing to bring back
      list.push(b); have[b.id] = true; back++;
    }
    if (back) rawSet(PREFIX + "connections", JSON.stringify(list));
    return back;
  }

  /* 4.2: safety copy of everything she keeps (memories, personality, chats, lists, notes, bills,
     habits, settings, layout) in the iPhone Keychain, which an update can't wipe. Saved a few seconds
     after changes and whenever you leave the app. If she starts up after an update with her storage
     wiped (the marker below is gone with it) and a safety copy exists, she puts everything back and
     tells you. Keys are never in it (they're in the Keychain on their own). Reset clears the copy too. */
  var VAULT_MARK = PREFIX + "vaultMark";
  var vaultTimer = null, vaultLastAt = 0, vaultHold = false;
  function noop() {}
  function vaultSkip(name) {
    return name === "apiKey" || name.indexOf("agentKey.") === 0 || name.indexOf("secret.") === 0 ||
      name === "vaultMark" || name === "vaultRestored" || name === "vaultSavedAt";
  }
  function vaultSnapshot() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf(PREFIX) !== 0) continue;
        var n = k.slice(PREFIX.length);
        if (vaultSkip(n)) continue;
        out[n] = localStorage.getItem(k);
      }
    } catch (e) {}
    return out;
  }
  function toB64(buf) {
    var u = new Uint8Array(buf), s = "", step = 0x8000;
    for (var i = 0; i < u.length; i += step) s += String.fromCharCode.apply(null, u.subarray(i, i + step));
    return btoa(s);
  }
  function fromB64(b) {
    var s = atob(b), u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }
  async function pack(text) {
    if (typeof CompressionStream === "function" && typeof Response === "function") {
      try {
        var st = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
        return "z:" + toB64(await new Response(st).arrayBuffer());
      } catch (e) {}
    }
    return "t:" + text;
  }
  async function unpack(s) {
    if (s.indexOf("t:") === 0) return s.slice(2);
    if (s.indexOf("z:") === 0) {
      var st = new Blob([fromB64(s.slice(2))]).stream().pipeThrough(new DecompressionStream("gzip"));
      return await new Response(st).text();
    }
    return null;
  }
  var VAULT_PART = 150000;
  // saves run one after another: a save asked for while one is running waits for it, then saves again
  var vaultChain = Promise.resolve(false);
  function vaultSave() {
    var p = vaultChain.then(vaultSaveNow, vaultSaveNow);
    vaultChain = p.catch(function () { return false; });
    return p;
  }
  async function vaultSaveNow() {
    var K = kit();
    if (!K || !brainsChecked || vaultHold) return false;
    try {
      var snap = vaultSnapshot(), names = Object.keys(snap);
      if (names.length < 3) return false;          // nearly empty: never replace a good copy with nothing
      var body = await pack(JSON.stringify({ v: 1, at: Date.now(), items: snap }));
      var meta = null;
      try { meta = JSON.parse((await kcGet(K, "vault.meta")) || "null"); } catch (e) { meta = null; }
      var gen = meta && meta.gen === "a" ? "b" : "a", parts = Math.max(1, Math.ceil(body.length / VAULT_PART));
      for (var i = 0; i < parts; i++) await K.secretSet({ key: "ai.vault." + gen + "." + i, value: body.slice(i * VAULT_PART, (i + 1) * VAULT_PART) });
      await K.secretSet({ key: "ai.vault.meta", value: JSON.stringify({ v: 1, gen: gen, parts: parts, at: Date.now(), n: names.length }) });
      // the other copy is only cleared after the new one is complete
      if (meta && meta.gen && meta.parts) for (var j = 0; j < meta.parts; j++) K.secretDelete({ key: "ai.vault." + meta.gen + "." + j }).catch(noop);
      rawSet(VAULT_MARK, String(Date.now()));
      vaultLastAt = Date.now();
      rawSet(PREFIX + "vaultSavedAt", JSON.stringify({ at: vaultLastAt, n: names.length, size: body.length }));
      return true;
    } catch (e) { return false; }
  }
  function scheduleVault(ms) {
    if (!brainsChecked || vaultHold || !kit()) return;
    clearTimeout(vaultTimer);
    var wait = Math.max(ms == null ? 4000 : ms, 20000 - (Date.now() - vaultLastAt));
    vaultTimer = setTimeout(vaultSave, wait);
  }
  function vaultNow() { clearTimeout(vaultTimer); return vaultSave(); }
  async function restoreVault(K) {
    if (rawGet(VAULT_MARK)) return 0;              // storage is intact: the marker lives and dies with it
    var meta = null;
    try { meta = JSON.parse((await kcGet(K, "vault.meta")) || "null"); } catch (e) { meta = null; }
    if (!meta || !meta.gen || !meta.parts) return 0;
    try {
      var body = "";
      for (var i = 0; i < meta.parts; i++) {
        var p = await kcGet(K, "vault." + meta.gen + "." + i);
        if (p == null) throw new Error("missing part");
        body += p;
      }
      var data = JSON.parse(await unpack(body));
      var items = data && data.items, n = 0;
      if (!items || typeof items !== "object") throw new Error("empty");
      Object.keys(items).forEach(function (name) {
        if (typeof items[name] === "string" && !vaultSkip(name) && rawSet(PREFIX + name, items[name])) n++;
      });
      rawSet(VAULT_MARK, String(Date.now()));
      rawSet(PREFIX + "vaultRestored", JSON.stringify({ at: Date.now(), savedAt: data.at || meta.at, n: n }));
      return n;
    } catch (e) {
      vaultHold = true;                            // couldn't read it: keep the copy untouched, try again next start
      return 0;
    }
  }
  function vaultInfo() {
    var s = get("vaultSavedAt", null), r = get("vaultRestored", null);
    return { native: !!kit(), savedAt: s && s.at || 0, items: s && s.n || 0, restoredAt: r && r.at || 0, restoredFrom: r && r.savedAt || 0, restoredItems: r && r.n || 0, hold: vaultHold };
  }
  function takeRestoreNote() {
    var r = get("vaultRestored", null);
    if (!r || r.told) return null;
    r.told = true; rawSet(PREFIX + "vaultRestored", JSON.stringify(r));
    return r;
  }
  try {
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") vaultNow(); });
    root.addEventListener("pagehide", function () { vaultNow(); });
  } catch (e) {}

  async function loadKeys() {
    var K = kit();
    if (!K) return;
    var back = 0;
    try { back = await restoreVault(K); } catch (e) {}
    if (back) {
      // everything is back in storage: start over once so every part of her reads it fresh
      var again = false;
      try { again = sessionStorage.getItem("friday.vaultReload") === "1"; sessionStorage.setItem("friday.vaultReload", "1"); } catch (e) {}
      if (!again) { try { root.location.reload(); return; } catch (e) {} }
    }
    try { restoredBrains = await restoreBrains(K); } catch (e) {}
    brainsChecked = true;
    mirrorBrains(get("connections", []));
    scheduleVault(6000);
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
    var K0 = kit();
    if (K0) {   // and the brain copy and the safety copy, so a reset stays a reset
      clearTimeout(vaultTimer);
      ["ai.brains", "ai.vault.meta"].forEach(function (k) { try { K0.secretDelete({ key: k }).catch(noop); } catch (e) {} });
      ["a", "b"].forEach(function (g) { for (var i = 0; i < 40; i++) { try { K0.secretDelete({ key: "ai.vault." + g + "." + i }).catch(noop); } catch (e) {} } });
    }
    if (profile) rawSet(PREFIX + "profile", profile);
    if (key) setApiKey(key);
  }

  root.FridayStorage = {
    keysReady: keysReady,
    keyStore: keyStore,
    restoredBrains: function () { return restoredBrains; },
    vaultInfo: vaultInfo,
    vaultNow: vaultNow,
    takeRestoreNote: takeRestoreNote,
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
