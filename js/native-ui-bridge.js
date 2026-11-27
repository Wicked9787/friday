/* Friday 5.0 SwiftUI front door. The existing web app remains the intelligence/runtime layer. */
(function (root) {
  "use strict";

  function nativePlugin() {
    var c = root.Capacitor;
    return c && c.isNativePlatform && c.isNativePlatform() && c.Plugins
      ? c.Plugins.FridayNativeUI : null;
  }

  function sendToExistingFriday(id, text) {
    var value = String(text || "");
    function click(selector) {
      var el = document.querySelector(selector);
      if (el) { el.click(); return true; }
      return false;
    }
    function sendPrompt(prompt) {
      var input = document.getElementById("chat-input");
      var form = document.getElementById("composer");
      if (!input || !form) return false;
      input.value = prompt;
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      return true;
    }

    switch (id) {
      case "message":
      case "chat":
        click("#btn-chat");
        break;
      case "send":
        if (!sendPrompt(value)) click("#btn-chat");
        break;
      case "voice":
        click("#tb-live");
        break;
      case "home":
        sendPrompt(value || "Show my Home controls and connected devices.");
        break;
      case "vision":
        click("#btn-eyes");
        break;
      case "neural":
        click("#btn-neural");
        break;
      case "memory":
        sendPrompt(value || "What do you remember?");
        break;
      case "schedule":
        sendPrompt(value || "What's on my calendar today?");
        break;
      case "settings":
        click("#btn-settings");
        break;
      case "biometric":
        var P = nativePlugin();
        if (P && P.setBiometricLock) {
          P.setBiometricLock({ enabled: value === "enable" }).catch(function (e) {
            try { root.alert("Friday app lock: " + String(e && e.message || e)); } catch (_) {}
          });
        }
        break;
      default:
        if (value) sendPrompt(value);
        break;
    }
  }

  function boot() {
    var P = nativePlugin();
    if (!P) return;
    try {
      P.addListener("command", function (event) {
        var data = event || {};
        sendToExistingFriday(data.id, data.text);
        // Native UI is a front door, not a replacement runtime. Hand the request to the
        // existing Friday interface and engine, then return to it.
        if (data.id !== "send") {
          setTimeout(function () { try { P.dismiss(); } catch (e) {} }, 180);
        } else {
          setTimeout(function () { try { P.dismiss(); } catch (e) {} }, 180);
        }
      });
    } catch (e) {}

    // Present the SwiftUI dashboard only after Friday's existing key/setup gate has cleared.
    var setup = document.getElementById("setup");
    if (setup && getComputedStyle(setup).display === "none") {
      setTimeout(function () {
        try {
          var profile = root.FRIDAY_CONFIG && root.FRIDAY_CONFIG.getProfile ? root.FRIDAY_CONFIG.getProfile() : null;
          var name = profile && (profile.displayName || profile.assistantName) || "F.R.I.D.A.Y.";
          P.present({ assistantName: name });
        } catch (e) {}
      }, 900);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
