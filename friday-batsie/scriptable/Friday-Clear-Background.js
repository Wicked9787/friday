void (async function () {
// Friday Clear Background helper (Scriptable)
// Standard Scriptable approach for a transparent-looking widget:
// 1. Go to the Home Screen, then take a screenshot (no widgets needed, just your wallpaper).
// 2. Run this script in Scriptable and pick that screenshot.
// 3. It crops the widget area and saves Friday-Widget-Background.png in iCloud/Scriptable.
// 4. The Friday-Widget.js script uses that file when the widget parameter is "clear".
//
// Change PHONE if the crop feels off (different iPhone models vary slightly).
// No API keys.

const OUT_NAME = "Friday-Widget-Background.png"

// Crop insets are a starting point for a modern iPhone with a Home Screen of 4x6 icons.
// If the crop is a little off, run again after changing these numbers (in points).
const PRESETS = {
  small:  { w: 158, h: 158 },
  medium: { w: 338, h: 158 },
  large:  { w: 338, h: 354 }
}

const family = await pickFamily()
if (family) {
  const shot = await Photos.fromLibrary()
  if (shot) {
    const pos = await pickPosition(family)
    const crop = cropWidget(shot, family, pos)
    const fm = FileManager.iCloud()
    const path = fm.joinPath(fm.documentsDirectory(), OUT_NAME)
    fm.writeImage(path, crop)
    await fm.downloadFileFromiCloud(path)
    const preview = new Alert()
    preview.title = "Saved " + OUT_NAME
    preview.message = "Add or edit the Friday widget, set the parameter to clear, and it will use this background."
    preview.addAction("OK")
    await preview.present()
  }
}
Script.complete()

async function pickFamily() {
  const a = new Alert()
  a.title = "Which widget size?"
  a.message = "Crop a wallpaper screenshot for the clear Friday widget."
  a.addAction("Small")
  a.addAction("Medium")
  a.addAction("Large")
  a.addCancelAction("Cancel")
  const i = await a.present()
  if (i === 0) return "small"
  if (i === 1) return "medium"
  if (i === 2) return "large"
  return null
}

async function pickPosition(family) {
  const a = new Alert()
  a.title = "Where will the widget sit?"
  a.message = "This is an approximate crop of a standard Home Screen grid."
  if (family === "large") {
    a.addAction("Top")
    a.addAction("Bottom")
    const i = await a.present()
    return i === 1 ? "bottom" : "top"
  }
  a.addAction("Top left")
  a.addAction("Top right")
  a.addAction("Middle left")
  a.addAction("Middle right")
  a.addAction("Bottom left")
  a.addAction("Bottom right")
  const i = await a.present()
  const names = ["tl", "tr", "ml", "mr", "bl", "br"]
  return names[Math.max(0, i)] || "tl"
}

function cropWidget(img, family, pos) {
  const w = img.size.width
  const h = img.size.height
  // Assume the screenshot is the full phone screen. Widget sizes scale with screen width.
  const scale = w / 390 // reference width (iPhone 13/14 logical points)
  const box = PRESETS[family]
  const ww = box.w * scale
  const hh = box.h * scale
  const leftPad = 26 * scale
  const topPad = 86 * scale
  const gapX = 19 * scale
  const gapY = 19 * scale
  let col = 0, row = 0
  if (pos === "tr" || pos === "mr" || pos === "br") col = 1
  if (pos === "ml" || pos === "mr") row = 1
  if (pos === "bl" || pos === "br") row = 2
  if (pos === "bottom") row = 1
  if (pos === "top") row = 0
  // Large widgets span both columns.
  const x = leftPad + (family === "large" ? 0 : col * (PRESETS.small.w * scale + gapX))
  const y = topPad + row * (PRESETS.small.h * scale + gapY)
  const ctx = new DrawContext()
  ctx.size = new Size(ww, hh)
  ctx.opaque = true
  ctx.respectScreenScale = true
  ctx.drawImageAtPoint(img, new Point(-x, -y))
  return ctx.getImage()
}

})().catch((e) => { console.error(e); Script.complete(); });
