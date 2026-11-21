/* Friday 3.4: private line between Friday and Jarvis.
   Messages are locked on this phone before they leave (end-to-end): only the paired phone can unlock them.
   - Each phone makes its own key pair (ECDH P-256). Only the public half travels, by text.
   - Both phones work out the same secret key from their own private half and the other phone's public half.
   - 4 safety words (from both public keys) let you and your partner check nobody swapped a key in between.
   - Messages are AES-GCM locked. The texts in the Messages app are just scrambled letters and a link.
   - Keys live in the iPhone Keychain (this phone only). Private messages never go to her AI brain, memory or chat.
*/
(function (root) {
  "use strict";
  var WORDS = ["acorn", "adobe", "alpha", "amber", "angel", "apple", "april", "arrow", "aspen", "atlas", "autumn", "badge", "bagel", "bamboo", "banjo", "barley", "basil", "beach", "beacon", "berry", "birch", "bison", "blaze", "bloom", "bluff", "bobcat", "bonus", "brave", "bread", "breeze", "brick", "bridge", "brook", "brush", "bubble", "buffalo", "bugle", "butter", "cabin", "cactus", "camel", "candle", "canoe", "canyon", "carbon", "cargo", "carrot", "castle", "cedar", "cello", "chalk", "charm", "cherry", "chess", "chimney", "cider", "cinema", "circus", "citrus", "clover", "cobalt", "cocoa", "comet", "coral", "cotton", "cougar", "cowboy", "coyote", "crane", "crayon", "cricket", "crown", "crystal", "cupcake", "daisy", "dancer", "delta", "denim", "desert", "diamond", "dingo", "dolphin", "domino", "donut", "dragon", "dream", "drum", "eagle", "echo", "eclipse", "ember", "emerald", "engine", "falcon", "feather", "fern", "fiddle", "fig", "flame", "flute", "forest", "fossil", "fox", "galaxy", "garden", "garnet", "gecko", "ginger", "glacier", "globe", "gold", "gopher", "grape", "gravel", "guitar", "hammer", "harbor", "harp", "hazel", "heron", "hickory", "honey", "hornet", "husky", "igloo", "iris", "island", "ivory", "jacket", "jade", "jaguar", "jasmine", "jazz", "jelly", "jewel", "jungle", "kayak", "kettle", "kiwi", "koala", "ladder", "lagoon", "lantern", "lava", "lemon", "lily", "lime", "linen", "lion", "llama", "lobster", "lotus", "lunar", "magnet", "mango", "maple", "marble", "meadow", "melon", "meteor", "mint", "mirror", "mocha", "moose", "mosaic", "moss", "mustang", "nectar", "needle", "nickel", "north", "nova", "nutmeg", "oak", "oasis", "ocean", "olive", "onyx", "opal", "orbit", "orchid", "otter", "owl", "paddle", "panda", "panther", "papaya", "parrot", "peach", "pebble", "pecan", "pepper", "piano", "pickle", "pilot", "pine", "pixel", "planet", "plum", "polar", "pony", "poppy", "prairie", "prism", "puffin", "pumpkin", "quartz", "quill", "rabbit", "radar", "rain", "raven", "reef", "ribbon", "river", "robin", "rocket", "rose", "ruby", "saddle", "saffron", "sage", "salmon", "sapphire", "satin", "scarf", "scout", "shell", "silver", "skate", "sky", "sled", "smoke", "snow", "sparrow", "spice", "spruce", "squash", "star", "stone", "storm", "sugar", "summit", "sunset", "swan", "tango", "thunder", "tiger", "timber", "toast", "topaz", "torch", "trail", "tulip", "tundra", "turtle"];
  var subtle = root.crypto && root.crypto.subtle;
  var enc = new TextEncoder(), dec = new TextDecoder();
  function S() { return root.FridayStorage; }

  function b64u(buf) {
    var b = new Uint8Array(buf), s = "";
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function unb64u(str) {
    str = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    var s = atob(str), b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }
  function concat(a, b) { var o = new Uint8Array(a.length + b.length); o.set(a, 0); o.set(b, a.length); return o; }
  function uid() { return b64u(root.crypto.getRandomValues(new Uint8Array(9))); }

  // ---------- secrets: iPhone Keychain (web test page: this browser only) ----------
  function kit() { var C = root.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.FridayKit && C.Plugins.FridayKit.secretGet ? C.Plugins.FridayKit : null; }
  async function secretGet(k) {
    var K = kit();
    if (K) { try { var r = await K.secretGet({ key: k }); return r && r.value != null ? JSON.parse(r.value) : null; } catch (e) { return null; } }
    try { var v = root.localStorage.getItem("friday.secret." + k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  async function secretSet(k, v) {
    var K = kit(), s = JSON.stringify(v);
    if (K) { await K.secretSet({ key: k, value: s }); return; }
    root.localStorage.setItem("friday.secret." + k, s);
  }
  async function secretDel(k) {
    var K = kit();
    if (K) { try { await K.secretDelete({ key: k }); } catch (e) {} return; }
    try { root.localStorage.removeItem("friday.secret." + k); } catch (e) {}
  }

  // ---------- who is who ----------
  function mine() { var p = root.__fridayProfile || {}; return p.id === "batsie" ? "Jarvis" : "Friday"; }
  function theirs() { return mine() === "Jarvis" ? "Friday" : "Jarvis"; }

  // ---------- keys ----------
  async function makeMe() {
    var kp = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    var jwk = await subtle.exportKey("jwk", kp.privateKey);
    var raw = await subtle.exportKey("raw", kp.publicKey);
    var me = { priv: jwk, pub: b64u(raw), at: Date.now(), sent: false };
    await secretSet("pl.me", me);
    return me;
  }
  async function getMe(create) {
    var me = await secretGet("pl.me");
    if (!me && create) me = await makeMe();
    return me;
  }
  async function getPeer() { return secretGet("pl.peer"); }
  function validPub(pub) {
    try { var b = unb64u(pub); return b.length === 65 && b[0] === 4; } catch (e) { return false; }
  }
  var keyCache = { sig: "", key: null };
  async function sharedKey() {
    var me = await getMe(false), peer = await getPeer();
    if (!me || !peer) return null;
    var sig = me.pub + "|" + peer.pub;
    if (keyCache.sig === sig && keyCache.key) return keyCache.key;
    var priv = await subtle.importKey("jwk", me.priv, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
    var pub = await subtle.importKey("raw", unb64u(peer.pub), { name: "ECDH", namedCurve: "P-256" }, false, []);
    var bits = await subtle.deriveBits({ name: "ECDH", public: pub }, priv, 256);
    var hk = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
    var pubs = [me.pub, peer.pub].sort().join("|");
    var salt = await subtle.digest("SHA-256", enc.encode(pubs));
    var key = await subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: salt, info: enc.encode("friday-jarvis private line v1") }, hk, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    keyCache = { sig: sig, key: key };
    return key;
  }
  async function safetyWords() {
    var me = await getMe(false), peer = await getPeer();
    if (!me || !peer) return [];
    var h = new Uint8Array(await subtle.digest("SHA-256", enc.encode("safety|" + [me.pub, peer.pub].sort().join("|"))));
    return [WORDS[h[0]], WORDS[h[1]], WORDS[h[2]], WORDS[h[3]]];
  }

  async function status() {
    if (!subtle) return { ok: false, paired: false, verified: false, words: [], reason: "no-crypto" };
    var me = await getMe(false), peer = await getPeer();
    return { ok: true, haveKey: !!me, sent: !!(me && me.sent), paired: !!(me && peer), verified: !!(me && peer && peer.verified), words: me && peer ? await safetyWords() : [], partner: theirs(), at: peer ? peer.at : 0 };
  }
  // The pairing payload for a text: "k.<my public key>"
  async function myKeyPayload() { var me = await getMe(true); return "k." + me.pub; }
  async function markSent() { var me = await getMe(true); me.sent = true; await secretSet("pl.me", me); }
  // A key came in from the other phone. needReply: send yours back so they can finish too.
  async function receiveKey(pub) {
    if (!validPub(pub)) return { ok: false, reason: "bad-key" };
    var me = await getMe(true), peer = await getPeer();
    if (pub === me.pub) return { ok: false, reason: "own-key" };
    var changed = !peer || peer.pub !== pub;
    if (peer && peer.pub !== pub) { me.sent = false; await secretSet("pl.me", me); }
    if (changed) { await secretSet("pl.peer", { pub: pub, at: Date.now(), verified: false }); keyCache = { sig: "", key: null }; }
    return { ok: true, changed: changed, needReply: !me.sent, words: await safetyWords() };
  }
  async function verify(on) {
    var peer = await getPeer();
    if (!peer) return false;
    peer.verified = on !== false;
    await secretSet("pl.peer", peer);
    return true;
  }
  async function unpair() {
    await secretDel("pl.me"); await secretDel("pl.peer");
    keyCache = { sig: "", key: null };
  }

  // ---------- locking and unlocking messages ----------
  async function seal(text) {
    var key = await sharedKey();
    if (!key) throw new Error("not-paired");
    var iv = root.crypto.getRandomValues(new Uint8Array(12));
    var msg = { v: 1, id: uid(), from: mine(), at: Date.now(), m: String(text || "") };
    var ad = enc.encode("fj1|" + mine() + ">" + theirs());
    var ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: iv, additionalData: ad }, key, enc.encode(JSON.stringify(msg))));
    return { payload: "m." + b64u(concat(iv, ct)), msg: msg };
  }
  async function open(payload) {
    var key = await sharedKey();
    if (!key) return { ok: false, reason: "not-paired" };
    var b;
    try { b = unb64u(String(payload || "").replace(/^m\./, "")); } catch (e) { return { ok: false, reason: "bad" }; }
    if (b.length < 30) return { ok: false, reason: "bad" };
    var ad = enc.encode("fj1|" + theirs() + ">" + mine());
    try {
      var pt = await subtle.decrypt({ name: "AES-GCM", iv: b.slice(0, 12), additionalData: ad }, key, b.slice(12));
      var msg = JSON.parse(dec.decode(pt));
      if (!msg || typeof msg.m !== "string") return { ok: false, reason: "bad" };
      var seen = S().get("plSeen", []) || [];
      if (seen.indexOf(msg.id) >= 0) return { ok: false, reason: "seen", msg: msg };
      seen.push(msg.id); S().set("plSeen", seen.slice(-300));
      return { ok: true, msg: msg };
    } catch (e) { return { ok: false, reason: "locked" }; }
  }

  // ---------- private inbox, locked on this phone too ----------
  async function localKey() {
    var raw = await secretGet("pl.local");
    if (!raw) { raw = b64u(root.crypto.getRandomValues(new Uint8Array(32))); await secretSet("pl.local", raw); }
    return subtle.importKey("raw", unb64u(raw), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  }
  async function inbox() {
    var box = S().get("privateBox", null);
    if (!box || !box.c) return [];
    try {
      var key = await localKey(), b = unb64u(box.c);
      var pt = await subtle.decrypt({ name: "AES-GCM", iv: b.slice(0, 12) }, key, b.slice(12));
      var list = JSON.parse(dec.decode(pt));
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  async function saveInbox(list) {
    var key = await localKey();
    var iv = root.crypto.getRandomValues(new Uint8Array(12));
    var ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(JSON.stringify((list || []).slice(-300)))));
    S().set("privateBox", { v: 1, c: b64u(concat(iv, ct)) });
    try { root.dispatchEvent(new CustomEvent("friday:private")); } catch (e) {}
  }
  async function addToInbox(item) {
    var list = await inbox();
    list.push(Object.assign({ id: uid(), at: Date.now() }, item));
    await saveInbox(list);
    return list;
  }
  async function clearInbox() { S().set("privateBox", null); try { root.dispatchEvent(new CustomEvent("friday:private")); } catch (e) {} }

  // The text that goes in the Messages app: scrambled letters and a link that opens the other app.
  function textFor(payload, prefix, kind) {
    var other = theirs(), scheme = other.toLowerCase();
    var head = kind === "key" ? "🔑 Private line key" : "🔒 Private message";
    return (prefix ? prefix + " " : "") + head + ". Tap to open in " + other + ": " + scheme + "://pl?d=" + payload;
  }
  // Finds a private line link inside a text (the automation hands over the whole text).
  function findPayload(text) {
    var m = String(text || "").match(/:\/\/pl\?d=((?:k|m)\.[A-Za-z0-9_-]+)/);
    return m ? m[1] : "";
  }

  root.FridayPrivate = {
    available: function () { return !!subtle; },
    status: status, myKeyPayload: myKeyPayload, markSent: markSent, receiveKey: receiveKey, verify: verify, unpair: unpair,
    seal: seal, open: open, inbox: inbox, addToInbox: addToInbox, clearInbox: clearInbox, saveInbox: saveInbox,
    textFor: textFor, findPayload: findPayload, safetyWords: safetyWords, mine: mine, theirs: theirs,
    _b64u: b64u, _unb64u: unb64u
  };
})(window);
