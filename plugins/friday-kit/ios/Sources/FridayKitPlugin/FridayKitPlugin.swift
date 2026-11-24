import Foundation
import Capacitor
import MediaPlayer
import MessageUI
import UIKit
import UniformTypeIdentifiers
#if canImport(AlarmKit)
import AlarmKit
import SwiftUI
#endif
import NetworkExtension
import CoreLocation
import HealthKit
import AVFoundation
import Security
import ObjectiveC

/// Friday's phone add-on.
///   Music: play, pause, skip and "play <artist / song / playlist / album>" from the iPhone's Music library.
///   Texts: opens a message with the recipient and words filled in, inside the app. iPhone always needs you to tap Send.
/// Anything that fails is rejected, and the app hands the job to the Shortcut instead.
@objc(FridayKitPlugin)
public class FridayKitPlugin: CAPPlugin, CAPBridgedPlugin, MFMessageComposeViewControllerDelegate, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    public let identifier = "FridayKitPlugin"
    public let jsName = "FridayKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "musicControl", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "musicPlay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "nowPlaying", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "canText", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "composeText", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "canOpen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "darkKeyboard", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "thermal", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "brightness", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "secretGet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "secretSet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "secretDelete", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "personalVoice", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "health", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "wifiName", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "alarmSet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "alarmCancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "camera", returnType: CAPPluginReturnPromise)
    ]

    private var textCall: CAPPluginCall?
    private static var keyboardDone = false

    override public func load() {
        FridayKitPlugin.useDarkKeyboard()
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardMoved(_:)), name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardMoved(_:)), name: UIResponder.keyboardWillHideNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(thermalChanged), name: ProcessInfo.thermalStateDidChangeNotification, object: nil)
    }

    // ---------- heat ----------
    /// iPhone's own heat level, so the orb can ease off before the phone gets hot.
    private static func thermalName() -> String {
        switch ProcessInfo.processInfo.thermalState {
        case .nominal: return "nominal"
        case .fair: return "fair"
        case .serious: return "serious"
        case .critical: return "critical"
        @unknown default: return "nominal"
        }
    }

    @objc private func thermalChanged() {
        let st = FridayKitPlugin.thermalName()
        DispatchQueue.main.async {
            self.notifyListeners("thermal", data: ["state": st], retainUntilConsumed: false)
        }
    }

    @objc func thermal(_ call: CAPPluginCall) {
        call.resolve(["state": FridayKitPlugin.thermalName()])
    }

    // 3.5.1 headache mode: read and set the screen brightness (0.0 to 1.0).
    @objc func brightness(_ call: CAPPluginCall) {
        let value = call.getDouble("value")
        DispatchQueue.main.async {
            let previous = Double(UIScreen.main.brightness)
            if let v = value {
                UIScreen.main.brightness = CGFloat(max(0.0, min(1.0, v)))
            }
            call.resolve(["previous": previous])
        }
    }

    // ---------- private line keys (iPhone Keychain, this phone only) ----------
    private static let secretService = "app.friday.privateline"

    private static func secretQuery(_ key: String) -> [String: Any] {
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: secretService,
            kSecAttrAccount as String: key
        ]
    }

    @objc func secretGet(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else { call.reject("no-key"); return }
        var q = FridayKitPlugin.secretQuery(key)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        let st = SecItemCopyMatching(q as CFDictionary, &out)
        if st == errSecSuccess, let d = out as? Data, let v = String(data: d, encoding: .utf8) {
            call.resolve(["value": v])
        } else {
            call.resolve(["value": NSNull()])
        }
    }

    @objc func secretSet(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty, let value = call.getString("value") else { call.reject("no-key"); return }
        let data = Data(value.utf8)
        let q = FridayKitPlugin.secretQuery(key)
        SecItemDelete(q as CFDictionary)
        var add = q
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let st = SecItemAdd(add as CFDictionary, nil)
        if st == errSecSuccess { call.resolve(["ok": true]) } else { call.reject("keychain-\(st)") }
    }

    @objc func secretDelete(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else { call.reject("no-key"); return }
        SecItemDelete(FridayKitPlugin.secretQuery(key) as CFDictionary)
        call.resolve(["ok": true])
    }

    // ---------- 3.5: Personal Voice (your own voice made on this iPhone) ----------
    @objc func personalVoice(_ call: CAPPluginCall) {
        if #available(iOS 17.0, *) {
            AVSpeechSynthesizer.requestPersonalVoiceAuthorization { st in
                let voices = AVSpeechSynthesisVoice.speechVoices().filter { $0.voiceTraits.contains(.isPersonalVoice) }.map { ["name": $0.name, "id": $0.identifier] }
                let name: String
                switch st {
                case .authorized: name = "authorized"
                case .denied: name = "denied"
                case .unsupported: name = "unsupported"
                default: name = "notDetermined"
                }
                call.resolve(["status": name, "voices": voices])
            }
        } else {
            call.resolve(["status": "unsupported", "voices": []])
        }
    }

    // ---------- 3.5: steps and sleep (Apple Health, read only) ----------
    private let healthStore = HKHealthStore()
    @objc func health(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable(),
              let steps = HKObjectType.quantityType(forIdentifier: .stepCount),
              let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { call.reject("unavailable"); return }
        healthStore.requestAuthorization(toShare: nil, read: [steps, sleep]) { _, err in
            if err != nil { call.reject("no-health"); return }
            let cal = Calendar.current, now = Date(), start = cal.startOfDay(for: now)
            let group = DispatchGroup()
            var stepCount = 0.0, sleptSec = 0.0
            group.enter()
            let q1 = HKStatisticsQuery(quantityType: steps, quantitySamplePredicate: HKQuery.predicateForSamples(withStart: start, end: now), options: .cumulativeSum) { _, r, _ in
                stepCount = r?.sumQuantity()?.doubleValue(for: .count()) ?? 0
                group.leave()
            }
            self.healthStore.execute(q1)
            group.enter()
            let from = cal.date(byAdding: .hour, value: -18, to: start) ?? start
            let q2 = HKSampleQuery(sampleType: sleep, predicate: HKQuery.predicateForSamples(withStart: from, end: now), limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                var spans: [(Date, Date)] = []
                for s in (samples as? [HKCategorySample]) ?? [] {
                    let v = s.value
                    if v != HKCategoryValueSleepAnalysis.inBed.rawValue && v != HKCategoryValueSleepAnalysis.awake.rawValue { spans.append((s.startDate, s.endDate)) }
                }
                spans.sort { $0.0 < $1.0 }
                var curS: Date? = nil, curE: Date? = nil
                for sp in spans {
                    if let e = curE, sp.0 <= e { if sp.1 > e { curE = sp.1 } }
                    else { if let a = curS, let b = curE { sleptSec += b.timeIntervalSince(a) }; curS = sp.0; curE = sp.1 }
                }
                if let a = curS, let b = curE { sleptSec += b.timeIntervalSince(a) }
                group.leave()
            }
            self.healthStore.execute(q2)
            group.notify(queue: .main) { call.resolve(["steps": Int(stepCount), "sleepMinutes": Int(sleptSec / 60)]) }
        }
    }

    // ---------- 3.5: the Wi-Fi name (so she knows for sure when you're home) ----------
    private var locMgr: CLLocationManager?
    @objc func wifiName(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if #available(iOS 14.0, *) {
                if self.locMgr == nil { self.locMgr = CLLocationManager() }
                if self.locMgr?.authorizationStatus == .notDetermined && call.getBool("ask") == true { self.locMgr?.requestWhenInUseAuthorization() }
                NEHotspotNetwork.fetchCurrent { net in
                    call.resolve(["ssid": net?.ssid ?? NSNull()])
                }
            } else {
                call.resolve(["ssid": NSNull()])
            }
        }
    }

    // ---------- 3.5: real alarms (AlarmKit, iOS 26+): they ring like the Clock app, even on silent ----------
    @objc func alarmSet(_ call: CAPPluginCall) {
        let at = call.getDouble("at") ?? 0
        let title = call.getString("title") ?? "Alarm"
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            Task { @MainActor in
                do {
                    let mgr = AlarmManager.shared
                    if mgr.authorizationState != .authorized {
                        let st = try await mgr.requestAuthorization()
                        if st != .authorized { call.reject("alarm-denied"); return }
                    }
                    let alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: title), stopButton: AlarmButton(text: "Stop", textColor: Color.white, systemImageName: "stop.circle"))
                    let attrs = AlarmAttributes<FridayAlarmMeta>(presentation: AlarmPresentation(alert: alert), metadata: FridayAlarmMeta(), tintColor: Color.orange)
                    let id = UUID()
                    let cfg = AlarmManager.AlarmConfiguration<FridayAlarmMeta>(schedule: .fixed(Date(timeIntervalSince1970: at / 1000)), attributes: attrs)
                    _ = try await mgr.schedule(id: id, configuration: cfg)
                    call.resolve(["id": id.uuidString])
                } catch {
                    call.reject("alarm-failed")
                }
            }
            return
        }
        #endif
        call.reject("unsupported")
    }

    @objc func alarmCancel(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *), let s = call.getString("id"), let id = UUID(uuidString: s) {
            try? AlarmManager.shared.cancel(id: id)
            call.resolve(["ok": true])
            return
        }
        #endif
        call.resolve(["ok": false])
    }

    // ---------- 3.5.2: keyboard height for the talk bar (so it sits right on top of the keyboard) ----------
    @objc private func keyboardMoved(_ note: Notification) {
        var h: CGFloat = 0
        if note.name != UIResponder.keyboardWillHideNotification, let end = (note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue {
            let screenH = UIScreen.main.bounds.height
            h = max(0, screenH - end.origin.y)
        }
        let dur = (note.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? NSNumber)?.doubleValue ?? 0.25
        DispatchQueue.main.async {
            self.notifyListeners("keyboard", data: ["height": h, "duration": dur])
            if let sv = self.bridge?.webView?.scrollView {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { sv.setContentOffset(.zero, animated: false) }
            }
        }
    }

    // ---------- 3.5.2: Apple's camera inside the app; photos and videos save to Photos ----------
    private var cameraCall: CAPPluginCall?
    @objc func camera(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard UIImagePickerController.isSourceTypeAvailable(.camera), let vc = self.bridge?.viewController else { call.reject("no-camera"); return }
            if let old = self.cameraCall { old.resolve(["result": "cancelled"]) }
            let p = UIImagePickerController()
            p.sourceType = .camera
            p.mediaTypes = [UTType.image.identifier, UTType.movie.identifier]
            p.cameraCaptureMode = call.getString("mode") == "video" ? .video : .photo
            if call.getString("mode") == "video" { p.videoQuality = .typeHigh }
            p.delegate = self
            self.cameraCall = call
            vc.present(p, animated: true)
        }
    }

    public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        cameraCall?.resolve(["result": "cancelled"])
        cameraCall = nil
    }

    public func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        picker.dismiss(animated: true)
        guard let call = cameraCall else { return }
        cameraCall = nil
        if let url = info[.mediaURL] as? URL {
            if UIVideoAtPathIsCompatibleWithSavedPhotosAlbum(url.path) { UISaveVideoAtPathToSavedPhotosAlbum(url.path, nil, nil, nil) }
            call.resolve(["result": "saved", "kind": "video"])
            return
        }
        guard let img = info[.originalImage] as? UIImage else { call.resolve(["result": "cancelled"]); return }
        UIImageWriteToSavedPhotosAlbum(img, nil, nil, nil)
        // a smaller copy so she can look at it if you ask "what is this?"
        let maxSide: CGFloat = 1024
        let scale = min(1, maxSide / max(img.size.width, img.size.height))
        let size = CGSize(width: img.size.width * scale, height: img.size.height * scale)
        let small = UIGraphicsImageRenderer(size: size).image { _ in img.draw(in: CGRect(origin: .zero, size: size)) }
        let b64 = small.jpegData(compressionQuality: 0.75)?.base64EncodedString() ?? ""
        call.resolve(["result": "saved", "kind": "photo", "photo": b64.isEmpty ? NSNull() : "data:image/jpeg;base64," + b64])
    }

    // ---------- keyboard ----------
    /// Makes the iPhone keyboard always use its dark look inside the app. Only the keyboard changes; the app's own colors stay the same.
    private static func useDarkKeyboard() {
        if keyboardDone { return }
        keyboardDone = true
        let block: @convention(block) (AnyObject) -> Int = { _ in UIKeyboardAppearance.dark.rawValue }
        let imp = imp_implementationWithBlock(unsafeBitCast(block, to: AnyObject.self))
        let noBar: @convention(block) (AnyObject) -> AnyObject? = { _ in nil }
        if let wk: AnyClass = NSClassFromString("WKContentView"), let m = class_getInstanceMethod(wk, NSSelectorFromString("inputAccessoryView")) {
            method_setImplementation(m, imp_implementationWithBlock(unsafeBitCast(noBar, to: AnyObject.self)))
        }
        let sel = NSSelectorFromString("keyboardAppearance")
        for name in ["WKContentView", "UITextInputTraits"] {
            guard let cls: AnyClass = NSClassFromString(name) else { continue }
            if let m = class_getInstanceMethod(cls, sel) {
                method_setImplementation(m, imp)
            } else {
                class_addMethod(cls, sel, imp, "q@:")
            }
        }
    }

    @objc func darkKeyboard(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            FridayKitPlugin.useDarkKeyboard()
            call.resolve(["ok": true])
        }
    }

    // ---------- apps ----------
    /// Which of these app links can open on this iPhone. Only works for links listed in the app's Info.plist.
    @objc func canOpen(_ call: CAPPluginCall) {
        let schemes = call.getArray("schemes", String.self) ?? []
        DispatchQueue.main.async {
            var out: [String: Bool] = [:]
            for raw in schemes {
                let sc = raw.replacingOccurrences(of: "://", with: "").replacingOccurrences(of: ":", with: "")
                if let u = URL(string: sc + "://") {
                    out[sc] = UIApplication.shared.canOpenURL(u)
                } else {
                    out[sc] = false
                }
            }
            call.resolve(["apps": out])
        }
    }

    // ---------- music ----------
    private func authorize(_ done: @escaping (Bool) -> Void) {
        let s = MPMediaLibrary.authorizationStatus()
        if s == .authorized {
            done(true)
            return
        }
        if s == .notDetermined {
            MPMediaLibrary.requestAuthorization { st in
                DispatchQueue.main.async { done(st == .authorized) }
            }
            return
        }
        done(false)
    }

    private func stateName(_ p: MPMusicPlayerController) -> String {
        switch p.playbackState {
        case .playing: return "playing"
        case .paused: return "paused"
        case .stopped: return "stopped"
        default: return "other"
        }
    }

    @objc func musicControl(_ call: CAPPluginCall) {
        let action = call.getString("action") ?? "toggle"
        authorize { ok in
            guard ok else {
                call.reject("music-denied")
                return
            }
            DispatchQueue.main.async {
                let p = MPMusicPlayerController.systemMusicPlayer
                switch action {
                case "play": p.play()
                case "pause": p.pause()
                case "next": p.skipToNextItem()
                case "previous": p.skipToPreviousItem()
                case "restart": p.skipToBeginning()
                case "shuffle":
                    p.shuffleMode = .songs
                    p.play()
                default:
                    if p.playbackState == .playing { p.pause() } else { p.play() }
                }
                call.resolve(["state": self.stateName(p), "title": p.nowPlayingItem?.title ?? "", "artist": p.nowPlayingItem?.artist ?? ""])
            }
        }
    }

    private func songs(matching q: String, property: String) -> [MPMediaItem] {
        let query = MPMediaQuery.songs()
        query.addFilterPredicate(MPMediaPropertyPredicate(value: q, forProperty: property, comparisonType: .contains))
        return query.items ?? []
    }

    private func find(_ q: String, kind: String) -> (MPMediaItemCollection, String)? {
        if kind == "playlist" || kind == "any" {
            let pq = MPMediaQuery.playlists()
            pq.addFilterPredicate(MPMediaPropertyPredicate(value: q, forProperty: MPMediaPlaylistPropertyName, comparisonType: .contains))
            if let pl = pq.collections?.first as? MPMediaPlaylist, !pl.items.isEmpty {
                return (MPMediaItemCollection(items: pl.items), pl.name ?? q)
            }
        }
        if kind == "artist" || kind == "any" {
            let items = songs(matching: q, property: MPMediaItemPropertyArtist)
            if !items.isEmpty { return (MPMediaItemCollection(items: items), items[0].artist ?? q) }
        }
        if kind == "song" || kind == "any" {
            let items = songs(matching: q, property: MPMediaItemPropertyTitle)
            if !items.isEmpty { return (MPMediaItemCollection(items: [items[0]]), items[0].title ?? q) }
        }
        if kind == "album" || kind == "any" {
            let items = songs(matching: q, property: MPMediaItemPropertyAlbumTitle)
            if !items.isEmpty { return (MPMediaItemCollection(items: items), items[0].albumTitle ?? q) }
        }
        return nil
    }

    @objc func musicPlay(_ call: CAPPluginCall) {
        let q = (call.getString("query") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let kind = call.getString("kind") ?? "any"
        let shuffle = call.getBool("shuffle") ?? false
        authorize { ok in
            guard ok else {
                call.reject("music-denied")
                return
            }
            DispatchQueue.main.async {
                let p = MPMusicPlayerController.systemMusicPlayer
                if q.isEmpty {
                    if shuffle { p.shuffleMode = .songs }
                    p.play()
                    call.resolve(["title": p.nowPlayingItem?.title ?? "", "kind": "resume"])
                    return
                }
                guard let found = self.find(q, kind: kind) else {
                    call.reject("not-found")
                    return
                }
                p.setQueue(with: found.0)
                p.shuffleMode = shuffle ? .songs : .off
                p.prepareToPlay { _ in
                    DispatchQueue.main.async {
                        p.play()
                        call.resolve(["title": found.1, "count": found.0.count])
                    }
                }
            }
        }
    }

    @objc func nowPlaying(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let p = MPMusicPlayerController.systemMusicPlayer
            call.resolve(["state": self.stateName(p), "title": p.nowPlayingItem?.title ?? "", "artist": p.nowPlayingItem?.artist ?? ""])
        }
    }

    // ---------- texts ----------
    // 3.5.4: save a file (like a backup) through the iPhone share sheet: Save to Files, AirDrop, Messages…
    // Downloads don't work inside the app's web view, so backups go this way instead.
    @objc func shareFile(_ call: CAPPluginCall) {
        let rawName = call.getString("name") ?? "friday-backup.json"
        let name = rawName.replacingOccurrences(of: "/", with: "-")
        let text = call.getString("text") ?? ""
        DispatchQueue.main.async {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
            do {
                try text.write(to: url, atomically: true, encoding: .utf8)
            } catch {
                call.reject("write-failed")
                return
            }
            guard let vc = self.bridge?.viewController else {
                call.reject("no-view")
                return
            }
            let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            if let pop = sheet.popoverPresentationController {
                pop.sourceView = vc.view
                pop.sourceRect = CGRect(x: vc.view.bounds.midX, y: vc.view.bounds.midY, width: 1, height: 1)
                pop.permittedArrowDirections = []
            }
            sheet.completionWithItemsHandler = { _, completed, _, _ in
                call.resolve(["completed": completed])
            }
            vc.present(sheet, animated: true)
        }
    }

    @objc func canText(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(["ok": MFMessageComposeViewController.canSendText()])
        }
    }

    @objc func composeText(_ call: CAPPluginCall) {
        let to = call.getArray("to", String.self) ?? []
        let body = call.getString("body") ?? ""
        DispatchQueue.main.async {
            guard MFMessageComposeViewController.canSendText() else {
                call.reject("cannot-text")
                return
            }
            guard let vc = self.bridge?.viewController else {
                call.reject("no-view")
                return
            }
            if let old = self.textCall {
                old.resolve(["result": "cancelled"])
            }
            let m = MFMessageComposeViewController()
            m.recipients = to
            m.body = body
            m.messageComposeDelegate = self
            self.textCall = call
            vc.present(m, animated: true)
        }
    }

    public func messageComposeViewController(_ controller: MFMessageComposeViewController, didFinishWith result: MessageComposeResult) {
        controller.dismiss(animated: true)
        let r: String
        switch result {
        case .sent: r = "sent"
        case .cancelled: r = "cancelled"
        case .failed: r = "failed"
        @unknown default: r = "unknown"
        }
        textCall?.resolve(["result": r])
        textCall = nil
    }
}

#if canImport(AlarmKit)
@available(iOS 26.0, *)
struct FridayAlarmMeta: AlarmMetadata {}
#endif
