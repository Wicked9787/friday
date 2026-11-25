/* 4.0: research. She checks several free sources at once, rates how reliable each one is, finds where
   they agree or disagree, and hands the results back to her own voice for one answer.

   Sources (all free, no paid search):
   - Web search through her brain's browser tool (Groq), asked to list each finding with the pages it read
   - Google Search through Gemini, if you've added a free Gemini key (answers tied to the pages found)
   - Wikipedia (facts, people, places, how things work)
   - DuckDuckGo instant answers (definitions and quick facts)
   - Google News headlines (only for news and "what happened" questions)

   What's verified is decided here in code, not by the AI: a point counts as verified only when two
   different sites back it up (at least one of them reliable), or one highly reliable site does.
   Points from one site are "single source", points from weak sites are "uncertain", and points the
   sources disagree on are "conflicting". She says which is which and never reads links aloud; the
   links show under her answer. */
(function (root) {
  "use strict";

  var TIERS = [
    ["high", 0.9, [/\.gov$/, /\.gov\.[a-z]{2}$/, /\.mil$/, /\.edu$/, /(^|\.)who\.int$/, /(^|\.)un\.org$/, /(^|\.)europa\.eu$/, /(^|\.)reuters\.com$/, /(^|\.)apnews\.com$/,
      /(^|\.)bbc\.(co\.uk|com)$/, /(^|\.)npr\.org$/, /(^|\.)nature\.com$/, /(^|\.)science\.org$/, /(^|\.)mayoclinic\.org$/, /(^|\.)britannica\.com$/, /(^|\.)pbs\.org$/, /(^|\.)nasa\.gov$/,
      /(^|\.)nih\.gov$/, /(^|\.)cdc\.gov$/, /(^|\.)apple\.com$/]],
    ["good", 0.75, [/(^|\.)wikipedia\.org$/, /(^|\.)nytimes\.com$/, /(^|\.)washingtonpost\.com$/, /(^|\.)wsj\.com$/, /(^|\.)theguardian\.com$/, /(^|\.)bloomberg\.com$/,
      /(^|\.)cnbc\.com$/, /(^|\.)cnn\.com$/, /(^|\.)nbcnews\.com$/, /(^|\.)abcnews\.go\.com$/, /(^|\.)cbsnews\.com$/, /(^|\.)usatoday\.com$/, /(^|\.)espn\.com$/,
      /(^|\.)theverge\.com$/, /(^|\.)arstechnica\.com$/, /(^|\.)techcrunch\.com$/, /(^|\.)wired\.com$/, /(^|\.)investopedia\.com$/, /(^|\.)webmd\.com$/, /(^|\.)healthline\.com$/,
      /(^|\.)consumerreports\.org$/, /(^|\.)nationalgeographic\.com$/, /(^|\.)imdb\.com$/, /(^|\.)weather\.com$/, /(^|\.)accuweather\.com$/, /(^|\.)github\.com$/,
      /(^|\.)stackoverflow\.com$/, /(^|\.)mozilla\.org$/, /(^|\.)forbes\.com$/, /(^|\.)time\.com$/, /(^|\.)economist\.com$/, /(^|\.)latimes\.com$/, /(^|\.)politico\.com$/,
      /(^|\.)axios\.com$/, /(^|\.)homedepot\.com$/, /(^|\.)lowes\.com$/, /(^|\.)thisoldhouse\.com$/, /(^|\.)duckduckgo\.com$/]],
    ["low", 0.3, [/(^|\.)reddit\.com$/, /(^|\.)quora\.com$/, /pinterest\./, /(^|\.)tiktok\.com$/, /(^|\.)facebook\.com$/, /(^|\.)x\.com$/, /(^|\.)twitter\.com$/,
      /(^|\.)instagram\.com$/, /(^|\.)medium\.com$/, /blogspot\./, /(^|\.)wordpress\.com$/, /(^|\.)answers\.com$/, /(^|\.)fandom\.com$/, /(^|\.)youtube\.com$/]]
  ];
  var TIER_WORD = { high: "highly reliable", good: "reliable", unknown: "unrated", low: "weak" };

  function domainOf(urlOrTitle) {
    var s = String(urlOrTitle || "").trim().toLowerCase();
    var m = s.match(/^[a-z]+:\/\/([^\/?#]+)/);
    var host = m ? m[1] : (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(s) ? s : "");
    return host.replace(/^www\./, "").replace(/:\d+$/, "");
  }
  // "news.bbc.co.uk" and "www.bbc.co.uk" are one site
  function siteOf(domain) {
    var p = String(domain || "").split(".");
    if (p.length <= 2) return domain;
    var two = p.slice(-2).join(".");
    return /^(co|com|org|net|gov|ac|edu)\.[a-z]{2}$/.test(two) ? p.slice(-3).join(".") : two;
  }
  function reliability(domain) {
    domain = String(domain || "");
    for (var i = 0; i < TIERS.length; i++) {
      for (var j = 0; j < TIERS[i][2].length; j++) if (TIERS[i][2][j].test(domain)) return { tier: TIERS[i][0], score: TIERS[i][1] };
    }
    return { tier: "unknown", score: 0.5 };
  }
  function makeSource(title, url, via, date, domainHint) {
    var d = domainOf(url);
    // Google's grounding links go through a redirect; its title is the real site
    if (!d || /vertexaisearch|googleusercontent|news\.google\.com$/.test(d)) d = domainOf(domainHint || title) || d;
    var rel = reliability(d);
    return { title: String(title || d || "Source").slice(0, 140), url: String(url || ""), domain: d, site: siteOf(d), tier: rel.tier, score: rel.score, via: via, date: date || "" };
  }

  // What kind of question is it
  function kindOf(q) {
    var t = String(q || "").toLowerCase();
    return {
      news: /\b(news|headlines?|latest|breaking|today|tonight|yesterday|this week|this weekend|last night|what happened|update on|announced|election|score|scores|who won|won the)\b/.test(t),
      entity: /\b(who is|who was|who's|what is|what's|what are|when (was|is|did|were)|where is|how old|population|capital of|founded|born|net worth|how tall|history of)\b/.test(t),
      local: /\b(open now|hours|near me|nearby|closest)\b/.test(t)
    };
  }
  function clean(q) {
    return String(q || "").replace(/^(hey |ok |okay )?(friday|f\.r\.i\.d\.a\.y\.?|jarvis|reed)[, ]+/i, "")
      .replace(/^(?:please )?(?:search(?: the web| online| the internet)?(?: for)?|look up|google|find out|check online(?: for)?|browse(?: for)?)\s+/i, "").trim();
  }
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (res) { setTimeout(function () { res(null); }, ms); })]).catch(function () { return null; });
  }
  function http(url, init) { return root.FridayBrain && root.FridayBrain.http ? root.FridayBrain.http(url, init) : fetch(url, init); }

  // ---------- sources ----------
  async function fromWebSearch(q) {
    var B = root.FridayBrain;
    if (!B || !B.askDetailed) return null;
    var today = new Date().toDateString();
    var r = await B.askDetailed([
      { role: "system", content: "You are a research assistant. Today is " + today + ". Search the web for the question and read the most relevant pages. Reply with only JSON, no other text: {\"findings\": [{\"claim\": \"one specific fact, short\", \"sources\": [{\"title\": \"page title\", \"url\": \"the page's address\", \"date\": \"its date if shown\"}]}]}. Give 3 to 6 findings, each with the pages you actually read for it. If pages disagree, include each claim separately with its own pages. Never make up a page." },
      { role: "user", content: q }
    ], { task: "web", tools: [{ type: "browser_search" }], reasoning_effort: "low", temperature: 0.2, max_tokens: 1400 });
    if (!r || !r.text) return null;
    var out = { via: "Web search", items: [] };
    var m = String(r.text).match(/\{[\s\S]*\}/), j = null;
    try { j = m ? JSON.parse(m[0]) : null; } catch (e) { j = null; }
    (j && Array.isArray(j.findings) ? j.findings : []).slice(0, 8).forEach(function (f) {
      var srcs = (Array.isArray(f && f.sources) ? f.sources : []).filter(function (s) { return s && /^https?:\/\//.test(s.url || ""); })
        .slice(0, 3).map(function (s) { return makeSource(s.title, s.url, "Web search", s.date); });
      if (f && f.claim && srcs.length) out.items.push({ text: String(f.claim).slice(0, 300), sources: srcs });
    });
    // pages the search tool itself returned (when the service includes them)
    try {
      var msg = r.data && r.data.choices && r.data.choices[0] && r.data.choices[0].message;
      (msg && msg.executed_tools || []).forEach(function (t) {
        var res = (t && t.search_results && (t.search_results.results || t.search_results)) || [];
        (Array.isArray(res) ? res : []).slice(0, 6).forEach(function (x) {
          if (x && /^https?:\/\//.test(x.url || "") && x.content) out.items.push({ text: String(x.content).replace(/\s+/g, " ").slice(0, 300), sources: [makeSource(x.title, x.url, "Web search")] });
        });
      });
    } catch (e2) {}
    return out.items.length ? out : null;
  }

  async function fromGoogle(q) {
    var B = root.FridayBrain;
    if (!B || !B.groundedSearch) return null;
    var g = await B.groundedSearch("Answer with specific, current facts. Today is " + new Date().toDateString() + ". Question: " + q);
    if (!g || !g.text) return null;
    var out = { via: "Google Search", items: [] };
    var chunkSrc = g.chunks.map(function (c) { return c ? makeSource(c.title, c.url, "Google Search", "", c.title) : null; });
    g.supports.slice(0, 8).forEach(function (s) {
      var srcs = s.chunks.map(function (i) { return chunkSrc[i]; }).filter(Boolean).slice(0, 3);
      if (s.text && srcs.length) out.items.push({ text: String(s.text).slice(0, 300), sources: srcs });
    });
    if (!out.items.length && chunkSrc.filter(Boolean).length) out.items.push({ text: String(g.text).slice(0, 400), sources: chunkSrc.filter(Boolean).slice(0, 3) });
    return out.items.length ? out : null;
  }

  async function fromWikipedia(q) {
    var term = String(q || "").replace(/^(who|what|when|where|why|how)( is| are| was| were| did| does| do|'s)?\s+/i, "").replace(/[?.!]+$/, "").trim();
    if (term.length < 3) return null;
    var r = await fetch("https://en.wikipedia.org/w/api.php?action=opensearch&limit=1&namespace=0&format=json&origin=*&search=" + encodeURIComponent(term));
    var j = await r.json();
    var title = j && j[1] && j[1][0];
    if (!title) return null;
    var r2 = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title.replace(/ /g, "_")));
    var j2 = await r2.json();
    if (!j2 || !j2.extract) return null;
    var url = (j2.content_urls && j2.content_urls.mobile && j2.content_urls.mobile.page) || ("https://en.wikipedia.org/wiki/" + encodeURIComponent(title.replace(/ /g, "_")));
    return { via: "Wikipedia", items: [{ text: (title + ": " + j2.extract).slice(0, 700), sources: [makeSource("Wikipedia: " + title, url, "Wikipedia")] }] };
  }

  async function fromDuckDuckGo(q) {
    var res = await http("https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=" + encodeURIComponent(q), { method: "GET" });
    if (!res || !res.ok) return null;
    var j = await res.json();
    if (!j) return null;
    var items = [];
    if (j.Answer) items.push({ text: String(j.Answer).slice(0, 300), sources: [makeSource("DuckDuckGo answer", "https://duckduckgo.com/?q=" + encodeURIComponent(q), "DuckDuckGo")] });
    if (j.AbstractText && j.AbstractURL) items.push({ text: String(j.AbstractText).slice(0, 600), sources: [makeSource(j.AbstractSource || j.Heading || "Source", j.AbstractURL, "DuckDuckGo")] });
    if (j.Definition && j.DefinitionURL) items.push({ text: String(j.Definition).slice(0, 300), sources: [makeSource(j.DefinitionSource || "Definition", j.DefinitionURL, "DuckDuckGo")] });
    return items.length ? { via: "DuckDuckGo", items: items } : null;
  }

  async function fromNews(q) {
    var res = await http("https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q=" + encodeURIComponent(q), { method: "GET" });
    if (!res || !res.ok) return null;
    var xml = await res.text();
    var doc = new DOMParser().parseFromString(xml, "text/xml");
    var items = [];
    Array.prototype.slice.call(doc.getElementsByTagName("item"), 0, 6).forEach(function (it) {
      function tag(n) { var e = it.getElementsByTagName(n)[0]; return e ? (e.textContent || "").trim() : ""; }
      var srcEl = it.getElementsByTagName("source")[0];
      var srcName = srcEl ? (srcEl.textContent || "").trim() : "";
      var srcUrl = srcEl ? srcEl.getAttribute("url") || "" : "";
      var title = tag("title").replace(new RegExp("\\s+-\\s+" + srcName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), "");
      var when = tag("pubDate");
      var d = when ? new Date(when) : null;
      if (title) items.push({ text: title + (d && !isNaN(d) ? " (" + d.toDateString() + ")" : ""), sources: [makeSource(srcName || "News", tag("link") || srcUrl, "Google News", d && !isNaN(d) ? d.toISOString() : "", srcUrl)] });
    });
    return items.length ? { via: "Google News", items: items } : null;
  }

  // ---------- the research itself ----------
  var SOURCES = { web: fromWebSearch, google: fromGoogle, wikipedia: fromWikipedia, duckduckgo: fromDuckDuckGo, news: fromNews };

  async function gather(q, opts) {
    opts = opts || {};
    var k = kindOf(q), jobs = { web: 1, google: 1 };
    if (k.entity || !k.news) jobs.wikipedia = 1;
    if (k.entity) jobs.duckduckgo = 1;
    if (k.news) jobs.news = 1;
    var names = Object.keys(jobs), fns = opts.sources || SOURCES;
    var results = await Promise.all(names.map(function (n) { return fns[n] ? withTimeout(Promise.resolve().then(function () { return fns[n](q); }), opts.timeout || 16000) : null; }));
    var evidence = [], seen = {}, used = [];
    results.forEach(function (r, i) {
      if (!r || !r.items || !r.items.length) return;
      used.push(r.via || names[i]);
      r.items.forEach(function (it) {
        var key = String(it.text).toLowerCase().slice(0, 80);
        if (seen[key]) return;
        seen[key] = 1;
        evidence.push({ n: evidence.length + 1, text: it.text, sources: it.sources });
      });
    });
    return { kind: k, evidence: evidence.slice(0, 16), used: used, tried: names };
  }

  var RANK = { verified: 3, single: 2, uncertain: 1, conflicting: 0 };
  // The code decides what counts as verified, from the sources each point actually cites.
  function judge(sources, modelSays) {
    var sites = {}, best = 0, reliableSites = 0;
    sources.forEach(function (s) { if (!sites[s.site]) { sites[s.site] = 1; if (s.score >= 0.5) reliableSites++; } best = Math.max(best, s.score); });
    var n = Object.keys(sites).length, st;
    if ((n >= 2 && reliableSites >= 1) || best >= 0.9) st = "verified";
    else if (n === 1 && best >= 0.5) st = "single";
    else st = "uncertain";
    var m = { verified: "verified", likely: "single", single: "single", uncertain: "uncertain", conflicting: "conflicting" }[String(modelSays || "").toLowerCase()];
    if (m && RANK[m] < RANK[st]) st = m;   // the AI can lower a status (sources disagree), never raise it
    return st;
  }

  async function synthesize(q, g, opts) {
    var B = root.FridayBrain;
    var lines = g.evidence.map(function (e) {
      return "[" + e.n + "] " + e.text + " — " + e.sources.map(function (s) { return s.domain + " (" + TIER_WORD[s.tier] + (s.date ? ", " + String(s.date).slice(0, 10) : "") + ")"; }).join("; ");
    }).join("\n");
    var out = opts && opts.synthReply != null ? opts.synthReply : await B.ask([
      { role: "system", content: "You weigh research evidence. Today is " + new Date().toDateString() + ". Use only the numbered evidence below, not your own memory, for anything that can change over time. Reply with only JSON: {\"points\": [{\"text\": \"a short statement that answers part of the question\", \"evidence\": [evidence numbers that support it], \"status\": \"verified|likely|uncertain\"}], \"conflicts\": [{\"about\": \"what the disagreement is about\", \"claims\": [{\"text\": \"one side\", \"evidence\": [numbers]}]}], \"gaps\": \"what the evidence doesn't answer, or empty\"}. Keep 2 to 5 points. Put a disagreement in conflicts instead of picking a side." },
      { role: "user", content: "Question: " + q + "\n\nEvidence:\n" + lines }
    ], { task: "research", temperature: 0.2, max_tokens: 900 });
    var m = String(out || "").match(/\{[\s\S]*\}/), j = null;
    try { j = m ? JSON.parse(m[0]) : null; } catch (e) { j = null; }
    return j;
  }

  function srcsFor(nums, g) {
    var out = [], seen = {};
    (Array.isArray(nums) ? nums : []).forEach(function (n) {
      var e = g.evidence[(+n) - 1];
      if (e) e.sources.forEach(function (s) { var k = s.url || s.domain; if (!seen[k]) { seen[k] = 1; out.push(s); } });
    });
    return out;
  }

  async function research(question, opts) {
    opts = opts || {};
    var q = clean(question);
    if (root.FridayBrain && root.FridayBrain.activity) root.FridayBrain.activity("research", "Checking sources: " + q.slice(0, 50));
    var g = await gather(q, opts);
    if (!g.evidence.length) return { ok: false, question: q, tried: g.tried, points: [], conflicts: [], sources: [], brief: "" };
    var j = null;
    try { j = await synthesize(q, g, opts); } catch (e) { j = null; }
    var points = [], conflicts = [];
    if (j && Array.isArray(j.points)) j.points.slice(0, 6).forEach(function (p) {
      var srcs = srcsFor(p && p.evidence, g);
      if (!p || !p.text || !srcs.length) return;          // a point has to rest on cited evidence
      points.push({ text: String(p.text).slice(0, 300), status: judge(srcs, p.status), sources: srcs });
    });
    if (j && Array.isArray(j.conflicts)) j.conflicts.slice(0, 3).forEach(function (c) {
      var claims = (Array.isArray(c && c.claims) ? c.claims : []).map(function (x) { return { text: String((x && x.text) || "").slice(0, 200), sources: srcsFor(x && x.evidence, g) }; })
        .filter(function (x) { return x.text && x.sources.length; });
      if (claims.length >= 2) conflicts.push({ about: String(c.about || "").slice(0, 160), claims: claims });
    });
    // anything a conflict touches can't be called verified
    conflicts.forEach(function (c) {
      var words = c.about.toLowerCase().match(/[a-z0-9]{4,}/g) || [];
      points.forEach(function (p) { if (words.filter(function (w) { return p.text.toLowerCase().indexOf(w) >= 0; }).length >= 2) p.status = "conflicting"; });
    });
    if (!points.length) {
      // the AI step failed: fall back to the raw evidence, judged by its own sources
      g.evidence.slice(0, 4).forEach(function (e) { points.push({ text: e.text, status: judge(e.sources), sources: e.sources }); });
    }
    var sources = [], seen = {};
    points.concat(conflicts.reduce(function (a, c) { return a.concat(c.claims); }, [])).forEach(function (p) {
      p.sources.forEach(function (s) { var k = s.url || s.domain; if (!seen[k]) { seen[k] = 1; sources.push(s); } });
    });
    sources.forEach(function (s) { s.verified = points.some(function (p) { return p.status === "verified" && p.sources.indexOf(s) >= 0; }); });
    var res = { ok: true, question: q, kind: g.kind, used: g.used, tried: g.tried, points: points, conflicts: conflicts, gaps: j && j.gaps ? String(j.gaps).slice(0, 200) : "", sources: sources.slice(0, 10) };
    res.brief = brief(res);
    if (root.FridayBrain && root.FridayBrain.activity) root.FridayBrain.activity("research", "Checked " + sources.length + " sources (" + points.filter(function (p) { return p.status === "verified"; }).length + " points verified)");
    return res;
  }

  function names(srcs) { var seen = {}, out = []; srcs.forEach(function (s) { var n = s.site || s.domain; if (n && !seen[n]) { seen[n] = 1; out.push(n); } }); return out.slice(0, 3).join(", "); }
  function brief(r) {
    var by = function (st) { return r.points.filter(function (p) { return p.status === st; }); };
    var parts = ["Research results for \"" + r.question + "\" (checked " + r.used.join(", ") + "):"];
    if (by("verified").length) parts.push("Verified (more than one site, or a highly reliable one):\n" + by("verified").map(function (p) { return "- " + p.text + " [" + names(p.sources) + "]"; }).join("\n"));
    if (by("single").length) parts.push("From one reliable site only:\n" + by("single").map(function (p) { return "- " + p.text + " [" + names(p.sources) + "]"; }).join("\n"));
    if (by("uncertain").length) parts.push("Uncertain (weak or unrated sites only):\n" + by("uncertain").map(function (p) { return "- " + p.text + " [" + names(p.sources) + "]"; }).join("\n"));
    if (by("conflicting").length || r.conflicts.length) parts.push("Sources disagree:\n" + r.conflicts.map(function (c) { return "- " + c.about + ": " + c.claims.map(function (x) { return x.text + " [" + names(x.sources) + "]"; }).join(" vs. "); }).concat(by("conflicting").map(function (p) { return "- " + p.text + " [" + names(p.sources) + "]"; })).join("\n"));
    if (r.gaps) parts.push("Couldn't confirm: " + r.gaps);
    parts.push("How to answer: lead with what's verified. Say plainly when something is from one site, uncertain, or disputed, and don't present it as fact. Name a source when it helps (\"according to Reuters\"). Never read out links; they're shown on screen. Two to four short spoken sentences.");
    return parts.join("\n\n");
  }

  root.FridayResearch = { research: research, gather: gather, judge: judge, reliability: reliability, domainOf: domainOf, siteOf: siteOf, makeSource: makeSource, kindOf: kindOf, SOURCES: SOURCES, brief: brief };
})(window);
