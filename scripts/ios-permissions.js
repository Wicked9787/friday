// Runs after `cap sync`: adds mic permission text to the iOS Info.plist
// so WKWebView exposes navigator.mediaDevices.getUserMedia.
const fs = require("fs");
const path = require("path");
const plist = path.join(__dirname, "..", "ios", "App", "App", "Info.plist");
if (!fs.existsSync(plist)) { console.log("No iOS Info.plist yet, skipping"); process.exit(0); }
let xml = fs.readFileSync(plist, "utf8");
const name = process.env.FRIDAY_PROFILE === "batsie" ? "Jarvis" : "Friday";
const keys = {
  NSMicrophoneUsageDescription: `${name} uses the microphone so you can talk to it.`,
  NSSpeechRecognitionUsageDescription: `${name} turns your voice into text.`
};
for (const [k, v] of Object.entries(keys)) {
  if (xml.includes(`<key>${k}</key>`)) continue;
  const i = xml.lastIndexOf("</dict>");
  xml = xml.slice(0, i) + `\t<key>${k}</key>\n\t<string>${v}</string>\n` + xml.slice(i);
}
const scheme = name.toLowerCase();
if (!xml.includes("<key>CFBundleURLTypes</key>")) {
  const i = xml.lastIndexOf("</dict>");
  xml = xml.slice(0, i) + `\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>${scheme}</string>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>${scheme}</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n` + xml.slice(i);
}
// App version shown in AltStore and Settings (from package.json "appVersion").
const pkg = require(path.join(__dirname, "..", "package.json"));
const ver = String(pkg.appVersion || "1.0");
xml = xml.replace(/(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${ver}$2`);
xml = xml.replace(/(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${ver}$2`);
fs.writeFileSync(plist, xml);
console.log("Added mic permission and version " + ver + " to Info.plist");

// App icon: copy the Friday/Jarvis art into the Xcode asset catalog
// (single 1024x1024 universal icon, opaque, which Xcode 16+ accepts).
const iconSrc = path.join(__dirname, "..", "icons", "appicon-1024.png");
const iconDir = path.join(__dirname, "..", "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset");
if (fs.existsSync(iconSrc)) {
  fs.mkdirSync(iconDir, { recursive: true });
  for (const f of fs.readdirSync(iconDir)) {
    if (/\.png$/i.test(f)) fs.rmSync(path.join(iconDir, f));
  }
  fs.copyFileSync(iconSrc, path.join(iconDir, "AppIcon-1024.png"));
  fs.writeFileSync(path.join(iconDir, "Contents.json"), JSON.stringify({
    images: [{ filename: "AppIcon-1024.png", idiom: "universal", platform: "ios", size: "1024x1024" }],
    info: { author: "xcode", version: 1 }
  }, null, 2));
  console.log("Installed " + name + " app icon");
} else {
  console.log("No icons/appicon-1024.png, keeping the default icon");
}
