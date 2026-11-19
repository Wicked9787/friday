void (async function () {
// Friday Home Screen widget (Scriptable)
// Small, medium, and large.
// Widget parameter: clear  |  tinted  |  solid
// Change SITE_URL if the GitHub Pages address changes.
// No API keys.

const SITE_URL = "https://wicked9787.github.io/friday/?u=sky"
const ASSISTANT_NAME = "Friday"
const OWNER_NAME = "Sky"
// Optional wallpaper crop from Friday-Clear-Background.js, used when style is "clear".
const BG_FILE = "Friday-Widget-Background.png"

const param = ((args.widgetParameter || "").trim().toLowerCase())
const STYLE = (param === "tinted" || param === "solid" || param === "clear") ? param : "clear"

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return "Still up, " + OWNER_NAME + "?"
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  if (h < 22) return "Good evening"
  return "Good night"
}

function timeStr() {
  const d = new Date()
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

function dateStr() {
  const d = new Date()
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
}

async function batteryLine() {
  try {
    const level = Math.round(Device.batteryLevel() * 100)
    const ch = Device.isCharging() ? " · charging" : ""
    return level + "%" + ch
  } catch (e) {
    return ""
  }
}

function drawOrb(size) {
  const ctx = new DrawContext()
  ctx.size = new Size(size, size)
  ctx.opaque = false
  ctx.respectScreenScale = true
  const c = new Point(size / 2, size / 2)
  const r = size * 0.42

  // Soft gold/silver halo
  for (let i = 6; i >= 1; i--) {
    const p = new Path()
    p.addEllipse(new Rect(c.x - r * (1 + i * 0.08), c.y - r * (1 + i * 0.08), r * 2 * (1 + i * 0.08), r * 2 * (1 + i * 0.08)))
    ctx.setFillColor(new Color("#e8c872", 0.015 * i))
    ctx.addPath(p)
    ctx.fillPath()
  }

  // Black glass body
  const body = new Path()
  body.addEllipse(new Rect(c.x - r, c.y - r, r * 2, r * 2))
  ctx.setFillColor(new Color("#050506", 0.96))
  ctx.addPath(body)
  ctx.fillPath()

  // Upper-left sheen
  const sheen = new Path()
  sheen.addEllipse(new Rect(c.x - r * 0.7, c.y - r * 0.75, r * 0.9, r * 0.7))
  ctx.setFillColor(new Color("#d8dee8", 0.10))
  ctx.addPath(sheen)
  ctx.fillPath()

  // Specular hotspot
  const spec = new Path()
  spec.addEllipse(new Rect(c.x - r * 0.42, c.y - r * 0.48, r * 0.22, r * 0.28))
  ctx.setFillColor(new Color("#ffffff", 0.55))
  ctx.addPath(spec)
  ctx.fillPath()

  // Gold lower-right rim kiss — approximate with a thin arc of dots
  ctx.setFillColor(new Color("#e8c872", 0.85))
  for (let a = 0.15; a < 1.15; a += 0.04) {
    const ang = a + 0.35
    const rr = r * 0.97
    const x = c.x + Math.cos(ang) * rr
    const y = c.y + Math.sin(ang) * rr
    const d = 1.6 + (a > 0.5 && a < 0.85 ? 1.4 : 0)
    ctx.fillEllipse(new Rect(x - d / 2, y - d / 2, d, d))
  }
  ctx.setFillColor(new Color("#c8d0dc", 0.7))
  for (let a = 3.2; a < 4.2; a += 0.05) {
    const rr = r * 0.97
    const x = c.x + Math.cos(a) * rr
    const y = c.y + Math.sin(a) * rr
    ctx.fillEllipse(new Rect(x - 0.8, y - 0.8, 1.6, 1.6))
  }
  return ctx.getImage()
}

async function clearBackground(widget, w, h) {
  try {
    const fm = FileManager.iCloud()
    const path = fm.joinPath(fm.documentsDirectory(), BG_FILE)
    if (fm.fileExists(path)) {
      if (fm.isFileStoredIniCloud(path)) await fm.downloadFileFromiCloud(path)
      widget.backgroundImage = fm.readImage(path)
      return true
    }
  } catch (e) {}
  try {
    const fm = FileManager.local()
    const path = fm.joinPath(fm.documentsDirectory(), BG_FILE)
    if (fm.fileExists(path)) {
      widget.backgroundImage = fm.readImage(path)
      return true
    }
  } catch (e) {}
  return false
}

async function build() {
  const widget = new ListWidget()
  const size = config.widgetFamily || "small"
  widget.url = SITE_URL
  widget.setPadding(12, 14, 12, 14)

  if (STYLE === "solid") {
    widget.backgroundColor = new Color("#000000", 1)
  } else if (STYLE === "tinted") {
    widget.backgroundColor = new Color("#0a0a0c", 0.72)
  } else {
    const ok = await clearBackground(widget)
    if (!ok) widget.backgroundColor = new Color("#000000", 0.18)
  }

  const gold = new Color("#e8c872")
  const ink = new Color("#efece8")
  const muted = new Color("#efece8", 0.55)

  if (size === "small") {
    const orb = widget.addImage(drawOrb(240))
    orb.imageSize = new Size(58, 58)
    orb.centerAlignImage()
    widget.addSpacer(8)
    const t = widget.addText(ASSISTANT_NAME.toLowerCase())
    t.textColor = muted
    t.font = Font.semiboldSystemFont(11)
    t.centerAlignText()
    const g = widget.addText(greeting())
    g.textColor = ink
    g.font = Font.mediumSystemFont(13)
    g.centerAlignText()
    g.lineLimit = 2
  } else {
    const row = widget.addStack()
    row.layoutHorizontally()
    row.centerAlignContent()
    const orb = row.addImage(drawOrb(280))
    orb.imageSize = new Size(size === "large" ? 84 : 68, size === "large" ? 84 : 68)
    row.addSpacer(12)
    const col = row.addStack()
    col.layoutVertically()
    const name = col.addText(ASSISTANT_NAME.toLowerCase())
    name.textColor = muted
    name.font = Font.semiboldSystemFont(12)
    const greet = col.addText(greeting())
    greet.textColor = ink
    greet.font = Font.mediumSystemFont(16)
    greet.lineLimit = 2
    col.addSpacer(4)
    const tm = col.addText(timeStr())
    tm.textColor = gold
    tm.font = Font.lightSystemFont(size === "large" ? 28 : 22)
    const dt = col.addText(dateStr())
    dt.textColor = muted
    dt.font = Font.regularSystemFont(12)
    widget.addSpacer()
    const bat = await batteryLine()
    const foot = widget.addText(bat ? ("Battery " + bat) : "Tap to open Friday")
    foot.textColor = muted
    foot.font = Font.regularSystemFont(11)
  }

  return widget
}

const widget = await build()
if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  const fam = config.widgetFamily || "medium"
  if (fam === "small") await widget.presentSmall()
  else if (fam === "large") await widget.presentLarge()
  else await widget.presentMedium()
}
Script.complete()

})().catch((e) => { console.error(e); Script.complete(); });
