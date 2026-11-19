# Friday and Jarvis: native iOS preparation

This branch adds Capacitor around the existing HTML, CSS, and JavaScript app. It does not convert the app to React Native or replace the existing PWA.

## Two native app identities

The build workflow creates two separate iOS Simulator builds:

- Friday uses the existing Sky profile and bundle identifier `com.wicked9787.friday`.
- Jarvis uses the existing Batsie profile and bundle identifier `com.wicked9787.jarvis`.

Each app has its own iOS app sandbox. Browser local storage from the PWA is not automatically copied into either native app. Use Friday's existing Settings → Backup and restore feature before moving data, and restore the backup inside the native app when that feature has been tested there.

## Build flow

The `scripts/prepare-web.js` script copies the existing app and its runtime assets into `www/`. It injects the selected profile into the generated copy only. It does not modify the original `index.html` or `config.js`.

The GitHub Actions workflow runs on a macOS hosted runner, generates the Capacitor iOS project, syncs the web bundle, and builds both apps for the iOS Simulator. The resulting `.app` bundles are saved as workflow artifacts for seven days.

## Important: simulator build is not an installable iPhone app

The first workflow is an unsigned simulator build. It checks that the native projects compile, but it is not an IPA and cannot be installed on a physical iPhone. A device build needs Apple code signing and a provisioning profile. This workflow deliberately does not request Apple account credentials or store signing secrets.

## Voice and permissions

The existing voice code uses browser media APIs, MediaRecorder, and speech synthesis. Those capabilities must be tested in Capacitor's iOS WebView on a real device. A successful simulator compile does not prove microphone recording or speech recognition works on-device, and iOS does not allow unrestricted always-on microphone access while an app is suspended.

## Run locally on a Mac

Install Node.js 22 or newer, then:

```sh
npm install
FRIDAY_PROFILE=sky npm run build
FRIDAY_PROFILE=sky npx cap add ios
FRIDAY_PROFILE=sky npx cap sync ios
```

For Jarvis, replace `sky` with `batsie`. Generate each app in a clean checkout or remove the generated `ios/` directory between profile changes, because the bundle identifier and display name are set when the native project is first generated.
