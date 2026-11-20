void (async function () {
// Jarvis Home Screen widget for Scriptable: Concept 28 "Obsidian".
// Sizes: small (Talk), medium (greeting + weather), large (quick bubbles).
//
// Widget Parameter (press the widget > Edit Widget > Parameter). Words, any order:
//   clear | tinted | solid      background style (clear is the default)
//   tinted 40                   tint strength in percent (default 25)
//   small-tl, medium-top, ...   which clear background to use
//                               (the Clear Background script tells you what to type)
//   app                         make taps open the app instead of Talk
//   orb n | orb x1 | orb x2 | orb h2   which HD orb to show (default n)
//   classic                     use the original drawn orb instead of the HD one
// Example: clear medium-top orb x2
// No API keys in this script.

// ---- Profile ----
const ASSISTANT = "Jarvis"
const SHORTCUT = "Jarvis"
const TERM = "ma'am"
const APP_URL = "jarvis://"
const SITE_URL = "https://wicked9787.github.io/friday/?u=batsie"
// -----------------

const GOLD = "#d9b468", GOLD_HI = "#f3dc9a", SILVER = "#e4e7ec", INK = "#f2efe9"
const FALLBACK = { lat: 36.6, lon: -83.66 }
const S = 3 // draw everything at 3x for a sharp look

const words = (args.widgetParameter || "").toLowerCase().split(/[\s,]+/).filter(Boolean)
const STYLE = words.find(w => w === "clear" || w === "tinted" || w === "solid") || "clear"
const TINT = Math.min(90, Math.max(0, parseInt(words.find(w => /^\d+$/.test(w)) || "25", 10))) / 100
const SLOT = words.find(w => /^(small|medium|large)-[a-z]+$/.test(w))
const TAP_APP = words.includes("app")
const CLASSIC = words.includes("classic")
const ORB_LOOK = (words[words.indexOf("orb") + 1] && words.includes("orb")) ? words[words.indexOf("orb") + 1] : "n"
const FAMILY = config.widgetFamily || "large"

function talkUrl(text) {
  let u = "shortcuts://run-shortcut?name=" + encodeURIComponent(SHORTCUT)
  if (text) u += "&input=text&text=" + encodeURIComponent(text)
  return u
}
const TAP = TAP_APP ? APP_URL : talkUrl()

// ---------- helpers ----------
function seeded(seed) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}
function gauss(r) { return (r() + r() + r() - 1.5) / 1.5 }
function col(hex, a) { return new Color(hex, a) }

function widgetSize(fam) {
  const w = Math.round(Device.screenSize().width)
  const t = {
    440: [170, 364, 382], 430: [170, 364, 382], 428: [170, 364, 382], 414: [169, 360, 379],
    402: [164, 349, 367], 393: [158, 338, 354], 390: [158, 338, 354], 375: [155, 329, 345], 360: [155, 329, 345]
  }
  let v = t[w]
  if (!v) { const k = w / 390; v = [158 * k, 338 * k, 354 * k] }
  if (fam === "small") return new Size(v[0], v[0])
  if (fam === "medium") return new Size(v[1], v[0])
  return new Size(v[1], v[2])
}

function greeting() {
  const h = new Date().getHours()
  const part = h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 22 ? "Good evening" : "Good night"
  return part + ", " + TERM + (h < 5 ? "?" : ".")
}

// ---------- weather (Open-Meteo, cached) ----------
const WX = {
  0: ["sun.max.fill", "Clear"], 1: ["sun.max.fill", "Clear"], 2: ["cloud.sun.fill", "Partly cloudy"], 3: ["cloud.fill", "Cloudy"],
  45: ["cloud.fog.fill", "Fog"], 48: ["cloud.fog.fill", "Fog"], 51: ["cloud.drizzle.fill", "Drizzle"], 53: ["cloud.drizzle.fill", "Drizzle"],
  55: ["cloud.drizzle.fill", "Drizzle"], 61: ["cloud.rain.fill", "Rain"], 63: ["cloud.rain.fill", "Rain"], 65: ["cloud.heavyrain.fill", "Heavy rain"],
  66: ["cloud.sleet.fill", "Sleet"], 67: ["cloud.sleet.fill", "Sleet"], 71: ["cloud.snow.fill", "Snow"], 73: ["cloud.snow.fill", "Snow"],
  75: ["cloud.snow.fill", "Snow"], 77: ["cloud.snow.fill", "Snow"], 80: ["cloud.rain.fill", "Showers"], 81: ["cloud.rain.fill", "Showers"],
  82: ["cloud.heavyrain.fill", "Showers"], 85: ["cloud.snow.fill", "Snow"], 86: ["cloud.snow.fill", "Snow"], 95: ["cloud.bolt.rain.fill", "Storms"],
  96: ["cloud.bolt.rain.fill", "Storms"], 99: ["cloud.bolt.rain.fill", "Storms"]
}
async function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => Timer.schedule(ms, false, () => rej(new Error("timeout"))))])
}
async function weather() {
  const fm = FileManager.local()
  const cache = fm.joinPath(fm.cacheDirectory(), "friday-weather.json")
  let old = null
  try { if (fm.fileExists(cache)) old = JSON.parse(fm.readString(cache)) } catch (e) {}
  if (old && Date.now() - old.at < 20 * 60 * 1000) return old
  let lat = FALLBACK.lat, lon = FALLBACK.lon
  try {
    Location.setAccuracyToThreeKilometers()
    const loc = await withTimeout(Location.current(), 4000)
    lat = loc.latitude; lon = loc.longitude
  } catch (e) { if (old && old.lat) { lat = old.lat; lon = old.lon } }
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat.toFixed(3) + "&longitude=" + lon.toFixed(3) +
      "&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto&forecast_days=1"
    const r = new Request(url); r.timeoutInterval = 8
    const j = await r.loadJSON()
    const code = j.current.weather_code
    const w = WX[code] || ["cloud.fill", "Weather"]
    let sym = w[0]
    if (!j.current.is_day && (code === 0 || code === 1)) sym = "moon.stars.fill"
    if (!j.current.is_day && code === 2) sym = "cloud.moon.fill"
    const out = { at: Date.now(), lat, lon, temp: Math.round(j.current.temperature_2m), sym, text: w[1],
      hi: Math.round(j.daily.temperature_2m_max[0]), lo: Math.round(j.daily.temperature_2m_min[0]) }
    fm.writeString(cache, JSON.stringify(out))
    return out
  } catch (e) { return old }
}

