import Foundation
import Capacitor
import Speech
import AVFoundation

/// Friday's live listening add-on. Uses the iPhone's own speech recognition so she sees your words
/// while you talk, the way ChatGPT's voice mode does. Events:
///   "partial" { text, final }  the words so far
///   "level"   { rms }          how loud the mic is (about 20 times a second)
///   "end"     { text }         iOS finished on its own
/// If anything is missing (no permission, no recognizer), start() fails and the app uses Whisper instead.
@objc(FridayListenPlugin)
public class FridayListenPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FridayListenPlugin"
    public let jsName = "FridayListen"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "speakerOn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "speakerOff", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "route", returnType: CAPPluginReturnPromise)
    ]

    private let engine = AVAudioEngine()
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var lastText = ""
    private var stopCall: CAPPluginCall?
    private var session = 0
    private var tapInstalled = false
    private var sessionActive = false
    private var observing = false

    static func authName(_ s: SFSpeechRecognizerAuthorizationStatus) -> String {
        switch s {
        case .authorized: return "granted"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "prompt"
        @unknown default: return "prompt"
        }
    }

    @objc func available(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "en-US"
        DispatchQueue.main.async {
            let r = SFSpeechRecognizer(locale: Locale(identifier: lang))
            call.resolve([
                "available": r?.isAvailable ?? false,
                "speech": FridayListenPlugin.authName(SFSpeechRecognizer.authorizationStatus()),
                "onDevice": r?.supportsOnDeviceRecognition ?? false
            ])
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "en-US"
        // Names she should expect (Batsie, Sky, contacts...), so iOS spells them right.
        let hints = Array((call.getArray("hints", String.self) ?? []).prefix(100))
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                guard status == .authorized else {
                    call.reject("speech-" + FridayListenPlugin.authName(status))
                    return
                }
                AVAudioSession.sharedInstance().requestRecordPermission { granted in
                    DispatchQueue.main.async {
                        guard granted else {
                            call.reject("mic-denied")
                            return
                        }
                        self.begin(call, lang: lang, hints: hints)
                    }
                }
            }
        }
    }

    private func begin(_ call: CAPPluginCall, lang: String, hints: [String]) {
        if let old = stopCall {
            stopCall = nil
            old.resolve(["text": lastText])
        }
        teardown(cancelTask: true)
        guard let rec = SFSpeechRecognizer(locale: Locale(identifier: lang)), rec.isAvailable else {
            call.reject("unavailable")
            return
        }
        recognizer = rec
        session += 1
        let mySession = session
        lastText = ""

        let audio = AVAudioSession.sharedInstance()
        if !observing {
            observing = true
            // A call, Siri or another app taking the mic ends this listen cleanly, so the app knows.
            NotificationCenter.default.addObserver(self, selector: #selector(onInterruption(_:)), name: AVAudioSession.interruptionNotification, object: audio)
        }
        do {
            // Speaker stays loud, AirPods stay in full-quality mode (the iPhone mic listens), music isn't ducked.
            // The mode is left as is afterwards, so her voice playing next isn't interrupted by a switch.
            if audio.category != .playAndRecord || !audio.categoryOptions.contains(.defaultToSpeaker) {
                try audio.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothA2DP, .mixWithOthers])
            }
            try audio.setActive(true, options: [])
            sessionActive = true
        } catch {
            call.reject("audio-session")
            return
        }

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        req.taskHint = .dictation
        if !hints.isEmpty {
            req.contextualStrings = hints
        }
        if #available(iOS 16.0, *) {
            req.addsPunctuation = true
        }
        request = req

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            teardown(cancelTask: true)
            call.reject("no-mic")
            return
        }
        let counter = TapCounter()
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            req.append(buffer)
            counter.n += 1
            if counter.n % 2 != 0 { return }
            guard let data = buffer.floatChannelData?[0] else { return }
            let n = Int(buffer.frameLength)
            if n == 0 { return }
            var sum: Float = 0
            for i in 0..<n {
                let v = data[i]
                sum += v * v
            }
            let rms = Double(sqrt(sum / Float(n)))
            DispatchQueue.main.async {
                guard let self = self, self.session == mySession else { return }
                self.notifyListeners("level", data: ["rms": rms])
            }
        }
        tapInstalled = true

        task = rec.recognitionTask(with: req) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self = self, self.session == mySession else { return }
                if let result = result {
                    self.lastText = result.bestTranscription.formattedString
                    self.notifyListeners("partial", data: ["text": self.lastText, "final": result.isFinal])
                    if result.isFinal {
                        self.finish()
                        return
                    }
                }
                if error != nil {
                    self.finish()
                }
            }
        }

        engine.prepare()
        do {
            try engine.start()
        } catch {
            teardown(cancelTask: true)
            call.reject("engine")
            return
        }
        call.resolve(["started": true])
    }

    /// Stop listening and get the final words (waits up to a second for iOS to finish them).
    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.request != nil else {
                call.resolve(["text": self.lastText])
                return
            }
            if let old = self.stopCall {
                old.resolve(["text": self.lastText])
            }
            self.stopCall = call
            self.stopAudio()
            self.request?.endAudio()
            let s = self.session
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                if self.session == s {
                    self.finish()
                }
            }
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.teardown(cancelTask: true)
            if let c = self.stopCall {
                self.stopCall = nil
                c.resolve(["text": ""])
            }
            call.resolve()
        }
    }

    /// Before she talks: play through the main speaker (or AirPods / car), even on silent,
    /// with any music turned down while she speaks. Skipped while listening.
    @objc func speakerOn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.request != nil {
                call.resolve(["ok": false, "reason": "listening"])
                return
            }
            let audio = AVAudioSession.sharedInstance()
            do {
                try audio.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
                try audio.setActive(true, options: [])
                call.resolve(["ok": true, "route": self.routeName()])
            } catch {
                call.resolve(["ok": false, "reason": error.localizedDescription])
            }
        }
    }

    /// After she talks: let other audio (music) come back up.
    @objc func speakerOff(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.request == nil {
                try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
            }
            call.resolve()
        }
    }

    @objc func route(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let audio = AVAudioSession.sharedInstance()
            call.resolve(["route": self.routeName(), "category": audio.category.rawValue, "volume": Double(audio.outputVolume)])
        }
    }

    private func routeName() -> String {
        let outs = AVAudioSession.sharedInstance().currentRoute.outputs
        return outs.map { $0.portType.rawValue }.joined(separator: ",")
    }

    private func finish() {
        let text = lastText
        teardown(cancelTask: false)
        if let c = stopCall {
            stopCall = nil
            c.resolve(["text": text])
        } else {
            notifyListeners("end", data: ["text": text])
        }
    }

    private func stopAudio() {
        if engine.isRunning {
            engine.stop()
        }
        if tapInstalled {
            engine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
    }

    private func teardown(cancelTask: Bool) {
        session += 1
        stopAudio()
        if cancelTask {
            task?.cancel()
        }
        request?.endAudio()
        task = nil
        request = nil
        // Hand the audio back, so her voice (played by the web view) isn't left cut off.
        if sessionActive {
            sessionActive = false
            try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        }
    }

    @objc private func onInterruption(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw), type == .began else { return }
        DispatchQueue.main.async {
            if self.request != nil { self.finish() }
        }
    }
}

/// Counts mic buffers so loudness is sent about 20 times a second, not 40.
final class TapCounter {
    var n = 0
}
