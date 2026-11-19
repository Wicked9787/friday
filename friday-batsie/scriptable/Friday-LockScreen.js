void (async function () {
// Jarvis Lock Screen widget for Scriptable: Concept 28 "Obsidian".
// Circular, rectangular, or inline. iOS shows Lock Screen widgets in one tint,
// so the gold reads as bright strands.
//
// Widget Parameter for a circular slot (optional):
//   orb      the Friday orb, tap to talk (default)
//   weather  temperature with the weather symbol
//   alarm    alarm bell, tap to ask for an alarm
// No API keys in this script.

// ---- Profile ----
const ASSISTANT = "Jarvis"
const SHORTCUT = "Jarvis"
const TERM = "ma'am"
const SITE_URL = "https://wicked9787.github.io/friday/?u=batsie"
// -----------------

const FALLBACK = { lat: 36.6, lon: -83.66 }
const S = 3
const MODE = ((args.widgetParameter || "").trim().toLowerCase().split(/\s+/)[0]) || "orb"
const FAMILY = config.widgetFamily || "accessoryCircular"

function talkUrl(text) {
  let u = "shortcuts://run-shortcut?name=" + encodeURIComponent(SHORTCUT)
  if (text) u += "&input=text&text=" + encodeURIComponent(text)
  return u
}
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }
function gauss(r) { return (r() + r() + r() - 1.5) / 1.5 }
function greeting() {
  const h = new Date().getHours()
  return (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 22 ? "Good evening" : "Good night") + ", " + TERM + "."
}

async function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => Timer.schedule(ms, false, () => rej(new Error("timeout"))))])
}
const SYM = c => c <= 1 ? "sun.max.fill" : c === 2 ? "cloud.sun.fill" : c === 3 ? "cloud.fill" : c < 50 ? "cloud.fog.fill" :
  c < 60 ? "cloud.drizzle.fill" : c < 70 ? "cloud.rain.fill" : c < 80 ? "cloud.snow.fill" : c < 90 ? "cloud.rain.fill" : "cloud.bolt.rain.fill"
async function weather() {
  const fm = FileManager.local()
  const cache = fm.joinPath(fm.cacheDirectory(), "friday-lock-weather.json")
  let old = null
  try { if (fm.fileExists(cache)) old = JSON.parse(fm.readString(cache)) } catch (e) {}
  if (old && Date.now() - old.at < 20 * 60 * 1000) return old
  let lat = FALLBACK.lat, lon = FALLBACK.lon
  try { Location.setAccuracyToThreeKilometers(); const l = await withTimeout(Location.current(), 4000); lat = l.latitude; lon = l.longitude } catch (e) {}
  try {
    const r = new Request("https://api.open-meteo.com/v1/forecast?latitude=" + lat.toFixed(3) + "&longitude=" + lon.toFixed(3) +
      "&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit&timezone=auto")
    r.timeoutInterval = 8
    const j = await r.loadJSON()
    let sym = SYM(j.current.weather_code)
    if (!j.current.is_day && sym === "sun.max.fill") sym = "moon.stars.fill"
    const out = { at: Date.now(), temp: Math.round(j.current.temperature_2m), sym }
    fm.writeString(cache, JSON.stringify(out))
    return out
  } catch (e) { return old }
}