// ---------- drawing: concept 25/28 dust wave + obsidian orb ----------

// ---------- HD orb (rendered by the app's HD engine, downloaded once and kept) ----------
const ORB_BASE = "https://raw.githubusercontent.com/wicked9787/friday/friday-native/icons/widget/orb-"
async function hdOrb(look) {
  look = (look || "n").toLowerCase()
  const fm = FileManager.local()
  const p = fm.joinPath(fm.documentsDirectory(), "Friday-HD-Orb-" + look + ".png")
  const fresh = fm.fileExists(p) && (Date.now() - fm.modificationDate(p).getTime()) < 14 * 864e5
  if (fresh) { try { return fm.readImage(p) } catch (e) {} }
  try {
    const r = new Request(ORB_BASE + look + ".png"); r.timeoutInterval = 10
    const img = await withTimeout(r.loadImage(), 12000)
    if (img && img.size && img.size.width > 50) { fm.writeImage(p, img); return img }
  } catch (e) {}
  if (fm.fileExists(p)) { try { return fm.readImage(p) } catch (e) {} }
  return null
}

let HD_IMG = null

function haze(ctx, cx, cy, rx, ry, hex, peak, steps) {
  for (let i = steps; i >= 1; i--) {
    const k = i / steps
    ctx.setFillColor(col(hex, peak * (1 - k) * (1 - k) + 0.004))
    ctx.fillEllipse(new Rect(cx - rx * k, cy - ry * k, rx * 2 * k, ry * 2 * k))
  }
}

