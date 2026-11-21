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
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]

    private let engine = AVAudioEngine()
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var lastText = ""
    private var stopCall: CAPPluginCall?
    private var session = 0
    private var tapInstalled = false

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
                        self.begin(call, lang: lang)
                    }
                }
            }
        }
    }

    private func begin(_ call: CAPPluginCall, lang: String) {
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
        do {
            try audio.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth, .duckOthers])
            try audio.setActive(true, options: [])
        } catch {
            call.reject("audio-session")
            return
        }

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        req.taskHint = .dictation
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
        // Back to normal playback so her voice is full quality (AirPods leave call mode).
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [])
    }
}

/// Counts mic buffers so loudness is sent about 20 times a second, not 40.
final class TapCounter {
    var n = 0
}
