/* Friday 3.5.2 — pictures.
   "Show me pictures of …", "what does … look like", or anything with photos/pictures/images in it:
   she answers like normal and opens a Pictures panel with real photos.
   Free, no key: Openverse (openly licensed photos) first, Wikimedia Commons as the backup. */
(function (root) {
  "use strict";

  var PIC_RE = /\b(pictures?|photos?|images?|pics?)\b|\bwhat (?:does|do|did|would) .{2,60} look like\b|\bshow me (?:how|what|some|a |an |the best way|examples?)/i;
  var NOT_RE = /\b(take|snap|took|my|this|that|send|text|share|attach) (?:a |the |me a |her a |him a )?(?:photo|picture|pic|image)s?\b|\b(?:photo|camera) (?:of|for) me\b|\bprofile (?:photo|picture)\b/i;

  function wants(text) {
    var t = String(text || "");
    return PIC_RE.test(t) && !NOT_RE.test(t);
  }

  function stripped(text) {
    return String(text || "")
      .replace(/\b(can you|could you|would you|please|hey|friday|reed|jarvis|show me|send me|give me|find me|find|get me|i want to see|let me see|some|a few|with)\b/gi, " ")
      .replace(/\b(pictures?|photos?|images?|pics?) (?:of|for|on)\b/gi, " ")
      .replace(/\b(pictures?|photos?|images?|pics?)\b/gi, " ")
      .replace(/\bwhat (?:does|do|did|would) (.+?) look like\b/i, "$1")
      .replace(/[?!.,]+/g, " ").replace(/\s+/g, " ").trim();
  }

  // A short image-search phrase ("best way to make stairs" -> "building wooden stairs").
  async function makeQuery(text, context) {
    var fallback = stripped(text);
    if (fallback.length < 3 && context) fallback = stripped(context);
    fallback = fallback || String(text || "").slice(0, 60);
    try {
      if (!root.FridayBrain || !root.FridayBrain.ask) return fallback;
      var out = await root.FridayBrain.ask([
        { role: "system", content: "Turn the user's request into a 2 to 5 word photo search phrase that would find helpful real photos. Reply with only the phrase, no quotes." },
        { role: "user", content: (context ? "Earlier they said: " + String(context).slice(0, 300) + "\nNow: " : "") + String(text || "") }
      ], { purpose: "small", temperature: 0, max_tokens: 30, reasoning_effort: "low", noBackup: true });
      out = String(out || "").replace(/["'\n]/g, " ").replace(/\s+/g, " ").trim();
      return out && out.length < 80 ? out : fallback;
    } catch (e) { return fallback; }
  }

  function nativeHttp() {
    var C = root.Capacitor;
    try { return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.CapacitorHttp || null; } catch (e) { return null; }
  }
  async function getJSON(url) {
    try {
      var r = await fetch(url, { headers: { Accept: "application/json" } });
      if (r.ok) return await r.json();
    } catch (e) {}
    var H = nativeHttp();
    if (!H) return null;
    try {
      var n = await H.request({ url: url, method: "GET", headers: { Accept: "application/json" }, connectTimeout: 10000, readTimeout: 20000 });
      var d = n && n.data;
      return typeof d === "string" ? JSON.parse(d) : d;
    } catch (e2) { return null; }
  }

  async function openverse(q) {
    var d = await getJSON("https://api.openverse.org/v1/images/?page_size=12&mature=false&q=" + encodeURIComponent(q));
    var list = (d && d.results) || [];
    return list.filter(function (x) { return x && (x.thumbnail || x.url); }).map(function (x) {
      return {
        thumb: x.thumbnail || x.url, full: x.url || x.thumbnail,
        title: x.title || "", by: x.creator || "", source: x.foreign_landing_url || x.url,
        license: (x.license ? "CC " + String(x.license).toUpperCase() : "") + (x.license_version ? " " + x.license_version : "")
      };
    });
  }

  async function commons(q) {
    var url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&gsrsearch=" + encodeURIComponent(q + " filetype:bitmap");
    var d = await getJSON(url);
    var pages = d && d.query && d.query.pages ? Object.keys(d.query.pages).map(function (k) { return d.query.pages[k]; }) : [];
    pages.sort(function (a, b) { return (a.index || 0) - (b.index || 0); });
    return pages.filter(function (p) { return p.imageinfo && p.imageinfo[0]; }).map(function (p) {
      var ii = p.imageinfo[0], md = ii.extmetadata || {};
      function v(k) { return md[k] && md[k].value ? String(md[k].value).replace(/<[^>]+>/g, "").trim() : ""; }
      return {
        thumb: ii.thumburl || ii.url, full: ii.url, title: String(p.title || "").replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, ""),
        by: v("Artist"), source: ii.descriptionurl || ii.url, license: v("LicenseShortName")
      };
    });
  }

  async function search(q) {
    var out = [];
    try { out = await openverse(q); } catch (e) {}
    if (out.length < 4) {
      var more = [];
      try { more = await commons(q); } catch (e2) {}
      out = out.concat(more);
    }
    var seen = {};
    return out.filter(function (x) { if (!x.thumb || seen[x.thumb]) return false; seen[x.thumb] = 1; return true; }).slice(0, 12);
  }

  async function find(text, context) {
    var q = await makeQuery(text, context);
    var items = await search(q);
    if (!items.length && q !== stripped(text)) items = await search(stripped(text));
    return { query: q, items: items };
  }

  // Draws the Pictures panel. Tap a photo to see it big; tap the credit to open where it came from.
  function render(box, data, answer, openUrl) {
    if (!box) return;
    box.innerHTML = "";
    if (answer) {
      var a = document.createElement("div");
      a.className = "msg friday pics-answer";
      a.textContent = answer;
      box.appendChild(a);
    }
    var head = document.createElement("div");
    head.className = "sub";
    head.textContent = data && data.items && data.items.length ? "Photos of " + data.query : "I couldn't find photos for that. Try different words.";
    box.appendChild(head);
    var grid = document.createElement("div");
    grid.className = "pics-grid";
    ((data && data.items) || []).forEach(function (it) {
      var cell = document.createElement("figure");
      cell.className = "pics-cell";
      var img = document.createElement("img");
      img.loading = "lazy";
      img.alt = it.title || data.query;
      img.src = it.thumb;
      img.onerror = function () { cell.remove(); };
      img.onclick = function () {
        var big = cell.classList.toggle("big");
        if (big && it.full && img.src !== it.full) img.src = it.full;
      };
      var cap = document.createElement("figcaption");
      cap.textContent = [it.by, it.license].filter(Boolean).join(" · ") || "Source";
      cap.onclick = function () { if (it.source && openUrl) openUrl(it.source); };
      cell.appendChild(img);
      cell.appendChild(cap);
      grid.appendChild(cell);
    });
    box.appendChild(grid);
  }

  root.FridayPictures = { wants: wants, find: find, search: search, render: render };
})(window);