// Broad faint particle band across the card (concept 25 background wave).
function dustBand(ctx, w, h, seed, strength) {
  const r = seeded(seed)
  haze(ctx, w * 0.62, h * 0.48, w * 0.55, h * 0.42, "#b8913f", 0.05 * strength, 60)
  const n = Math.round((w * h) / (S * S * 70) * strength)
  for (let i = 0; i < n; i++) {
    const t = r()
    const x = t * w * 1.1 - w * 0.05
    const yc = h * (0.62 - 0.28 * Math.sin(t * Math.PI * 1.15 + 0.4))
    const y = yc + gauss(r) * h * 0.22
    const big = r() < 0.06
    const d = (big ? 1.8 + r() * 1.6 : 0.5 + r() * 1.1) * S * 0.5
    const gold = r() < 0.72
    ctx.setFillColor(col(gold ? GOLD : SILVER, (big ? 0.55 : 0.25 + r() * 0.35) * strength))
    ctx.fillEllipse(new Rect(x - d / 2, y - d / 2, d, d))
  }
}

// Gold and silver ribbon strands with a voice spike, trailing into dust.
function strands(ctx, cx, cy, R, seed, dustReach) {
  const r = seeded(seed)
  const x0 = cx - R * 0.78, x1 = cx + R * 0.1
  const wave = (t, ph, amp) => {
    const env = Math.pow(Math.sin(Math.PI * t), 0.7) * (0.5 + 0.5 * t)
    const v = Math.exp(-Math.pow((t - 0.5) / 0.14, 2))
    return cy + R * amp * (env * Math.sin(t * Math.PI * 3.2 + ph) * 0.3 + v * 0.1 * Math.sin(t * Math.PI * 6 + ph * 0.5))
  }
  const N = 18
  for (let pass = 0; pass < 2; pass++) {
    const rr = seeded(seed + 5)
    for (let i = 0; i < N; i++) {
      const ph = (i - N / 2) * 0.16 + 0.4
      const amp = 0.8 + rr() * 0.4
      const off = (i - N / 2) * R * 0.022
      const silver = i % 3 === 0
      const p = new Path()
      for (let k = 0; k <= 90; k++) {
        const t = k / 90
        const pt = new Point(x0 + (x1 - x0) * t, wave(t, ph, amp) + off * Math.sin(Math.PI * t))
        if (k === 0) p.move(pt); else p.addLine(pt)
      }
      ctx.addPath(p)
      if (pass === 0) { ctx.setStrokeColor(col(silver ? SILVER : GOLD, 0.05)); ctx.setLineWidth(S * 3) }
      else { ctx.setStrokeColor(col(silver ? "#ffffff" : (i % 2 ? GOLD : GOLD_HI), 0.3 + r() * 0.55)); ctx.setLineWidth(S * (0.3 + r() * 0.45)) }
      ctx.strokePath()
    }
  }
  // dust trailing to the right
  const n = Math.round(260 * (R / (40 * S)))
  for (let i = 0; i < n; i++) {
    const t = Math.pow(r(), 0.8)
    const x = x1 - R * 0.1 + t * R * dustReach
    const spread = R * (0.05 + t * 0.45)
    const y = cy + R * 0.02 - t * R * 0.12 + gauss(r) * spread
    const big = r() < 0.08
    const d = (big ? 1.4 + r() * 1.4 : 0.45 + r() * 0.9) * S * 0.5
    const a = (1 - t * 0.75) * (big ? 0.95 : 0.4 + r() * 0.5)
    const gold = r() < 0.6
    if (big) { ctx.setFillColor(col(gold ? GOLD_HI : "#ffffff", a * 0.07)); ctx.fillEllipse(new Rect(x - d * 1.6, y - d * 1.6, d * 3.2, d * 3.2)) }
    ctx.setFillColor(col(gold ? GOLD_HI : SILVER, a))
    ctx.fillEllipse(new Rect(x - d / 2, y - d / 2, d, d))
  }
}

