void (async function () {
// Friday Lock Screen widget (Scriptable)
// Supports accessoryCircular, accessoryRectangular, and accessoryInline.
// Change SITE_URL if the GitHub Pages address changes.
// No API keys.

const SITE_URL = "https://wicked9787.github.io/friday/?u=batsie"
const ASSISTANT_NAME = "Friday"

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  if (h < 22) return "Good evening"
  return "Good night"
}

function timeStr() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

function drawMiniOrb(size) {
  const ctx = new DrawContext()
  ctx.size = new Size(size, size)
  ctx.opaque = false
  ctx.respectScreenScale = true
  const c = new Point(size / 2, size / 2)
  const r = size * 0.40
  const body = new Path()
  body.addEllipse(new Rect(c.x - r, c.y - r, r * 2, r * 2))
  ctx.setFillColor(Color.black())
  ctx.addPath(body)
  ctx.fillPath()
  ctx.setFillColor(new Color("#ffffff", 0.55))
  ctx.fillEllipse(new Rect(c.x - r * 0.4, c.y - r * 0.45, r * 0.22, r * 0.26))
  ctx.setFillColor(new Color("#e8c872", 0.9))
  for (let a = 0.4; a < 1.1; a += 0.08) {
    const x = c.x + Math.cos(a) * r * 0.96
    const y = c.y + Math.sin(a) * r * 0.96
    ctx.fillEllipse(new Rect(x - 1.1, y - 1.1, 2.2, 2.2))
  }
  return ctx.getImage()
}

const fam = config.widgetFamily || "accessoryCircular"
const widget = new ListWidget()
widget.url = SITE_URL

if (fam === "accessoryInline") {
  const t = widget.addText(ASSISTANT_NAME + " · " + timeStr())
  t.font = Font.mediumSystemFont(12)
} else if (fam === "accessoryRectangular") {
  const row = widget.addStack()
  row.centerAlignContent()
  const img = row.addImage(drawMiniOrb(64))
  img.imageSize = new Size(28, 28)
  row.addSpacer(6)
  const col = row.addStack()
  col.layoutVertically()
  const a = col.addText(ASSISTANT_NAME)
  a.font = Font.semiboldSystemFont(13)
  const b = col.addText(greeting())
  b.font = Font.regularSystemFont(12)
} else {
  // accessoryCircular / accessoryCircular
  const img = widget.addImage(drawMiniOrb(120))
  img.imageSize = new Size(52, 52)
  img.centerAlignImage()
}

if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  await widget.presentAccessoryCircular()
}
Script.complete()

})().catch((e) => { console.error(e); Script.complete(); });
