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
        CAPPluginMethod(name: "runScene", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "devices", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "control", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise)
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
            DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
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

    /// Smart plugs and wall switches count as lights when they're named like one ("Desk lamp", "Porch light")
    /// or Home lists them as a light, so "turn off the lights" never switches off the coffee maker.
    private func isLight(_ svc: HMService, _ acc: HMAccessory) -> Bool {
        if svc.serviceType == HMServiceTypeLightbulb { return true }
        guard svc.serviceType == HMServiceTypeSwitch || svc.serviceType == HMServiceTypeOutlet else { return false }
        if acc.category.categoryType == HMAccessoryCategoryTypeLightbulb { return true }
        let n = (svc.name + " " + acc.name).lowercased()
        return ["light", "lamp", "bulb", "led", "sconce", "chandelier", "strip", "string"].contains { n.contains($0) }
    }

    private func lights(in home: HMHome, room: String?, name: String?) -> [HMService] {
        var out: [HMService] = []
        for acc in home.accessories {
            if !matches(acc.room?.name ?? "", room) { continue }
            for svc in acc.services where isLight(svc, acc) {
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
            var accessories = 0
            var plugs = 0
            for home in self.manager?.homes ?? [] {
                accessories += home.accessories.count
                for acc in home.accessories {
                    for svc in acc.services where (svc.serviceType == HMServiceTypeSwitch || svc.serviceType == HMServiceTypeOutlet) && !self.isLight(svc, acc) { plugs += 1 }
                }
                for room in home.rooms { rooms.append(room.name) }
                for svc in self.lights(in: home, room: nil, name: nil) {
                    found.append(["name": svc.accessory?.name ?? svc.name, "room": svc.accessory?.room?.name ?? "", "home": home.name])
                }
                for set in home.actionSets { scenes.append(set.name) }
            }
            call.resolve(["authorization": self.authText(), "lights": found, "scenes": scenes, "rooms": rooms,
                          "homes": self.manager?.homes.count ?? 0, "accessories": accessories, "otherPlugs": plugs])
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

    // ---------- 3.4: the whole home (not just lights). Door locks, garage doors and alarms are never touched. ----------
    private static let fanV2 = "000000B7-0000-1000-8000-0026BB765291"

    private func kindOf(_ svc: HMService, _ acc: HMAccessory) -> String? {
        let t = svc.serviceType
        if t == HMServiceTypeLightbulb { return "light" }
        if t == HMServiceTypeFan || t == FridayHomePlugin.fanV2 { return "fan" }
        if t == HMServiceTypeThermostat { return "thermostat" }
        if t == HMServiceTypeHeaterCooler { return "ac" }
        if t == HMServiceTypeTemperatureSensor { return "temp" }
        if t == HMServiceTypeHumiditySensor { return "humidity" }
        if t == HMServiceTypeWindowCovering { return "blinds" }
        if t == HMServiceTypeAirPurifier { return "purifier" }
        if t == HMServiceTypeHumidifierDehumidifier { return "humidifier" }
        if t == HMServiceTypeTelevision { return "tv" }
        if t == HMServiceTypeSwitch || t == HMServiceTypeOutlet { return isLight(svc, acc) ? "light" : (t == HMServiceTypeOutlet ? "outlet" : "switch") }
        return nil
    }

    private func chValue(_ svc: HMService, _ type: String) -> Any? {
        return svc.characteristics.first { $0.characteristicType == type }?.value
    }

    private func describe(_ svc: HMService, _ acc: HMAccessory, _ kind: String, _ home: HMHome) -> [String: Any] {
        var d: [String: Any] = ["name": svc.name.isEmpty ? acc.name : svc.name, "accessory": acc.name, "room": acc.room?.name ?? "", "kind": kind, "home": home.name, "reachable": acc.isReachable]
        if let v = chValue(svc, HMCharacteristicTypePowerState) as? Bool { d["on"] = v }
        if let v = chValue(svc, HMCharacteristicTypeActive) as? NSNumber { d["on"] = v.intValue == 1 }
        if let v = chValue(svc, HMCharacteristicTypeCurrentTemperature) as? NSNumber { d["current"] = v.doubleValue }
        if let v = chValue(svc, HMCharacteristicTypeTargetTemperature) as? NSNumber { d["target"] = v.doubleValue }
        if let v = chValue(svc, HMCharacteristicTypeCurrentRelativeHumidity) as? NSNumber { d["humidity"] = v.doubleValue }
        if let v = chValue(svc, HMCharacteristicTypeRotationSpeed) as? NSNumber { d["level"] = v.intValue }
        if let v = chValue(svc, HMCharacteristicTypeCurrentPosition) as? NSNumber { d["level"] = v.intValue }
        return d
    }

    private func allServices() -> [(HMService, HMAccessory, String, HMHome)] {
        var out: [(HMService, HMAccessory, String, HMHome)] = []
        for home in manager?.homes ?? [] {
            for acc in home.accessories {
                for svc in acc.services {
                    if let k = kindOf(svc, acc) { out.append((svc, acc, k, home)) }
                }
            }
        }
        return out
    }

    @objc func devices(_ call: CAPPluginCall) {
        withHomes {
            let list = self.allServices().map { self.describe($0.0, $0.1, $0.2, $0.3) }
            call.resolve(["authorization": self.authText(), "devices": list])
        }
    }

    @objc func read(_ call: CAPPluginCall) {
        let room = call.getString("room")
        let want = call.getString("kind") ?? "temperature"
        withHomes {
            let kinds: [String] = want == "humidity" ? ["humidity", "thermostat", "ac", "purifier", "humidifier"] : ["temp", "thermostat", "ac"]
            let targets = self.allServices().filter { kinds.contains($0.2) && self.matches($0.1.room?.name ?? "", room) }
            if targets.isEmpty { call.reject("no-sensor"); return }
            let group = DispatchGroup()
            let types = [HMCharacteristicTypeCurrentTemperature, HMCharacteristicTypeTargetTemperature, HMCharacteristicTypeCurrentRelativeHumidity]
            for t in targets {
                for ch in t.0.characteristics where types.contains(ch.characteristicType) {
                    group.enter()
                    ch.readValue { _ in DispatchQueue.main.async { group.leave() } }
                }
            }
            group.notify(queue: .main) {
                call.resolve(["readings": targets.map { self.describe($0.0, $0.1, $0.2, $0.3) }])
            }
        }
    }

    @objc func control(_ call: CAPPluginCall) {
        let name = call.getString("name")
        let room = call.getString("room")
        let kind = call.getString("kind")
        let on = call.getBool("on")
        let level = call.getInt("level")
        let temp = call.getDouble("temperature")
        let mode = call.getString("mode")
        withHomes {
            var targets = self.allServices().filter { t in
                if t.2 == "temp" || t.2 == "humidity" { return false }
                if let k = kind, !k.isEmpty {
                    if k == "climate" { if !(t.2 == "thermostat" || t.2 == "ac") { return false } }
                    else if k != t.2 { return false }
                } else if t.2 == "light" { return false }
                if !self.matches(t.1.room?.name ?? "", room) { return false }
                if let n = name, !n.isEmpty { return self.matches(t.0.name, n) || self.matches(t.1.name, n) }
                return true
            }
            if targets.isEmpty { call.reject("no-device"); return }
            if (name ?? "").isEmpty && (kind ?? "").isEmpty { targets = [] }
            let group = DispatchGroup()
            var wrote = 0, failed = 0
            func write(_ ch: HMCharacteristic, _ v: Any) {
                group.enter()
                ch.writeValue(v) { err in DispatchQueue.main.async { if err != nil { failed += 1 } else { wrote += 1 }; group.leave() } }
            }
            for t in targets {
                let svc = t.0
                for ch in svc.characteristics {
                    switch ch.characteristicType {
                    case HMCharacteristicTypePowerState:
                        if let o = on { write(ch, o) } else if let l = level { write(ch, l > 0) }
                    case HMCharacteristicTypeActive:
                        if let o = on { write(ch, NSNumber(value: o ? 1 : 0)) }
                        else if let m = mode, t.2 == "ac" { write(ch, NSNumber(value: m == "off" ? 0 : 1)) }
                        else if let l = level { write(ch, NSNumber(value: l > 0 ? 1 : 0)) }
                    case HMCharacteristicTypeRotationSpeed, HMCharacteristicTypeBrightness:
                        if let l = level, l > 0 { write(ch, NSNumber(value: Float(max(1, min(100, l))))) }
                    case HMCharacteristicTypeTargetPosition:
                        if let l = level { write(ch, NSNumber(value: max(0, min(100, l)))) }
                        else if let o = on { write(ch, NSNumber(value: o ? 100 : 0)) }
                    case HMCharacteristicTypeTargetTemperature:
                        if let c = temp { write(ch, NSNumber(value: c)) }
                    case HMCharacteristicTypeCoolingThreshold:
                        if let c = temp, mode != "heat" { write(ch, NSNumber(value: c)) }
                    case HMCharacteristicTypeHeatingThreshold:
                        if let c = temp, mode != "cool" { write(ch, NSNumber(value: c)) }
                    case HMCharacteristicTypeTargetHeatingCooling:
                        if let m = mode { write(ch, NSNumber(value: m == "off" ? 0 : m == "heat" ? 1 : m == "cool" ? 2 : 3)) }
                        else if let o = on, !o { write(ch, NSNumber(value: 0)) }
                    case HMCharacteristicTypeTargetHeaterCoolerState:
                        if let m = mode, m != "off" { write(ch, NSNumber(value: m == "heat" ? 1 : m == "cool" ? 2 : 0)) }
                    default:
                        break
                    }
                }
            }
            group.notify(queue: .main) {
                if wrote == 0 {
                    call.reject(failed > 0 ? "write-failed" : "nothing-to-change")
                } else {
                    call.resolve(["count": targets.count, "names": targets.map { $0.0.name.isEmpty ? $0.1.name : $0.0.name }, "failed": failed])
                }
            }
        }
    }
}