// Dark glass sphere with gold rim light, then the strands on top.
function orb(ctx, cx, cy, R, seed, dustReach) {
  if (HD_IMG) {
    haze(ctx, cx, cy, R * 1.5, R * 1.5, "#c9a14e", 0.05, 40)
    const D = R * 2.95
    ctx.drawImageInRect(HD_IMG, new Rect(cx - D / 2, cy - D / 2, D, D))
    return
  }
  haze(ctx, cx, cy, R * 1.6, R * 1.6, "#c9a14e", 0.07, 50)
  for (let i = 40; i >= 0; i--) {
    const k = i / 40
    const shade = Math.round(9 + 15 * (1 - k))
    const hex = "#" + [shade + 2, shade, shade - 3].map(v => Math.max(0, v).toString(16).padStart(2, "0")).join("")
    const ox = -R * 0.18 * (1 - k), oy = -R * 0.22 * (1 - k)
    ctx.setFillColor(col(hex, 0.9))
    ctx.fillEllipse(new Rect(cx + ox - R * k, cy + oy - R * k, R * 2 * k, R * 2 * k))
  }
  // rim light: gold lower right, silver upper left
  const segs = 120
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1.2) / segs) * Math.PI * 2
    const goldW = Math.max(0, Math.cos(a0 - 0.8)), silW = Math.max(0, Math.cos(a0 - 3.9))
    const rr = R * 0.985
    const arc = new Path()
    arc.move(new Point(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr))
    arc.addLine(new Point(cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr))
    ctx.addPath(arc)
    if (goldW >= silW) { ctx.setStrokeColor(col(GOLD, 0.08 + goldW * 0.6)); ctx.setLineWidth(S * (0.4 + goldW * 0.9)) }
    else { ctx.setStrokeColor(col(SILVER, 0.06 + silW * 0.3)); ctx.setLineWidth(S * 0.5) }
    ctx.strokePath()
  }
  haze(ctx, cx - R * 0.35, cy - R * 0.45, R * 0.42, R * 0.26, "#ffffff", 0.10, 14)
  strands(ctx, cx, cy, R, seed, dustReach)
}

function roundedClip(ctx, w, h, rad, veilHex, veilA) {
  // darken + hairline edge
  if (veilA > 0) { ctx.setFillColor(col(veilHex, veilA)); ctx.fillRect(new Rect(0, 0, w, h)) }
  const edge = new Path()
  edge.addRoundedRect(new Rect(S * 0.5, S * 0.5, w - S, h - S), rad, rad)
  ctx.addPath(edge)
  ctx.setStrokeColor(col(GOLD, 0.28)); ctx.setLineWidth(S * 0.6); ctx.strokePath()
}

function loadClear(fam) {
  const names = []
  if (SLOT) names.push("Friday-BG-" + SLOT + ".png")
  else names.push("Friday-BG-" + fam + ".png", "Friday-Widget-Background.png")
  for (const fm of [FileManager.iCloud(), FileManager.local()]) {
    for (const n of names) {
      try {
        const p = fm.joinPath(fm.documentsDirectory(), n)
        if (fm.fileExists(p)) return { fm, p }
      } catch (e) {}
    }
  }
  return null
}

async function background(fam, size, orbSpot) {
  const w = size.width * S, h = size.height * S
  const ctx = new DrawContext()
  ctx.size = new Size(w, h)
  ctx.opaque = true
  ctx.respectScreenScale = false
  let img = null
  if (STYLE !== "solid") {
    const f = loadClear(fam)
    if (f) {
      try { if (f.fm.isFileStoredIniCloud(f.p)) await f.fm.downloadFileFromiCloud(f.p) } catch (e) {}
      img = f.fm.readImage(f.p)
    }
  }
  ctx.setFillColor(col("#08080a", 1)); ctx.fillRect(new Rect(0, 0, w, h))
  if (img) ctx.drawImageInRect(img, new Rect(0, 0, w, h))
  else {
    // obsidian base with a warm gradient
    haze(ctx, w * 0.7, h * 0.35, w * 0.9, h * 0.9, "#2a2416", 0.18, 70)
  }
  const veil = STYLE === "solid" ? 0 : STYLE === "tinted" ? 0.25 + TINT * 0.7 : (img ? 0.22 : 0.1)
  if (veil) { ctx.setFillColor(col("#0a0907", veil)); ctx.fillRect(new Rect(0, 0, w, h)) }
  dustBand(ctx, w, h, fam.length * 97 + 11, STYLE === "solid" ? 0.8 : 1)
  if (orbSpot) orb(ctx, orbSpot.x * S, orbSpot.y * S, orbSpot.r * S, 7, orbSpot.reach || 1.6)
  roundedClip(ctx, w, h, 22 * S, "#000000", 0)
  return ctx.getImage()
}

function ringBackground(wPt, hPt, R) {
  const ctx = new DrawContext()
  ctx.size = new Size(wPt * S, hPt * S)
  ctx.opaque = false
  ctx.respectScreenScale = false
  orb(ctx, wPt * S / 2, hPt * S / 2, R * S, 21, 1.4)
  return ctx.getImage()
}

