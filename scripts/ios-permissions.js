// Runs after `cap sync`: adds mic permission text to the iOS Info.plist
// so WKWebView exposes navigator.mediaDevices.getUserMedia.
const fs = require("fs");
const path = require("path");
const plist = path.join(__dirname, "..", "ios", "App", "App", "Info.plist");
if (!fs.existsSync(plist)) { console.log("No iOS Info.plist yet, skipping"); process.exit(0); }
let xml = fs.readFileSync(plist, "utf8");
const name = process.env.FRIDAY_PROFILE === "batsie" ? "Reed" : "Friday";
// 3.5.1: Jarvis is now Reed, but his app keeps answering jarvis:// so older links, NFC stickers and automations work.
const schemes = process.env.FRIDAY_PROFILE === "batsie" ? ["jarvis", "reed"] : ["friday"];
const keys = {
  NSMicrophoneUsageDescription: `${name} uses the microphone so you can talk to it.`,
  NSFaceIDUsageDescription: `${name} uses Face ID to protect access to the native interface when you enable app lock.`,
  NSSpeechRecognitionUsageDescription: `${name} uses speech recognition to show your words as you talk and know when you are done.`,
  NSContactsUsageDescription: `${name} reads contact names and numbers so texts and calls go to the right person. They stay on this phone.`,
  NSAppleMusicUsageDescription: `${name} plays, pauses and skips music from your library when you ask.`,
  NSCalendarsUsageDescription: `${name} adds events and reads your calendar when you ask.`,
  NSCalendarsFullAccessUsageDescription: `${name} adds events and reads your calendar when you ask.`,
  NSRemindersUsageDescription: `${name} adds reminders when you ask.`,
  NSRemindersFullAccessUsageDescription: `${name} adds reminders when you ask.`,
  NSHomeKitUsageDescription: `${name} sees and controls your Home lights, accessories and scenes when you ask, at home or away.`,
  NSHealthShareUsageDescription: `${name} reads your steps and last night's sleep for your morning briefing when you ask. It never writes to Health.`,
  NSLocationWhenInUseUsageDescription: `${name} checks your Wi-Fi name to know when you're home, so your lights switch the fastest way. Your location isn't saved or sent anywhere.`,
  NSAlarmKitUsageDescription: `${name} sets real alarms that ring like the Clock app, even on silent, when you ask.`,
  NSCameraUsageDescription: `${name} opens the camera right in the app when you ask, and can look at a photo you show it.`,
  NSPhotoLibraryAddUsageDescription: `${name} saves the photos and videos you take in its camera to your Photos.`,
  NSLocalNetworkUsageDescription: `${name} presses your Apple TV's remote buttons, switches your AiDot lights and talks to other devices on your home Wi-Fi directly when you ask, so it works without a VPN or a Shortcut.`
};
for (const [k, v] of Object.entries(keys)) {
  if (xml.includes(`<key>${k}</key>`)) continue;
  const i = xml.lastIndexOf("</dict>");
  xml = xml.slice(0, i) + `\t<key>${k}</key>\n\t<string>${v}</string>\n` + xml.slice(i);
}
const scheme = schemes[0];
if (!xml.includes("<key>CFBundleURLTypes</key>")) {
  const i = xml.lastIndexOf("</dict>");
  xml = xml.slice(0, i) + `\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>${scheme}</string>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n${schemes.map((x) => `\t\t\t\t<string>${x}</string>\n`).join("")}\t\t\t</array>\n\t\t</dict>\n\t</array>\n` + xml.slice(i);
}
// App links Friday can check for (so "refresh my apps" finds your installer). iPhone only allows up to 50.
const QUERY = ["localdevvpn", "altload", "altstore", "sidestore", "altserver", "feather", "livecontainer"];
if (!xml.includes("<key>LSApplicationQueriesSchemes</key>")) {
  const i = xml.lastIndexOf("</dict>");
  xml = xml.slice(0, i) + `\t<key>LSApplicationQueriesSchemes</key>\n\t<array>\n` + QUERY.map(q => `\t\t<string>${q}</string>\n`).join("") + `\t</array>\n` + xml.slice(i);
}
// 3.5.2: the robot (iCTRL) answers on the phone itself at http://127.0.0.1:8200, so allow plain
// local connections (only local ones; everything on the internet stays HTTPS).
if (!xml.includes("<key>NSAppTransportSecurity</key>")) {
  const i = xml.lastIndexOf("</dict>");
  xml = xml.slice(0, i) + `\t<key>NSAppTransportSecurity</key>\n\t<dict>\n\t\t<key>NSAllowsLocalNetworking</key>\n\t\t<true/>\n\t</dict>\n` + xml.slice(i);
}
// 4.2: the Apple TV remote finds the Apple TV on the home Wi-Fi with Bonjour (Apple's remote service).
if (!xml.includes("<key>NSBonjourServices</key>")) {
  const i = xml.lastIndexOf("</dict>");
  xml = xml.slice(0, i) + `\t<key>NSBonjourServices</key>\n\t<array>\n\t\t<string>_companion-link._tcp</string>\n\t\t<string>_airplay._tcp</string>\n\t</array>\n` + xml.slice(i);
}
// Friday's own folder in the Files app (On My iPhone → Friday), so Scriptable widgets can read her widget files.
for (const k of ["UIFileSharingEnabled", "LSSupportsOpeningDocumentsInPlace"]) {
  if (!xml.includes(`<key>${k}</key>`)) {
    const i = xml.lastIndexOf("</dict>");
    xml = xml.slice(0, i) + `\t<key>${k}</key>\n\t<true/>\n` + xml.slice(i);
  }
}
// Background audio: lets her keep a conversation going for a few minutes after you switch apps
// (only while you're talking with her; she goes to sleep after the time set in the app).
if (!xml.includes("<key>UIBackgroundModes</key>")) {
  const i = xml.lastIndexOf("</dict>");
  xml = xml.slice(0, i) + `\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>audio</string>\n\t</array>\n` + xml.slice(i);
}
// App version shown in AltStore and Settings (from package.json "appVersion").
const pkg = require(path.join(__dirname, "..", "package.json"));
const ver = String(pkg.appVersion || "1.0");
xml = xml.replace(/(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${ver}$2`);
xml = xml.replace(/(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${ver}$2`);
fs.writeFileSync(plist, xml);
// 4.0: the label under her icon and in iPhone Settings (Friday's is written F.R.I.D.A.Y.)
{
  const shown = process.env.FRIDAY_PROFILE === "batsie" ? "Reed" : "F.R.I.D.A.Y.";
  let x2 = fs.readFileSync(plist, "utf8");
  if (/<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/.test(x2)) x2 = x2.replace(/(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/, "$1" + shown + "$2");
  else { const k = x2.lastIndexOf("</dict>"); x2 = x2.slice(0, k) + "\t<key>CFBundleDisplayName</key>\n\t<string>" + shown + "</string>\n" + x2.slice(k); }
  fs.writeFileSync(plist, x2);
  console.log("Display name: " + shown);
}
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

// 4.2: the Apple TV remote's protocol code needs iOS 17 or later, so the app now targets iOS 17.
{
  const spm = path.join(__dirname, "..", "ios", "App", "CapApp-SPM", "Package.swift");
  if (fs.existsSync(spm)) {
    const t = fs.readFileSync(spm, "utf8"), t2 = t.replace(/\.iOS\(\.v1[3-6]\)/g, ".iOS(.v17)");
    if (t2 !== t) fs.writeFileSync(spm, t2);
    console.log("CapApp-SPM platform: " + ((t2.match(/\.iOS\(\.v\d+\)/) || ["?"])[0]));
  } else console.log("No CapApp-SPM/Package.swift found");
  const pbx = path.join(__dirname, "..", "ios", "App", "App.xcodeproj", "project.pbxproj");
  if (fs.existsSync(pbx)) {
    const t = fs.readFileSync(pbx, "utf8"), t2 = t.replace(/IPHONEOS_DEPLOYMENT_TARGET = 1[3-6]\.\d;/g, "IPHONEOS_DEPLOYMENT_TARGET = 17.0;");
    if (t2 !== t) fs.writeFileSync(pbx, t2);
    console.log("Deployment target set to 17.0 in " + (t2.match(/IPHONEOS_DEPLOYMENT_TARGET = 17\.0;/g) || []).length + " places");
  }
}
