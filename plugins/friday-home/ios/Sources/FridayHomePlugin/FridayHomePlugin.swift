import Foundation
import Capacitor
import HomeKit

/// Friday's own HomeKit add-on: set lights to an exact brightness, turn them on or off, run scenes.
/// If iOS doesn't give the app Home access, every call fails cleanly and the app uses the Shortcut instead.
@objc(FridayHomePlugin)
public class FridayHomePlugin: CAPPlugin, CAPBridgedPlugin, HMHomeManagerDelegate {
    public let identifier = "FridayHomePlugin"
    public let jsName = "FridayHome"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "list", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setLights", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "runScene", returnType: CAPPluginReturnPromise)
    ]

    private var manager: HMHomeManager?
    private var isReady = false
    private var pending: [() -> Void] = []

    private func withHomes(_ block: @escaping () -> Void) {
        DispatchQueue.main.async {
            if self.manager == nil {
                let m = HMHomeManager()
                m.delegate = self
                self.manager = m
            }
            if self.isReady {
                block()
                return
            }
            self.pending.append(block)
            DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self] in
                guard let self = self, !self.isReady else { return }
                self.isReady = true
                let waiting = self.pending
                self.pending = []
                waiting.forEach { $0() }
            }
        }
    }

    public func homeManagerDidUpdateHomes(_ manager: HMHomeManager) {
        isReady = true
        let waiting = pending
        pending = []
        waiting.forEach { $0() }
    }

    private func authText() -> String {
        guard let m = manager else { return "unknown" }
        let s = m.authorizationStatus
        if s.contains(.authorized) { return "authorized" }
        if s.contains(.determined) { return "denied" }
        return "notDetermined"
    }

    private func matches(_ text: String, _ want: String?) -> Bool {
        guard let w = want?.lowercased().trimmingCharacters(in: .whitespaces), !w.isEmpty else { return true }
        let t = text.lowercased()
        return t.contains(w) || (!t.isEmpty && w.contains(t))
    }

    private func lights(in home: HMHome, room: String?, name: String?) -> [HMService] {
        var out: [HMService] = []
        for acc in home.accessories {
            if !matches(acc.room?.name ?? "", room) { continue }
            for svc in acc.services where svc.serviceType == HMServiceTypeLightbulb {
                if let n = name, !n.isEmpty, !(matches(svc.name, n) || matches(acc.name, n)) { continue }
                out.append(svc)
            }
        }
        return out
    }

    @objc func status(_ call: CAPPluginCall) {
        withHomes {
            call.resolve(["authorization": self.authText(), "homes": self.manager?.homes.count ?? 0])
        }
    }

    @objc func list(_ call: CAPPluginCall) {
        withHomes {
            var found: [[String: Any]] = []
            var scenes: [String] = []
            var rooms: [String] = []
            for home in self.manager?.homes ?? [] {
                for room in home.rooms { rooms.append(room.name) }
                for svc in self.lights(in: home, room: nil, name: nil) {
                    found.append(["name": svc.accessory?.name ?? svc.name, "room": svc.accessory?.room?.name ?? "", "home": home.name])
                }
                for set in home.actionSets { scenes.append(set.name) }
            }
            call.resolve(["authorization": self.authText(), "lights": found, "scenes": scenes, "rooms": rooms])
        }
    }

    @objc func setLights(_ call: CAPPluginCall) {
        let room = call.getString("room")
        let name = call.getString("name")
        let brightness = call.getInt("brightness")
        let on = call.getBool("on")
        withHomes {
            let homes = self.manager?.homes ?? []
            if homes.isEmpty {
                call.reject("no-home")
                return
            }
            var targets: [HMService] = []
            for home in homes { targets += self.lights(in: home, room: room, name: name) }
            if targets.isEmpty {
                call.reject("no-lights")
                return
            }
            let group = DispatchGroup()
            var failed = 0
            for svc in targets {
                for ch in svc.characteristics {
                    var value: Any? = nil
                    if ch.characteristicType == HMCharacteristicTypePowerState {
                        if let b = brightness { value = b > 0 } else if let o = on { value = o }
                    } else if ch.characteristicType == HMCharacteristicTypeBrightness, let b = brightness, b > 0 {
                        value = max(1, min(100, b))
                    }
                    guard let v = value else { continue }
                    group.enter()
                    ch.writeValue(v) { err in
                        DispatchQueue.main.async {
                            if err != nil { failed += 1 }
                            group.leave()
                        }
                    }
                }
            }
            group.notify(queue: .main) {
                if failed > 0 && failed >= targets.count {
                    call.reject("write-failed")
                } else {
                    call.resolve(["count": targets.count, "failed": failed])
                }
            }
        }
    }

    @objc func runScene(_ call: CAPPluginCall) {
        let want = (call.getString("name") ?? "").lowercased().trimmingCharacters(in: .whitespaces)
        withHomes {
            for home in self.manager?.homes ?? [] {
                let exact = home.actionSets.first { $0.name.lowercased() == want }
                let loose = home.actionSets.first { !want.isEmpty && $0.name.lowercased().contains(want) }
                if let set = exact ?? loose {
                    home.executeActionSet(set) { err in
                        DispatchQueue.main.async {
                            if let e = err { call.reject(e.localizedDescription) } else { call.resolve(["scene": set.name]) }
                        }
                    }
                    return
                }
            }
            call.reject("no-scene")
        }
    }
}