function bubbleGlass(d, gold) {
  const ctx = new DrawContext()
  const D = d * S
  ctx.size = new Size(D, D)
  ctx.opaque = false
  ctx.respectScreenScale = false
  for (let i = 30; i >= 0; i--) {
    const k = i / 30
    const v = Math.round(14 + 26 * (1 - k))
    const hex = "#" + [v + 3, v + 1, v - 2].map(x => x.toString(16).padStart(2, "0")).join("")
    ctx.setFillColor(col(hex, 0.92))
    const ox = -D * 0.08 * (1 - k), oy = -D * 0.12 * (1 - k)
    ctx.fillEllipse(new Rect(D / 2 + ox - D / 2 * k, D / 2 + oy - D / 2 * k, D * k, D * k))
  }
  haze(ctx, D * 0.42, D * 0.24, D * 0.28, D * 0.13, "#ffffff", 0.06, 14)
  const ring = new Path()
  ring.addEllipse(new Rect(S * 0.5, S * 0.5, D - S, D - S))
  ctx.addPath(ring)
  ctx.setStrokeColor(col(gold ? GOLD : "#b9bcc2", gold ? 0.75 : 0.35))
  ctx.setLineWidth(S * 0.75)
  ctx.strokePath()
  return ctx.getImage()
}

// ---------- native pieces ----------
function label(stack, text, size, hex, a, weight) {
  const t = stack.addText(text)
  t.textColor = col(hex, a)
  t.font = weight === "bold" ? Font.semiboldSystemFont(size) : weight === "med" ? Font.mediumSystemFont(size) : Font.regularSystemFont(size)
  return t
}
function symbol(stack, name, size, hex) {
  const s = SFSymbol.named(name)
  if (!s) return null
  s.applyFont(Font.mediumSystemFont(size))
  const i = stack.addImage(s.image)
  i.imageSize = new Size(size, size)
  i.tintColor = col(hex, 1)
  return i
}
function talkPill(parent, w, h) {
  const p = parent.addStack()
  p.size = new Size(w, h)
  p.layoutHorizontally()
  p.centerAlignContent()
  p.backgroundColor = col("#14120e", 0.72)
  p.borderColor = col(GOLD, 0.7)
  p.borderWidth = 1
  p.cornerRadius = h / 2
  p.url = TAP_APP ? APP_URL : talkUrl()
  p.addSpacer()
  symbol(p, "mic.fill", h * 0.36, INK)
  p.addSpacer(6)
  label(p, "Talk", h * 0.42, INK, 1, "bold")
  p.addSpacer()
  return p
}
function wxLine(stack, wx, size) {
  if (!wx) { label(stack, "Weather unavailable", size, INK, 0.6); return }
  symbol(stack, wx.sym, size, GOLD_HI)
  stack.addSpacer(4)
  label(stack, wx.temp + "° " + wx.text + "  ·  H " + wx.hi + "°  L " + wx.lo + "°", size, INK, 0.82, "med")
}

const BUBBLES = [
  { k: "Lights", sym: "lightbulb", gold: true, url: talkUrl("lights on") },
  { k: "TV", sym: "tv", gold: false, url: talkUrl("tv on") },
  { k: "Timer", sym: "timer", gold: true, url: talkUrl("10 minute timer") },
  { k: "Alarm", sym: "alarm", gold: false, url: talkUrl("set an alarm") },
  { k: "Music", sym: "music.note", gold: true, url: talkUrl("music") },
  { k: "Notes", sym: "note.text", gold: false, url: "mobilenotes://" }
]
function bubble(parent, b, d) {
  const s = parent.addStack()
  s.size = new Size(d, d)
  s.cornerRadius = d / 2
  s.backgroundImage = bubbleGlass(d, b.gold)
  s.layoutVertically()
  s.url = b.url
  s.addSpacer()
  const r1 = s.addStack(); r1.addSpacer(); symbol(r1, b.sym, d * 0.34, b.gold ? GOLD_HI : INK); r1.addSpacer()
  s.addSpacer(2)
  const r2 = s.addStack(); r2.addSpacer(); label(r2, b.k, d * 0.15, b.gold ? GOLD_HI : INK, 0.9, "med"); r2.addSpacer()
  s.addSpacer()
  return s
}

