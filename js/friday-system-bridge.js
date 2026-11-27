/* Friday 5.0 Integration Edition: additive native capability bridge.
   This file does not replace the 4.2.3 UI, AI engine, memory, or existing plugins. */
(function () {
  "use strict";
  var cap = window.Capacitor;
  var native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  var plugin = native && cap.Plugins ? cap.Plugins.FridaySystem : null;
  var api = {
    available: !!plugin,
    deviceSnapshot: function () { return plugin ? plugin.deviceSnapshot() : Promise.reject(new Error("Native iOS app required")); },
    authorizationStatus: function (kind) { return plugin ? plugin.authorizationStatus({ kind: kind }) : Promise.reject(new Error("Native iOS app required")); },
    requestAccess: function (kind) { return plugin ? plugin.requestAccess({ kind: kind }) : Promise.reject(new Error("Native iOS app required")); },
    createReminder: function (data) { return plugin ? plugin.createReminder(data) : Promise.reject(new Error("Native iOS app required")); },
    createCalendarEvent: function (data) { return plugin ? plugin.createCalendarEvent(data) : Promise.reject(new Error("Native iOS app required")); },
    findContacts: function (query) { return plugin ? plugin.findContacts({ query: query }) : Promise.reject(new Error("Native iOS app required")); },
    scheduleNotification: function (data) { return plugin ? plugin.scheduleNotification(data) : Promise.reject(new Error("Native iOS app required")); },
    pendingNotifications: function () { return plugin ? plugin.pendingNotifications() : Promise.reject(new Error("Native iOS app required")); },
    cancelNotification: function (id) { return plugin ? plugin.cancelNotification({ id: id }) : Promise.reject(new Error("Native iOS app required")); },
    speak: function (text, options) { return plugin ? plugin.speak(Object.assign({ text: text }, options || {})) : Promise.reject(new Error("Native iOS app required")); },
    showQuickActions: function () { return plugin ? plugin.showQuickActions() : Promise.reject(new Error("Native iOS app required")); },
    openAppSettings: function () { return plugin ? plugin.openAppSettings() : Promise.reject(new Error("Native iOS app required")); }
  };
  window.FridaySystem = api;
  var toolsButton = document.getElementById("btn-native-tools");
  if (toolsButton) toolsButton.addEventListener("click", function () {
    if (api.available) api.showQuickActions().catch(function (error) { console.error("Friday native tools:", error); });
  });
  if (plugin && plugin.addListener) {
    plugin.addListener("quickAction", function (event) {
      window.dispatchEvent(new CustomEvent("friday:native-action", { detail: event }));
    });
  }
  window.addEventListener("friday:native-action", function (event) {
    var action = event.detail && event.detail.action;
    if (!action || action === "close") return;
    var prompts = {
      speak: "Open voice mode.",
      reminder: "Create a reminder.",
      calendar: "Create a calendar event.",
      contacts: "Find a contact.",
      device: "Show my iPhone device status.",
      notification: "Create a notification."
    };
    var prompt = prompts[action];
    if (!prompt) return;
    var input = document.getElementById("chat-input");
    var form = document.getElementById("composer");
    if (input && form) {
      input.value = prompt;
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    } else {
      window.dispatchEvent(new CustomEvent("friday:request", { detail: { prompt: prompt } }));
    }
  });
})();
