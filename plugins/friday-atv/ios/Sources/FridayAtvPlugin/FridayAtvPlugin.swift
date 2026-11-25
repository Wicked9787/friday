import Foundation
import Capacitor
import ItsytvCore

/// Apple TV remote for Friday and Reed.
///   Pairs with the Apple TV once (a 4-digit PIN shows on the TV), then presses its buttons over the
///   home Wi-Fi with Apple's own Companion protocol, the same one the iPhone's Apple TV Remote uses.
///   The protocol code is the open-source itsytv-core (MIT License, (c) 2026 Nick Ustinov).
///   The pairing keys stay in this iPhone's Keychain. Nothing goes to the internet.
@objc(FridayAtvPlugin)
public class FridayAtvPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FridayAtvPlugin"
    public let jsName = "FridayAtv"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pin", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "press", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "swipe", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "power", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "skip", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "mute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "forget", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exportPairing", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "importPairing", returnType: CAPPluginReturnPromise)
    ]

    private var manager: AppleTVManager?
    private var asleep = false
    private let defaults = UserDefaults.standard
    private static let lastNameKey = "friday.atv.lastName"
    private static let lastIdKey = "friday.atv.lastId"

    private func mgr() -> AppleTVManager {
        if let m = manager { return m }
        let m = AppleTVManager()
        manager = m
        return m
    }

    // ---------- state ----------

    private func statusName(_ s: ConnectionStatus) -> (String, String?) {
        switch s {
        case .disconnected: return ("disconnected", nil)
        case .connecting: return ("connecting", nil)
        case .pairing: return ("pairing", nil)
        case .connected: return ("connected", nil)
        case .localNetworkDenied: return ("localNetworkDenied", nil)
        case .error(let msg): return ("error", msg)
        }
    }

    private func lastId(_ m: AppleTVManager) -> String? {
        return m.lastConnectedDeviceID ?? defaults.string(forKey: FridayAtvPlugin.lastIdKey)
    }

    private func state(_ extra: [String: Any] = [:]) -> [String: Any] {
        let m = mgr()
        let (s, err) = statusName(m.connectionStatus)
        let id = lastId(m)
        var d: [String: Any] = [
            "status": s,
            "name": m.connectedDeviceName ?? defaults.string(forKey: FridayAtvPlugin.lastNameKey) ?? "",
            "paired": id.map { KeychainStorage.load(for: $0) != nil } ?? false,
            "known": id != nil,
            "media": m.mrpManager.isConnected,
            "asleep": asleep
        ]
        if let err = err { d["error"] = err }
        if let id = id { d["id"] = id }
        for (k, v) in extra { d[k] = v }
        return d
    }

    private func devicesList(_ m: AppleTVManager) -> [[String: Any]] {
        return m.discoveredDevices.map { dev in
            ["id": dev.id, "name": dev.name, "model": dev.modelName ?? "", "paired": KeychainStorage.load(for: dev.id) != nil]
        }
    }

    private func remember(_ d: AppleTVDevice) {
        defaults.set(d.name, forKey: FridayAtvPlugin.lastNameKey)
        defaults.set(d.id, forKey: FridayAtvPlugin.lastIdKey)
    }

    /// True when there is an Apple TV to talk to (connected, on its way, or one used before).
    private func ready(_ m: AppleTVManager) -> Bool {
        if m.connectionStatus == .connected || m.connectionStatus == .connecting || m.connectionStatus == .pairing { return true }
        return m.lastConnectedDeviceID != nil
    }

    @objc func status(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(self.state()) }
    }

    // ---------- finding and pairing ----------

    @objc func scan(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let m = self.mgr()
            m.startScanning()
            let wait = min(max(call.getDouble("seconds") ?? 3, 1), 10)
            DispatchQueue.main.asyncAfter(deadline: .now() + wait) {
                let list = self.devicesList(m)
                m.stopScanning()
                call.resolve(["devices": list])
            }
        }
    }

    /// Connects to the Apple TV with this id, or the one used last, or the only one on the Wi-Fi.
    /// A first connection starts pairing: the Apple TV shows a PIN and status becomes "pairing".
    @objc func connect(_ call: CAPPluginCall) {
        let want = call.getString("id")
        DispatchQueue.main.async {
            let m = self.mgr()
            if m.connectionStatus == .connected && (want == nil || m.connectedDeviceID == want) {
                call.resolve(self.state()); return
            }
            if let want = want, let d = m.discoveredDevices.first(where: { $0.id == want }) {
                self.remember(d); m.stopScanning(); m.connect(to: d)
                call.resolve(self.state()); return
            }
            if want == nil && m.connectToLastConnectedDevice() {
                call.resolve(self.state()); return
            }
            m.startScanning()
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                let devs = m.discoveredDevices
                var pick: AppleTVDevice?
                if let want = want { pick = devs.first(where: { $0.id == want }) }
                else { pick = devs.first(where: { KeychainStorage.load(for: $0.id) != nil }) ?? (devs.count == 1 ? devs.first : nil) }
                m.stopScanning()
                guard let d = pick else {
                    call.resolve(self.state(["status": devs.isEmpty ? "notfound" : "choose", "devices": self.devicesList(m)]))
                    return
                }
                self.remember(d); m.connect(to: d)
                call.resolve(self.state())
            }
        }
    }

    @objc func pin(_ call: CAPPluginCall) {
        let digits = (call.getString("pin") ?? "").filter { $0.isNumber }
        guard digits.count == 4 else { call.reject("bad-pin"); return }
        DispatchQueue.main.async {
            self.mgr().submitPIN(digits)
            call.resolve(self.state())
        }
    }

    /// Forgets the pairing on this iPhone (the Apple TV can also remove it under Remotes and Devices).
    @objc func forget(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let m = self.mgr()
            let id = self.lastId(m)
            m.disconnect()
            if let id = id { KeychainStorage.delete(for: id) }
            self.defaults.removeObject(forKey: FridayAtvPlugin.lastIdKey)
            self.defaults.removeObject(forKey: FridayAtvPlugin.lastNameKey)
            call.resolve(self.state())
        }
    }

    // ---------- the pairing in a backup file (only when you choose to include keys) ----------

    /// The pairing keys for the Apple TV used last, so a backup can bring the remote back without a new code.
    @objc func exportPairing(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let m = self.mgr()
            guard let id = self.lastId(m) ?? KeychainStorage.allPairedDeviceIDs().first,
                  let creds = KeychainStorage.load(for: id),
                  let data = try? JSONEncoder().encode(creds) else { call.resolve([:]); return }
            call.resolve(["id": id, "name": self.defaults.string(forKey: FridayAtvPlugin.lastNameKey) ?? "", "creds": data.base64EncodedString()])
        }
    }

    @objc func importPairing(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), !id.isEmpty, let b64 = call.getString("creds"),
              let data = Data(base64Encoded: b64), let creds = try? JSONDecoder().decode(HAPCredentials.self, from: data) else {
            call.reject("bad-pairing"); return
        }
        DispatchQueue.main.async {
            do { try KeychainStorage.save(credentials: creds, for: id) } catch { call.reject("keychain"); return }
            self.defaults.set(id, forKey: FridayAtvPlugin.lastIdKey)
            if let name = call.getString("name"), !name.isEmpty { self.defaults.set(name, forKey: FridayAtvPlugin.lastNameKey) }
            call.resolve(self.state(["ok": true]))
        }
    }

    // ---------- buttons ----------

    private static let buttons: [String: CompanionButton] = [
        "up": .up, "down": .down, "left": .left, "right": .right, "select": .select,
        "back": .menu, "menu": .menu, "home": .home, "tv": .home, "playpause": .playPause,
        "volumeup": .volumeUp, "volumedown": .volumeDown, "sleep": .sleep, "wake": .wake
    ]

    @objc func press(_ call: CAPPluginCall) {
        guard let name = call.getString("button")?.lowercased(), let b = FridayAtvPlugin.buttons[name] else {
            call.reject("bad-button"); return
        }
        let act = call.getString("action") ?? "click"
        let times = max(1, min(call.getInt("times") ?? 1, 15))
        DispatchQueue.main.async {
            let m = self.mgr()
            guard self.ready(m) else { call.resolve(self.state(["ok": false])); return }
            let action: InputAction = act == "double" ? .doubleClick : (act == "hold" ? .hold : .click)
            for i in 0..<times {
                DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.2) { m.pressButton(b, action: action) }
            }
            self.asleep = (b == .sleep)
            call.resolve(self.state(["ok": true]))
        }
    }

    @objc func swipe(_ call: CAPPluginCall) {
        let map: [String: SwipeDirection] = ["up": .up, "down": .down, "left": .left, "right": .right]
        guard let d = map[call.getString("dir") ?? ""] else { call.reject("bad-dir"); return }
        DispatchQueue.main.async {
            let m = self.mgr()
            guard self.ready(m) else { call.resolve(self.state(["ok": false])); return }
            m.swipe(d)
            self.asleep = false
            call.resolve(self.state(["ok": true]))
        }
    }

    /// on: true wakes the Apple TV, false puts it to sleep, missing flips it.
    /// With HDMI-CEC on, the TV turns on and off with it.
    @objc func power(_ call: CAPPluginCall) {
        let want = call.getBool("on")
        DispatchQueue.main.async {
            let m = self.mgr()
            guard self.ready(m) else { call.resolve(self.state(["ok": false])); return }
            let on = want ?? self.asleep
            m.pressButton(on ? .wake : .sleep)
            self.asleep = !on
            call.resolve(self.state(["ok": true, "on": on]))
        }
    }

    // Skip and mute travel on the media channel, which opens a moment after the remote connects.
    private func withMedia(_ m: AppleTVManager, waited: Double = 0, _ run: @escaping (Bool) -> Void) {
        if m.mrpManager.isConnected { run(true); return }
        if waited == 0 && m.connectionStatus != .connected && m.connectionStatus != .connecting && m.connectionStatus != .pairing {
            _ = m.connectToLastConnectedDevice()
        }
        if waited >= 8 { run(false); return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { self.withMedia(m, waited: waited + 0.4, run) }
    }

    @objc func skip(_ call: CAPPluginCall) {
        let back = call.getString("dir") == "back"
        let secs = Float(min(max(call.getDouble("seconds") ?? 10, 5), 60))
        DispatchQueue.main.async {
            let m = self.mgr()
            guard self.ready(m) else { call.resolve(self.state(["ok": false])); return }
            self.withMedia(m) { up in
                if up { m.mrpManager.sendSkip(back ? .skipBackward : .skipForward, interval: secs) }
                call.resolve(self.state(["ok": up]))
            }
        }
    }

    @objc func mute(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let m = self.mgr()
            guard self.ready(m) else { call.resolve(self.state(["ok": false])); return }
            self.withMedia(m) { up in
                if up { m.toggleMute() }
                call.resolve(self.state(["ok": up]))
            }
        }
    }
}