// ---------- layouts ----------
async function build() {
  if (!CLASSIC) HD_IMG = await hdOrb(ORB_LOOK)
  const w = new ListWidget()
  const size = widgetSize(FAMILY)
  const W = size.width, H = size.height
  w.url = TAP
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000)
  const day = new Date().toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()

  if (FAMILY === "small") {
    w.backgroundImage = await background("small", size, { x: W / 2, y: H * 0.46, r: H * 0.24, reach: 1.3 })
    w.setPadding(12, 14, 12, 14)
    label(w, ASSISTANT.toUpperCase(), 9, INK, 0.6, "bold")
    w.addSpacer()
    const row = w.addStack(); row.addSpacer(); talkPill(row, W * 0.68, 28); row.addSpacer()
    return w
  }

  const wx = await weather()

  if (FAMILY === "medium") {
    w.backgroundImage = await background("medium", size, { x: W - H * 0.48, y: H * 0.5, r: H * 0.3, reach: 1.1 })
    w.setPadding(14, 16, 14, 16)
    const colm = w.addStack(); colm.layoutVertically(); colm.size = new Size(W * 0.56, 0)
    label(colm, ASSISTANT.toUpperCase() + "  ·  " + day, 9, INK, 0.6, "bold")
    colm.addSpacer(6)
    const g = label(colm, greeting(), 19, INK, 1, "bold"); g.lineLimit = 2; g.minimumScaleFactor = 0.7
    colm.addSpacer(4)
    const wr = colm.addStack(); wr.centerAlignContent(); wxLine(wr, wx, 11)
    colm.addSpacer()
    talkPill(colm, 104, 30)
    return w
  }

  // large
  w.backgroundImage = await background("large", size, null)
  w.setPadding(14, 16, 14, 16)
  const head = w.addStack(); head.centerAlignContent()
  label(head, ASSISTANT.toUpperCase(), 9, INK, 0.6, "bold")
  head.addSpacer()
  if (wx) { symbol(head, wx.sym, 12, GOLD_HI); head.addSpacer(4); label(head, wx.temp + "°", 12, INK, 0.9, "med") }

  w.addSpacer()
  const d = Math.round(Math.min(58, H * 0.155))
  const R = Math.round(d * 1.5)
  const dx = Math.round(R * 0.866), dy = Math.round(R * 0.5)
  const ringW = dx * 2 + d, ringH = R * 2 + d
  const holder = w.addStack(); holder.addSpacer()
  const ring = holder.addStack()
  ring.size = new Size(ringW, ringH)
  ring.backgroundImage = ringBackground(ringW, ringH, d * 0.72)
  ring.layoutHorizontally()
  holder.addSpacer()
  const colA = ring.addStack(); colA.layoutVertically(); colA.size = new Size(d, ringH)
  ring.addSpacer(dx - d)
  const colB = ring.addStack(); colB.layoutVertically(); colB.size = new Size(d, ringH)
  ring.addSpacer(dx - d)
  const colC = ring.addStack(); colC.layoutVertically(); colC.size = new Size(d, ringH)
  const side = (c, top, bot) => { c.addSpacer(R - dy); bubble(c, top, d); c.addSpacer(dy * 2 - d); bubble(c, bot, d); c.addSpacer(R - dy) }
  side(colA, BUBBLES[5], BUBBLES[4])          // Notes, Music
  bubble(colB, BUBBLES[0], d)                 // Lights
  const mid = colB.addStack(); mid.size = new Size(d, R * 2 - d); mid.url = talkUrl()
  bubble(colB, BUBBLES[3], d)                 // Alarm
  side(colC, BUBBLES[1], BUBBLES[2])          // TV, Timer

  w.addSpacer()
  const foot = w.addStack(); foot.centerAlignContent()
  const g = label(foot, greeting(), 11, INK, 0.75, "med"); g.lineLimit = 1
  foot.addSpacer()
  talkPill(foot, 86, 30)
  return w
}

const widget = await build()
if (config.runsInWidget) Script.setWidget(widget)
else if (FAMILY === "small") await widget.presentSmall()
else if (FAMILY === "medium") await widget.presentMedium()
else await widget.presentLarge()
Script.complete()

})().catch((e) => { console.error(e); Script.complete(); });