// Mini orb: dark glass, bright rim on one side, ribbon strands and dust.
function miniOrb(pt) {
  const ctx = new DrawContext()
  const D = pt * S, c = D / 2, R = D * 0.44
  ctx.size = new Size(D, D)
  ctx.opaque = false
  ctx.respectScreenScale = false
  const r = seeded(9)
  ctx.setFillColor(new Color("#000000", 0.55))
  ctx.fillEllipse(new Rect(c - R, c - R, R * 2, R * 2))
  for (let i = 0; i < 100; i++) {
    const a0 = (i / 100) * Math.PI * 2, a1 = ((i + 1.2) / 100) * Math.PI * 2
    const w = Math.max(0, Math.cos(a0 - 0.8))
    if (w < 0.05) continue
    const p = new Path()
    p.move(new Point(c + Math.cos(a0) * R, c + Math.sin(a0) * R)); p.addLine(new Point(c + Math.cos(a1) * R, c + Math.sin(a1) * R))
    ctx.addPath(p); ctx.setStrokeColor(new Color("#ffffff", 0.15 + w * 0.75)); ctx.setLineWidth(S * (0.4 + w * 0.9)); ctx.strokePath()
  }
  const x0 = c - R * 0.78, x1 = c + R * 0.1
  for (let i = 0; i < 12; i++) {
    const ph = (i - 6) * 0.16 + 0.4, amp = 0.8 + r() * 0.4, off = (i - 6) * R * 0.022
    const p = new Path()
    for (let k = 0; k <= 60; k++) {
      const t = k / 60
      const env = Math.pow(Math.sin(Math.PI * t), 0.7) * (0.5 + 0.5 * t)
      const v = Math.exp(-Math.pow((t - 0.5) / 0.14, 2))
      const y = c + R * amp * (env * Math.sin(t * Math.PI * 3.2 + ph) * 0.3 + v * 0.1 * Math.sin(t * Math.PI * 6 + ph * 0.5)) + off * Math.sin(Math.PI * t)
      const pt2 = new Point(x0 + (x1 - x0) * t, y)
      if (k === 0) p.move(pt2); else p.addLine(pt2)
    }
    ctx.addPath(p); ctx.setStrokeColor(new Color("#ffffff", 0.45 + r() * 0.5)); ctx.setLineWidth(S * (0.35 + r() * 0.4)); ctx.strokePath()
  }
  for (let i = 0; i < 70; i++) {
    const t = Math.pow(r(), 0.8)
    const x = x1 - R * 0.1 + t * R * 0.85, y = c - t * R * 0.1 + gauss(r) * R * (0.05 + t * 0.35)
    const d = (r() < 0.1 ? 1.6 : 0.6 + r() * 0.7) * S * 0.5
    ctx.setFillColor(new Color("#ffffff", (1 - t * 0.6) * (0.4 + r() * 0.5)))
    ctx.fillEllipse(new Rect(x - d / 2, y - d / 2, d, d))
  }
  return ctx.getImage()
}

function sym(stack, name, size) {
  const s = SFSymbol.named(name); if (!s) return
  s.applyFont(Font.mediumSystemFont(size))
  const i = stack.addImage(s.image); i.imageSize = new Size(size, size); i.tintColor = Color.white()
}
function centered(stack, fn) { const r = stack.addStack(); r.addSpacer(); fn(r); r.addSpacer(); return r }

const widget = new ListWidget()
widget.url = talkUrl()
widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000)

if (FAMILY === "accessoryInline") {
  const wx = await weather()
  const t = widget.addText(ASSISTANT + (wx ? "  " + wx.temp + "°" : ""))
  t.font = Font.mediumSystemFont(12)
} else if (FAMILY === "accessoryRectangular") {
  const wx = await weather()
  const row = widget.addStack(); row.centerAlignContent()
  const img = row.addImage(miniOrb(44)); img.imageSize = new Size(44, 44)
  row.addSpacer(6)
  const colm = row.addStack(); colm.layoutVertically()
  const a = colm.addText(ASSISTANT.toUpperCase()); a.font = Font.semiboldSystemFont(10); a.textOpacity = 0.7
  const b = colm.addText(greeting()); b.font = Font.semiboldSystemFont(13); b.lineLimit = 1; b.minimumScaleFactor = 0.7
  if (wx) {
    const w = colm.addStack(); w.centerAlignContent(); sym(w, wx.sym, 11); w.addSpacer(3)
    const tt = w.addText(wx.temp + "°  ·  Tap to talk"); tt.font = Font.mediumSystemFont(11); tt.textOpacity = 0.8
  }
  row.addSpacer()
} else {
  widget.addAccessoryWidgetBackground = true
  if (MODE === "weather") {
    widget.url = talkUrl("weather")
    const wx = await weather()
    widget.addSpacer()
    centered(widget, r => sym(r, wx ? wx.sym : "cloud.fill", 18))
    widget.addSpacer(1)
    centered(widget, r => { const t = r.addText(wx ? wx.temp + "°" : "--"); t.font = Font.semiboldSystemFont(15) })
    widget.addSpacer()
  } else if (MODE === "alarm") {
    widget.url = talkUrl("set an alarm")
    widget.addSpacer()
    centered(widget, r => sym(r, "alarm", 26))
    widget.addSpacer()
  } else {
    widget.addAccessoryWidgetBackground = false
    widget.setPadding(0, 0, 0, 0)
    widget.addSpacer()
    centered(widget, r => { const i = r.addImage(miniOrb(76)); i.imageSize = new Size(72, 72) })
    widget.addSpacer()
  }
}

if (config.runsInWidget) Script.setWidget(widget)
else if (FAMILY === "accessoryRectangular") await widget.presentAccessoryRectangular()
else if (FAMILY === "accessoryInline") await widget.presentAccessoryInline()
else await widget.presentAccessoryCircular()
Script.complete()

})().catch((e) => { console.error(e); Script.complete(); });
