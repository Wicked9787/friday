# Friday 5.0 Integration Edition

## Direction

This branch is an additive integration edition based on `friday-native` (Friday 4.2.3). It deliberately does not replace the 4.2.3 interface, orb, navigation, AI provider router, persona, memory, existing HomeKit/AiDot/Apple TV/voice plugins, backup flow, or profile behavior.

The new Swift package adds native iOS services and a small optional SwiftUI quick-actions sheet. The original Friday interface remains the app's main interface.

## Added files

- `plugins/friday-system/Package.swift`: Capacitor 8 Swift package.
- `plugins/friday-system/ios/Sources/FridaySystemPlugin/FridaySystemPlugin.swift`: native EventKit, Contacts, UserNotifications, AVSpeechSynthesizer, device status, and SwiftUI quick-actions sheet.
- `plugins/friday-system/ios/Sources/FridaySystemPlugin/FridayAppIntents.swift`: Siri App Shortcut phrases that launch Friday.
- `plugins/friday-system/package.json`: local package metadata.
- `js/friday-system-bridge.js`: stable JavaScript API exposed as `window.FridaySystem`.

## Native API

| API | Capability |
|---|---|
| `deviceSnapshot()` | iPhone model, iOS version, battery, low-power mode, thermal state |
| `authorizationStatus(kind)` | Current calendar, reminders, contacts, or notifications authorization |
| `requestAccess(kind)` | Ask iOS for the selected permission |
| `createReminder(data)` | Create a native Reminders item |
| `createCalendarEvent(data)` | Create a native Calendar event |
| `findContacts(query)` | Search contacts after authorization |
| `scheduleNotification(data)` | Schedule a local notification |
| `pendingNotifications()` | List pending local notifications |
| `cancelNotification(id)` | Cancel a pending/delivered notification |
| `speak(text, options)` | Native speech synthesis |
| `showQuickActions()` | Present optional native SwiftUI action sheet |
| `openAppSettings()` | Open this app's iOS Settings page |
| Siri App Shortcut | Say “Open Friday”, “Wake up Friday”, or “Talk to Friday” to launch the app through Siri |

Example from the existing JavaScript app:

```js
const status = await window.FridaySystem.deviceSnapshot();
await window.FridaySystem.requestAccess("reminders");
await window.FridaySystem.createReminder({
  title: "Check the front door",
  notes: "Created by Friday",
  dueAt: Date.now() + 60 * 60 * 1000
});
```

The methods reject on web/PWA builds rather than pretending native access exists. iOS permission prompts are initiated only when the user requests the capability.

## Setup

1. Check out `friday-integration-5`.
2. Install dependencies with `npm install`.
3. Run the existing iOS build workflow.
4. Install the signed build using the same authorized sideloading route as 4.2.3.

The package and bridge are loaded additively. No credentials, signing certificates, or private keys are committed.

## iOS permission keys

The app must include the usage descriptions for the services it requests:
- `NSCalendarsFullAccessUsageDescription`
- `NSRemindersFullAccessUsageDescription`
- `NSContactsUsageDescription`

Notification authorization is requested at runtime and does not require a usage-description string. If a permission is denied, the app should explain how to enable it in Settings; it must not attempt to bypass the denial.

## Siri and system boundaries

Friday can become the user's preferred assistant inside its own app and can expose supported App Intents / Shortcuts entry points in a later target. A normal third-party iOS app cannot replace Siri as the system-wide assistant, silently intercept the Side Button, bypass privacy prompts, read arbitrary app data, or acquire Apple's private entitlements by adding certificates.

Certificates only sign an app for a distribution method. They do not grant new iOS privileges. Entitlements must be supported by Apple, provisioned for the app, and approved where required.

## Next native integration targets

These are separate work items, not claims that they are already implemented:
- App Intents and Siri Shortcuts for supported user-invoked actions.
- Focus modes and automation handoff through supported APIs.
- Share Extension and Action Extension for receiving user-selected content.
- WidgetKit extension target for widgets.
- Background task scheduling for permitted refresh work.
- More granular HomeKit accessory/scene controls using the existing FridayHome plugin.
- More robust voice session handling with the existing FridayListen plugin.

## Safety and preservation

No jailbreak exploit, private API, certificate bypass, silent permission grant, or device-security circumvention is included. The existing `friday-native` branch is unchanged. This branch is a separate development line and must pass the repository's iOS CI build before installation.
