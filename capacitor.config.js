const profile = process.env.FRIDAY_PROFILE === "batsie" ? "batsie" : "sky";

const apps = {
  sky: { appId: "com.wicked9787.friday", appName: "Friday" },
  batsie: { appId: "com.wicked9787.jarvis", appName: "Reed" }
};

module.exports = {
  ...apps[profile],
  webDir: "www",
  bundledWebRuntime: false
};
