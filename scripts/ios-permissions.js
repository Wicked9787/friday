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
fs.writeFileSync(plist, xml);
console.log("Added mic permission to Info.plist");
