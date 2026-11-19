void (async function () {
// Friday Clear Background helper for Scriptable.
// Makes the Friday widget look see-through by cutting the exact spot
// out of a screenshot of your Home Screen wallpaper.
//
// 1. On the Home Screen, press and hold an empty spot until the icons wiggle.
// 2. Swipe to the last, empty page and take a screenshot.
// 3. Run this script, pick the size and spot, then pick that screenshot.
// 4. It saves the crop and tells you what to type in the widget's Parameter.
// Run it once for each widget you place. No API keys.

const ASSISTANT = "Friday"

// Pixel positions of widget slots on each iPhone screen height.
const PHONES = {
  2868: { small: 520, medium: 1114, large: 1162, left: 93, right: 689, top: 300, middle: 942, bottom: 1584 },
  2796: { small: 510, medium: 1092, large: 1146, left: 99, right: 681, top: 282, middle: 918, bottom: 1554 },
  2778: { small: 510, medium: 1092, large: 1146, left: 96, right: 678, top: 246, middle: 882, bottom: 1518 },
  2688: { small: 507, medium: 1080, large: 1137, left: 81, right: 654, top: 228, middle: 858, bottom: 1488 },
  2622: { small: 492, medium: 1047, large: 1101, left: 81, right: 636, top: 276, middle: 882, bottom: 1488 },
  2556: { small: 474, medium: 1017, large: 1062, left: 82, right: 622, top: 270, middle: 858, bottom: 1446 },
  2532: { small: 474, medium: 1014, large: 1062, left: 78, right: 618, top: 231, middle: 819, bottom: 1407 },
  2436: { small: 465, medium: 987, large: 1035, left: 69, right: 591, top: 213, middle: 783, bottom: 1353 },
  2208: { small: 471, medium: 1044, large: 1071, left: 99, right: 672, top: 114, middle: 696, bottom: 1278 },
  1792: { small: 338, medium: 720, large: 758, left: 54, right: 436, top: 160, middle: 580, bottom: 1000 },
  1624: { small: 310, medium: 658, large: 690, left: 46, right: 394, top: 142, middle: 522, bottom: 902 },
  1334: { small: 296, medium: 642, large: 648, left: 54, right: 400, top: 60, middle: 412, bottom: 764 }
}

async function choose(title, msg, options) {
  const a = new Alert()
  a.title = title
  a.message = msg
  options.forEach(o => a.addAction(o))
  a.addCancelAction("Cancel")
  const i = await a.present()
  return i < 0 ? null : i
}

const fi = await choose("Which widget size?", "Pick the size of the " + ASSISTANT + " widget you are placing.", ["Small", "Medium", "Large"])
if (fi === null) { Script.complete(); return }
const family = ["small", "medium", "large"][fi]

let spots, keys
if (family === "small") {
  spots = ["Top left", "Top right", "Middle left", "Middle right", "Bottom left", "Bottom right"]
  keys = ["tl", "tr", "ml", "mr", "bl", "br"]
} else if (family === "medium") {
  spots = ["Top", "Middle", "Bottom"]; keys = ["top", "middle", "bottom"]
} else {
  spots = ["Top", "Bottom"]; keys = ["top", "bottom"]
}
const si = await choose("Where does it sit?", "Pick the spot on your Home Screen.", spots)
if (si === null) { Script.complete(); return }
const spot = keys[si]

const shot = await Photos.fromLibrary()
if (!shot) { Script.complete(); return }

const H = Math.round(shot.size.height), Wd = Math.round(shot.size.width)
let p = PHONES[H]
if (!p) {
  // Unknown phone: scale from the closest known screen.
  const near = Object.keys(PHONES).map(Number).sort((a, b) => Math.abs(a - H) - Math.abs(b - H))[0]
  const k = H / near
  p = {}
  for (const key in PHONES[near]) p[key] = Math.round(PHONES[near][key] * k)
  const warn = new Alert()
  warn.title = "Close match"
  warn.message = "Your phone isn't in my list, so the crop is estimated. If it looks a little off, that's why."
  warn.addAction("OK")
  await warn.present()
}

const w = family === "small" ? p.small : p.medium
const h = family === "large" ? p.large : p.small
const x = family === "small" && spot.endsWith("r") ? p.right : p.left
let y
if (family === "small") y = spot.startsWith("t") ? p.top : spot.startsWith("m") ? p.middle : p.bottom
else if (family === "medium") y = p[spot]
else y = spot === "top" ? p.top : p.middle

const ctx = new DrawContext()
ctx.size = new Size(w, h)
ctx.opaque = true
ctx.respectScreenScale = false
ctx.drawImageAtPoint(shot, new Point(-x, -y))
const crop = ctx.getImage()

const slot = family + "-" + spot
const name = "Friday-BG-" + slot + ".png"
const fm = FileManager.iCloud()
const path = fm.joinPath(fm.documentsDirectory(), name)
fm.writeImage(path, crop)
// Keep the old single-file name too, so a widget with no position word still works.
fm.writeImage(fm.joinPath(fm.documentsDirectory(), "Friday-BG-" + family + ".png"), crop)

Pasteboard.copy("clear " + slot)
const done = new Alert()
done.title = "Saved"
done.message = "Press the " + ASSISTANT + " widget, tap Edit Widget, and in Parameter type:\n\nclear " + slot + "\n\n(It's already copied, so you can just paste.)"
done.addAction("OK")
await done.present()
Script.complete()

})().catch((e) => { console.error(e); Script.complete(); });
