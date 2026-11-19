const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const profile = process.env.FRIDAY_PROFILE === "batsie" ? "batsie" : "sky";

const entries = [
  "index.html", "config.js", "manifest.webmanifest", "sw.js",
  "apple-touch-icon.png", "make_profile.html", "css", "js", "icons",
  "profiles", "scriptable", "friday-sky", "friday-batsie"
];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const entry of entries) {
  const source = path.join(root, entry);
  if (fs.existsSync(source)) {
    fs.cpSync(source, path.join(out, entry), { recursive: true });
  }
}

const indexPath = path.join(out, "index.html");
let html = fs.readFileSync(indexPath, "utf8");
const configTag = '<script src="config.js"></script>';
if (!html.includes(configTag)) {
  throw new Error("Could not find the config.js script tag in index.html");
}
html = html.replace(
  configTag,
  '<script>window.FRIDAY_BAKED_PROFILE = "' + profile + '";</script>\n  ' + configTag
);
fs.writeFileSync(indexPath, html, "utf8");

console.log("Prepared " + profile + " native web bundle in www/");
