# Friday 5.0 SwiftUI native front door

## Preservation model

This is an additive native presentation layer for the existing Friday 4.2.3 Capacitor 8 app. The original PWA/WebView, Groq and backup-brain router, persona, memory, chat, WebGL orb, voice, HomeKit, AiDot, Apple TV, calendar, reminders, contacts, notifications, backup/restore and Keychain safety-copy code remain the source of truth.

The SwiftUI dashboard is presented by the new `FridayNativeUI` Capacitor plugin. It sends typed commands through Capacitor events to `js/native-ui-bridge.js`; that bridge hands actions to the existing DOM controls and existing `#composer` chat pipeline. The native screen dismisses after handing off, so all existing features continue to work in their original implementation.

## Files added

- `plugins/friday-native-ui/Package.swift`: Capacitor 8 Swift Package.
- `plugins/friday-native-ui/ios/Sources/FridayNativeUIPlugin/FridayNativeUIPlugin.swift`: SwiftUI dashboard, tabs, animated native orb, notification permission request and optional LocalAuthentication gate.
- `js/native-ui-bridge.js`: command handoff to the existing Friday interface.
- `widgets/FridayLockScreenWidget.swift`: source for a separate WidgetKit extension target.

No existing engine or storage file is replaced.

## Build

The repository's existing `.github/workflows/ios-native-build.yml` already generates unsigned device IPAs. It builds Friday and Reed as separate profiles. The new plugin is included through the normal `npm install` and `npx cap sync ios` flow.

1. Open the `friday-swiftui-5` branch.
2. Run the existing **Native iOS build** GitHub Actions workflow (or push a commit affecting the workflow's watched paths).
3. Download `friday-ios-unsigned-ipa` from the Friday job artifact.
4. Sign/install it using the same authorized iPhone sideloading process used for the existing build.

The workflow's IPA is unsigned. It is not directly installable until signed. No signing credentials are added to this repository.

## Local Mac build

Requires Node.js 22+, Xcode 26-compatible toolchain, and iOS 17+ deployment target:

```sh
npm install
FRIDAY_PROFILE=sky npm run build
FRIDAY_PROFILE=sky npx cap add ios
FRIDAY_PROFILE=sky npx cap sync ios
npx cap open ios
```

Use `FRIDAY_PROFILE=batsie` only when building Reed. Do not run `cap add ios` over an existing generated project; use a clean checkout if regenerating.

## WidgetKit extension

WidgetKit extensions are separate Xcode targets and cannot be compiled into the main Capacitor app target. To enable the supplied Lock Screen widget:

1. In Xcode, add a **Widget Extension** target named `FridayWidgets`.
2. Add `widgets/FridayLockScreenWidget.swift` to that extension target only.
3. Set the extension deployment target to iOS 17 or later.
4. Add the `friday` URL scheme already registered by the existing permission/build setup.
5. Confirm the extension's bundle identifier is the app bundle identifier plus `.FridayWidgets`.
6. Build and install the containing app with the extension embedded.

The widget is intentionally only the open orb. iOS controls widget refresh; continuous animation is not supported in Lock Screen widgets.

## Authentication and notifications

The native shell's optional app lock uses LocalAuthentication (Face ID or device passcode). It is off by default and does not replace Friday's existing API-key setup or local Keychain backup. Notification permission is requested only after the user taps the notification control. Friday's existing Capacitor Local Notifications scheduling remains authoritative for reminders and alerts.

## Integration boundary

The SwiftUI shell hands actions to existing UI controls:
- Chat and typed requests: existing `#composer` / `#chat-input`.
- Voice: existing `#tb-live` control and native FridayListen plugin.
- Neural map: existing `#btn-neural`.
- Settings: existing `#btn-settings`.
- Camera/photo flow: existing `#btn-eyes`.
- Home, schedule and memory prompts: existing chat intent routing.

This first native layer deliberately does not duplicate the AI brain, persona, memory database, or HomeKit command implementation.
