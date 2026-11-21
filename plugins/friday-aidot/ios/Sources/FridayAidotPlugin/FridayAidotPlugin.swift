import Foundation
import Capacitor
import Network
import Security
import CommonCrypto

/// Friday's AiDot lights add-on.
///   Sign in once with the AiDot account (email + password). The password and the
///   light keys stay in this iPhone's Keychain; the web side never sees them.
///   Lights are then switched straight over home Wi-Fi (the same local protocol the
///   Home Assistant AiDot integration uses): on/off, exact brightness, warm/cool white
///   and colors. Away from home it fails fast and the app uses Apple Home or the Shortcut.
@objc(FridayAidotPlugin)
public class FridayAidotPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FridayAidotPlugin"
    public let jsName = "FridayAidot"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "refresh", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "control", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "state", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "find", returnType: CAPPluginReturnPromise)
    ]

    static func reason(_ error: Error) -> String {
        if let e = error as? AidotError { return e.code }
        if let e = error as? ApiError {
            if e.code == 560080 { return "wrong-password" }
            return "server-\(e.code)-\(e.status)" + (e.message.isEmpty ? "" : ": " + e.message)
        }
        if error is URLError { return "network" }
        return "\(error)"
    }

    @objc func status(_ call: CAPPluginCall) {
        Task {
            let s = await AidotCore.shared.status()
            call.resolve(s)
        }
    }

    @objc func signIn(_ call: CAPPluginCall) {
        let user = (call.getString("username") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let pass = call.getString("password") ?? ""
        let country = call.getString("country") ?? "United States"
        let region = (call.getString("region") ?? "us").lowercased()
        if user.isEmpty || pass.isEmpty {
            call.reject("missing")
            return
        }
        Task {
            do {
                let s = try await AidotCore.shared.signIn(country: country, region: region, username: user, password: pass)
                call.resolve(s)
            } catch {
                call.reject(FridayAidotPlugin.reason(error))
            }
        }
    }

    @objc func signOut(_ call: CAPPluginCall) {
        Task {
            await AidotCore.shared.signOut()
            call.resolve(["signedIn": false])
        }
    }

    @objc func refresh(_ call: CAPPluginCall) {
        Task {
            do {
                let s = try await AidotCore.shared.refresh()
                call.resolve(s)
            } catch {
                call.reject(FridayAidotPlugin.reason(error))
            }
        }
    }

    @objc func control(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        var a = Attr()
        if let on = call.getBool("on") { a.on = on ? 1 : 0 }
        if let b = call.getInt("brightness") { a.dim = max(0, min(100, b)) }
        if let k = call.getInt("cct") { a.cct = k }
        if let rgb = call.getArray("rgb", Int.self), rgb.count >= 3 {
            let r = UInt32(max(0, min(255, rgb[0])))
            let g = UInt32(max(0, min(255, rgb[1])))
            let b = UInt32(max(0, min(255, rgb[2])))
            let w = UInt32(rgb.count > 3 ? max(0, min(255, rgb[3])) : 0)
            a.rgbw = Int32(bitPattern: (r << 24) | (g << 16) | (b << 8) | w)
        }
        Task {
            let out = await AidotCore.shared.control(ids: ids, attr: a)
            call.resolve(out)
        }
    }

    @objc func state(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        Task {
            let out = await AidotCore.shared.control(ids: ids, attr: nil)
            call.resolve(out)
        }
    }

    @objc func find(_ call: CAPPluginCall) {
        Task {
            let out = await AidotCore.shared.find()
            call.resolve(out)
        }
    }
}

// MARK: - Small types

struct AidotError: Error {
    let code: String
    init(_ c: String) { code = c }
}

struct ApiError: Error {
    let status: Int
    let code: Int
    let message: String
}

/// What to change on a light. nil fields are left alone.
struct Attr: Sendable {
    var on: Int?
    var dim: Int?
    var cct: Int?
    var rgbw: Int32?
}

/// Everything the Wi-Fi side needs for one light (no dictionaries, so it can cross tasks).
struct Dev: Sendable {
    let id: String
    let name: String
    let key: Data
    let password: String?
    let simple: Bool
    let cctMin: Int
    let cctMax: Int
}

struct LanResult: Sendable {
    let id: String
    let ok: Bool
    let reason: String
    let ip: String
    let on: Int?
    let dim: Int?
}

func str(_ v: Any?) -> String? {
    if let s = v as? String { return s.isEmpty ? nil : s }
    if let n = v as? NSNumber { return n.stringValue }
    return nil
}

func num(_ v: Any?) -> Int? {
    if let n = v as? NSNumber { return n.intValue }
    if let s = v as? String {
        if let i = Int(s) { return i }
        if let d = Double(s) { return Int(d) }
    }
    return nil
}

func orNull(_ s: String?) -> Any {
    if let s = s { return s }
    return NSNull()
}

func isIPv4(_ s: String) -> Bool {
    let parts = s.split(separator: ".")
    if parts.count != 4 { return false }
    for p in parts {
        guard let n = Int(p), n >= 0, n <= 255 else { return false }
    }
    return true
}

func nowMs() -> Int64 {
    return Int64(Date().timeIntervalSince1970 * 1000)
}

// MARK: - Crypto

func aesCrypt(_ input: Data, key: Data, encrypt: Bool) -> Data? {
    let keyLen = key.count
    if keyLen != kCCKeySizeAES128 && keyLen != kCCKeySizeAES192 && keyLen != kCCKeySizeAES256 { return nil }
    let outCap = input.count + kCCBlockSizeAES128
    var out = Data(count: outCap)
    var outLen = 0
    let status: CCCryptorStatus = out.withUnsafeMutableBytes { outPtr in
        input.withUnsafeBytes { inPtr in
            key.withUnsafeBytes { keyPtr in
                CCCrypt(CCOperation(encrypt ? kCCEncrypt : kCCDecrypt),
                        CCAlgorithm(kCCAlgorithmAES),
                        CCOptions(kCCOptionPKCS7Padding | kCCOptionECBMode),
                        keyPtr.baseAddress, keyLen,
                        nil,
                        inPtr.baseAddress, input.count,
                        outPtr.baseAddress, outCap,
                        &outLen)
            }
        }
    }
    if Int(status) != Int(kCCSuccess) { return nil }
    out.count = outLen
    return out
}

/// The light's key: its text, zero-padded to 16 bytes (as the AiDot app does).
func deviceKey(_ s: String) -> Data {
    var k = Data(s.utf8)
    if k.count < 16 { k.append(Data(count: 16 - k.count)) }
    return k
}

let discoverKey: Data = {
    var k = Data("T54uednca587".utf8)
    k.append(Data(count: 32 - k.count))
    return k
}()

/// AiDot's public key (PKCS#1), used only to encrypt the password for sign-in.
let aidotPublicKey = "MIGJAoGBAK1ACc8KLySw+dLUO7rP3o+wp82nYan9/9sfCWsB2mVtfenv9OcamdskaQury5HF/pzD6862FOxmOQ8IXsJq1G9GdONz19zLvITShdrlOWhjJcPoaTGB+0Fs3+ai+QkkZAJzuAVq+5igB1NEE7JChcG2bSaRcxKNc6V0j/b3Rv0FAgMBAAE="

func rsaEncrypt(_ text: String) -> String? {
    guard let der = Data(base64Encoded: aidotPublicKey) else { return nil }
    let attrs: [String: Any] = [
        kSecAttrKeyType as String: kSecAttrKeyTypeRSA,
        kSecAttrKeyClass as String: kSecAttrKeyClassPublic,
        kSecAttrKeySizeInBits as String: 1024
    ]
    var err: Unmanaged<CFError>?
    guard let key = SecKeyCreateWithData(der as CFData, attrs as CFDictionary, &err) else { return nil }
    guard let enc = SecKeyCreateEncryptedData(key, .rsaEncryptionPKCS1, Data(text.utf8) as CFData, &err) else { return nil }
    return (enc as Data).base64EncodedString()
}

// MARK: - Keychain (with a protected file as a fallback)

enum Vault {
    static let service = "friday.aidot"

    private static func fileURL(_ name: String) -> URL? {
        guard let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return nil }
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("aidot-" + name + ".json")
    }

    static func save(_ name: String, _ obj: Any) {
        guard let data = try? JSONSerialization.data(withJSONObject: obj) else { return }
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: name
        ]
        SecItemDelete(q as CFDictionary)
        var add = q
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        if SecItemAdd(add as CFDictionary, nil) == errSecSuccess {
            if let u = fileURL(name) { try? FileManager.default.removeItem(at: u) }
            return
        }
        if let u = fileURL(name) {
            try? data.write(to: u, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
    }

    static func load(_ name: String) -> Any? {
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: name,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var out: CFTypeRef?
        if SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data {
            return try? JSONSerialization.jsonObject(with: d)
        }
        if let u = fileURL(name), let d = try? Data(contentsOf: u) {
            return try? JSONSerialization.jsonObject(with: d)
        }
        return nil
    }

    static func remove(_ name: String) {
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: name
        ]
        SecItemDelete(q as CFDictionary)
        if let u = fileURL(name) { try? FileManager.default.removeItem(at: u) }
    }
}

// MARK: - Cloud account and light list

actor AidotCore {
    static let shared = AidotCore()
    static let appId = "1383974540041977857"

    private var account: [String: Any]?
    private var devices: [[String: Any]] = []
    private var found: [String: String] = [:]
    private var homeNet: String = ""
    private var loaded = false

    private func load() {
        if loaded { return }
        loaded = true
        account = Vault.load("account") as? [String: Any]
        devices = (Vault.load("devices") as? [[String: Any]]) ?? []
        if let f = Vault.load("found") as? [String: Any] {
            var m: [String: String] = [:]
            for (k, v) in f { if let s = v as? String { m[k] = s } }
            found = m
            homeNet = (f["_net"] as? String) ?? ""
        }
    }

    private func saveAccount() {
        if let a = account { Vault.save("account", a) }
    }

    private func saveFound() {
        var f: [String: Any] = [:]
        for (k, v) in found { f[k] = v }
        f["_net"] = homeNet
        Vault.save("found", f)
    }

    private func base(_ region: String) -> String {
        return "https://prod-\(region)-api.arnoo.com/v35"
    }

    private func newTerminal() -> String {
        return UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
    }

    private func mask(_ email: String) -> String {
        let parts = email.split(separator: "@", maxSplits: 1).map(String.init)
        guard let first = parts.first, !first.isEmpty else { return "" }
        let shown = String(first.prefix(2))
        return shown + "•••" + (parts.count > 1 ? "@" + parts[1] : "")
    }

    // ---------- public ----------

    func status() -> [String: Any] {
        load()
        guard let a = account, str(a["userId"]) != nil else {
            return ["signedIn": false, "devices": [[String: Any]]()]
        }
        return [
            "signedIn": true,
            "user": mask((a["username"] as? String) ?? ""),
            "country": (a["country"] as? String) ?? "",
            "devices": devices.map { publicInfo($0) },
            "at": (a["syncedAt"] as? Double) ?? 0,
            "homeNet": !homeNet.isEmpty
        ]
    }

    func signIn(country: String, region: String, username: String, password: String) async throws -> [String: Any] {
        load()
        let terminal = (account?["terminal"] as? String) ?? newTerminal()
        let info = try await login(region: region, country: country, username: username, password: password, terminal: terminal)
        account = info
        saveAccount()
        try await sync()
        return status()
    }

    func signOut() {
        load()
        account = nil
        devices = []
        found = [:]
        homeNet = ""
        Vault.remove("account")
        Vault.remove("devices")
        Vault.remove("found")
    }

    func refresh() async throws -> [String: Any] {
        load()
        if account == nil { throw AidotError("signed-out") }
        try await sync()
        return status()
    }

    /// Finds the lights on this Wi-Fi again (for when a light got a new address).
    func find() async -> [String: Any] {
        load()
        guard let uid = str(account?["userId"]) else { return ["found": 0, "total": 0, "reason": "signed-out"] }
        guard let net = Net.local() else { return ["found": 0, "total": devices.count, "reason": "no-wifi"] }
        let hits = await Net.sweep(userId: uid, net: net, wait: 2.0)
        let known = Set(devices.compactMap { str($0["id"]) })
        var n = 0
        for (id, ip) in hits where known.contains(id) {
            found[id] = ip
            n += 1
        }
        if n > 0 { homeNet = net.key }
        saveFound()
        return ["found": n, "total": devices.count]
    }

    /// attr nil = just read each light's state.
    func control(ids: [String], attr: Attr?) async -> [String: Any] {
        load()
        guard let uid = str(account?["userId"]) else {
            return ["done": [[String: Any]](), "failed": [["id": "", "name": "", "reason": "signed-out"]]]
        }
        var targets: [[String: Any]]
        if ids.isEmpty {
            targets = devices.filter { (d: [String: Any]) -> Bool in AidotCore.isLight(d) }
        } else {
            let want = Set(ids)
            targets = devices.filter { (d: [String: Any]) -> Bool in want.contains(str(d["id"]) ?? "") }
        }
        targets = targets.filter { (d: [String: Any]) -> Bool in (d["aesKey"] as? String) != nil }
        if targets.isEmpty {
            return ["done": [[String: Any]](), "failed": [["id": "", "name": "", "reason": "no-lights"]]]
        }
        guard let net = Net.local() else {
            return ["done": [[String: Any]](), "failed": AidotCore.failList(targets, "no-wifi"), "away": true]
        }
        // Worked at home before, and this Wi-Fi is a different network: don't wait, let Apple Home / the Shortcut do it.
        if !homeNet.isEmpty && homeNet != net.key {
            return ["done": [[String: Any]](), "failed": AidotCore.failList(targets, "away"), "away": true]
        }

        var devs: [Dev] = []
        var ipFor: [String: String] = [:]
        for d in targets {
            guard let id = str(d["id"]), let k = d["aesKey"] as? String else { continue }
            devs.append(Dev(id: id, name: (d["name"] as? String) ?? "Light", key: deviceKey(k), password: d["password"] as? String,
                            simple: (d["simple"] as? Bool) ?? false, cctMin: (d["cctMin"] as? Int) ?? 2700, cctMax: (d["cctMax"] as? Int) ?? 6500))
            if let ip = found[id] ?? (d["ip"] as? String) { ipFor[id] = ip }
        }

        var results: [String: LanResult] = [:]
        let withIp = devs.filter { (d: Dev) -> Bool in ipFor[d.id] != nil }
        let first = await Lan.runAll(withIp, ips: ipFor, userId: uid, attr: attr)
        for r in first { results[r.id] = r }

        // Anything without an address, or that didn't answer: look for it on this Wi-Fi, then try once more.
        let missing = devs.filter { (d: Dev) -> Bool in
            guard let r = results[d.id] else { return true }
            return !r.ok && (r.reason.hasPrefix("unreachable") || r.reason == "timeout" || r.reason.hasPrefix("closed") || r.reason.hasPrefix("read"))
        }
        if !missing.isEmpty {
            let hits = await Net.sweep(userId: uid, net: net, wait: 1.6)
            var retry: [Dev] = []
            for d in missing {
                if let ip = hits[d.id] {
                    found[d.id] = ip
                    if ip != results[d.id]?.ip || results[d.id] == nil {
                        ipFor[d.id] = ip
                        retry.append(d)
                    }
                } else if results[d.id] == nil {
                    results[d.id] = LanResult(id: d.id, ok: false, reason: "not-found", ip: "", on: nil, dim: nil)
                }
            }
            if !retry.isEmpty {
                let second = await Lan.runAll(retry, ips: ipFor, userId: uid, attr: attr)
                for r in second { results[r.id] = r }
            }
        }

        var done: [[String: Any]] = []
        var failed: [[String: Any]] = []
        for d in devs {
            guard let r = results[d.id] else { continue }
            if r.ok {
                found[d.id] = r.ip
                var o: [String: Any] = ["id": d.id, "name": d.name]
                if let v = r.on { o["on"] = v != 0 }
                if let v = r.dim { o["brightness"] = v }
                done.append(o)
            } else {
                failed.append(["id": d.id, "name": d.name, "reason": r.reason])
            }
        }
        if !done.isEmpty { homeNet = net.key }
        saveFound()
        return ["done": done, "failed": failed]
    }

    // ---------- cloud ----------

    private func http(_ method: String, _ url: String, body: Any?, token: String?) async throws -> Any {
        guard let u = URL(string: url) else { throw AidotError("bad-url") }
        var req = URLRequest(url: u)
        req.httpMethod = method
        req.timeoutInterval = 15
        req.setValue(AidotCore.appId, forHTTPHeaderField: "Appid")
        req.setValue("app", forHTTPHeaderField: "Terminal")
        if let t = token { req.setValue(t, forHTTPHeaderField: "Token") }
        if let b = body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: b)
        }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        let json = try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
        if status >= 200 && status < 300, let j = json { return j }
        let d = json as? [String: Any]
        let msg = (d?["message"] as? String) ?? (d?["msg"] as? String) ?? ""
        throw ApiError(status: status, code: num(d?["code"]) ?? 0, message: String(msg.prefix(120)))
    }

    private func login(region: String, country: String, username: String, password: String, terminal: String) async throws -> [String: Any] {
        guard let enc = rsaEncrypt(password) else { throw AidotError("crypto") }
        let body: [String: Any] = [
            "countryKey": "region:" + country.trimmingCharacters(in: .whitespaces),
            "username": username,
            "password": enc,
            "terminalId": terminal,
            "webVersion": "0.5.0",
            "area": "Asia/Shanghai",
            "UTC": "UTC+8"
        ]
        let r = try await http("POST", base(region) + "/users/loginWithFreeVerification", body: body, token: nil)
        guard let j = r as? [String: Any] else { throw AidotError("login-failed") }
        if num(j["code"]) == 560080 { throw AidotError("wrong-password") }
        guard let uid = str(j["id"]), let at = str(j["accessToken"]) else {
            let msg = (j["message"] as? String) ?? (j["msg"] as? String) ?? ""
            throw AidotError("login-failed" + (msg.isEmpty ? "" : ": " + String(msg.prefix(120))))
        }
        var out: [String: Any] = account ?? [:]
        out["region"] = region
        out["country"] = country
        out["username"] = username
        out["password"] = password
        out["terminal"] = terminal
        out["userId"] = uid
        out["accessToken"] = at
        out["refreshToken"] = str(j["refreshToken"]) ?? ""
        return out
    }

    private func authed(_ method: String, _ path: String) async throws -> Any {
        guard let a = account, let region = a["region"] as? String else { throw AidotError("signed-out") }
        let url = base(region) + path
        do {
            return try await http(method, url, body: nil, token: a["accessToken"] as? String)
        } catch let e as ApiError where e.code == 21026 || e.code == 21025 || e.code == 21027 || e.code == 21041 || e.status == 401 {
            var b = a
            var fresh = false
            if e.code == 21026, let rt = a["refreshToken"] as? String, !rt.isEmpty {
                let rr = try? await http("POST", base(region) + "/users/refreshToken", body: ["refreshToken": rt], token: nil)
                if let r = rr as? [String: Any], let at = str(r["accessToken"]) {
                    b["accessToken"] = at
                    if let nrt = str(r["refreshToken"]) { b["refreshToken"] = nrt }
                    fresh = true
                }
            }
            if !fresh {
                b = try await login(region: region,
                                    country: (a["country"] as? String) ?? "United States",
                                    username: (a["username"] as? String) ?? "",
                                    password: (a["password"] as? String) ?? "",
                                    terminal: (a["terminal"] as? String) ?? newTerminal())
            }
            account = b
            saveAccount()
            return try await http(method, url, body: nil, token: b["accessToken"] as? String)
        }
    }

    private func sync() async throws {
        let houses = (try await authed("GET", "/houses")) as? [[String: Any]] ?? []
        var mine: [[String: Any]] = []
        var shared: [[String: Any]] = []
        for h in houses {
            guard let hid = str(h["id"]) else { continue }
            let q = hid.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? hid
            let devs = (try? await authed("GET", "/devices?houseId=" + q)) as? [[String: Any]] ?? []
            let owner = (h["isOwner"] as? Bool) ?? true
            for var d in devs {
                d["_house"] = (h["name"] as? String) ?? ""
                if owner { mine.append(d) } else { shared.append(d) }
            }
        }
        let list = mine.isEmpty ? shared : mine

        var products: [String: [String: Any]] = [:]
        let pids = Array(Set(list.compactMap { str($0["productId"]) }))
        if !pids.isEmpty {
            let pr = (try? await authed("GET", "/products/" + pids.joined(separator: ","))) as? [[String: Any]] ?? []
            for p in pr { if let id = str(p["id"]) { products[id] = p } }
        }

        var out: [[String: Any]] = []
        for d in list {
            guard let id = str(d["id"]) else { continue }
            var s: [String: Any] = [
                "id": id,
                "name": (d["name"] as? String) ?? "Light",
                "type": (d["type"] as? String) ?? "",
                "model": (d["modelId"] as? String) ?? ""
            ]
            if let keys = d["aesKey"] as? [Any], let k = keys.first as? String, !k.isEmpty { s["aesKey"] = k }
            if let pw = d["password"] as? String { s["password"] = pw }
            if let sv = d["simpleVersion"], !(sv is NSNull) { s["simple"] = true }
            if let props = d["properties"] as? [String: Any], let ip = props["ipAddress"] as? String, isIPv4(ip) { s["ip"] = ip }
            let roomObj = d["room"] as? [String: Any]
            s["room"] = (d["roomName"] as? String) ?? (roomObj?["name"] as? String) ?? ""
            s["house"] = (d["_house"] as? String) ?? ""
            var rgb = false
            var cct = false
            var cmin = 2700
            var cmax = 6500
            if let pid = str(d["productId"]), let p = products[pid], let mods = p["serviceModules"] as? [[String: Any]] {
                for m in mods {
                    let ident = (m["identity"] as? String) ?? ""
                    if ident == "control.light.rgbw" {
                        rgb = true
                        cct = true
                    } else if ident == "control.light.cct" {
                        cct = true
                        if let first = (m["properties"] as? [[String: Any]])?.first {
                            if let v = num(first["minValue"]) { cmin = v }
                            if let v = num(first["maxValue"]) { cmax = v }
                        }
                    }
                }
            }
            s["rgb"] = rgb
            s["cct"] = cct
            s["cctMin"] = cmin
            s["cctMax"] = cmax
            out.append(s)
        }
        devices = out
        account?["syncedAt"] = Date().timeIntervalSince1970 * 1000
        saveAccount()
        Vault.save("devices", out)
    }

    static func failList(_ list: [[String: Any]], _ reason: String) -> [[String: Any]] {
        var out: [[String: Any]] = []
        for d in list {
            out.append(["id": str(d["id"]) ?? "", "name": (d["name"] as? String) ?? "", "reason": reason])
        }
        return out
    }

    static func isLight(_ d: [String: Any]) -> Bool {
        let t = ((d["type"] as? String) ?? "").lowercased()
        return t.isEmpty || t.contains("light") || t.contains("lamp") || t.contains("bulb")
    }

    private func publicInfo(_ d: [String: Any]) -> [String: Any] {
        let id = str(d["id"]) ?? ""
        return [
            "id": id,
            "name": (d["name"] as? String) ?? "Light",
            "room": (d["room"] as? String) ?? "",
            "house": (d["house"] as? String) ?? "",
            "type": (d["type"] as? String) ?? "",
            "rgb": (d["rgb"] as? Bool) ?? false,
            "cct": (d["cct"] as? Bool) ?? false,
            "cctMin": (d["cctMin"] as? Int) ?? 2700,
            "cctMax": (d["cctMax"] as? Int) ?? 6500,
            "lan": (d["aesKey"] as? String) != nil,
            "hasIp": (found[id] ?? (d["ip"] as? String)) != nil
        ]
    }
}

// MARK: - Home Wi-Fi

struct LocalNet: Sendable {
    let ip: UInt32
    let mask: UInt32
    var key: String {
        let n = ip & mask
        return "\(n >> 24).\((n >> 16) & 255).\((n >> 8) & 255).\(n & 255)/\(mask.nonzeroBitCount)"
    }
}

enum Net {
    /// The iPhone's Wi-Fi address, or nil when not on Wi-Fi.
    static func local() -> LocalNet? {
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return nil }
        defer { freeifaddrs(ifaddr) }
        var p: UnsafeMutablePointer<ifaddrs>? = first
        while let cur = p {
            let ifa = cur.pointee
            if let a = ifa.ifa_addr, let m = ifa.ifa_netmask, a.pointee.sa_family == UInt8(AF_INET),
               String(cString: ifa.ifa_name) == "en0" {
                let ip = a.withMemoryRebound(to: sockaddr_in.self, capacity: 1) { UInt32(bigEndian: $0.pointee.sin_addr.s_addr) }
                let mask = m.withMemoryRebound(to: sockaddr_in.self, capacity: 1) { UInt32(bigEndian: $0.pointee.sin_addr.s_addr) }
                if ip != 0 { return LocalNet(ip: ip, mask: mask) }
            }
            p = ifa.ifa_next
        }
        return nil
    }

    /// Asks every address on this Wi-Fi "are you an AiDot light?" (one small packet each,
    /// no broadcast needed) and returns [light id: address] for the ones that answer.
    static func sweep(userId: String, net: LocalNet, wait: Double) async -> [String: String] {
        return await withCheckedContinuation { (cont: CheckedContinuation<[String: String], Never>) in
            DispatchQueue.global(qos: .userInitiated).async {
                cont.resume(returning: sweepNow(userId: userId, net: net, wait: wait))
            }
        }
    }

    private static func sweepNow(userId: String, net: LocalNet, wait: Double) -> [String: String] {
        var mask = net.mask
        if mask.nonzeroBitCount < 22 { mask = 0xFFFFFF00 }
        let network = net.ip & mask
        let broadcast = network | ~mask
        if broadcast <= network + 1 { return [:] }

        let ms = nowMs()
        let req: [String: Any] = [
            "protocolVer": "2.0.0",
            "service": "device",
            "method": "devDiscoveryReq",
            "seq": String(String(ms + 1).suffix(9)),
            "srcAddr": "0." + userId,
            "tst": ms,
            "payload": ["extends": [String: Any](), "localCtrFlag": 1, "timestamp": String(ms)] as [String: Any]
        ]
        guard let json = try? JSONSerialization.data(withJSONObject: req, options: [.withoutEscapingSlashes]),
              let packet = aesCrypt(json, key: discoverKey, encrypt: true) else { return [:] }

        let fd = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP)
        if fd < 0 { return [:] }
        defer { close(fd) }

        var sent = 0
        var host = network + 1
        while host < broadcast {
            if host != net.ip {
                var addr = sockaddr_in()
                addr.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
                addr.sin_family = sa_family_t(AF_INET)
                addr.sin_port = in_port_t(6666).bigEndian
                addr.sin_addr = in_addr(s_addr: host.bigEndian)
                _ = packet.withUnsafeBytes { bytes -> Int in
                    withUnsafePointer(to: &addr) { ap -> Int in
                        ap.withMemoryRebound(to: sockaddr.self, capacity: 1) { sa -> Int in
                            sendto(fd, bytes.baseAddress, packet.count, 0, sa, socklen_t(MemoryLayout<sockaddr_in>.size))
                        }
                    }
                }
                sent += 1
                if sent % 32 == 0 { usleep(3000) }
            }
            host += 1
        }

        var result: [String: String] = [:]
        let end = Date().addingTimeInterval(wait)
        var buf = [UInt8](repeating: 0, count: 4096)
        let bufCap = buf.count
        while true {
            let left = end.timeIntervalSinceNow
            if left <= 0 { break }
            var pfd = pollfd(fd: fd, events: Int16(POLLIN), revents: 0)
            let r = poll(&pfd, 1, Int32(max(1, left * 1000)))
            if r <= 0 { break }
            var from = sockaddr_in()
            var len = socklen_t(MemoryLayout<sockaddr_in>.size)
            let n = withUnsafeMutablePointer(to: &from) { fp -> Int in
                fp.withMemoryRebound(to: sockaddr.self, capacity: 1) { sp -> Int in
                    recvfrom(fd, &buf, bufCap, 0, sp, &len)
                }
            }
            if n <= 0 { continue }
            let data = Data(buf[0..<n])
            guard let plain = aesCrypt(data, key: discoverKey, encrypt: false),
                  let j = (try? JSONSerialization.jsonObject(with: plain)) as? [String: Any],
                  let payload = j["payload"] as? [String: Any],
                  let id = str(payload["devId"]) else { continue }
            let v = UInt32(bigEndian: from.sin_addr.s_addr)
            result[id] = "\(v >> 24).\((v >> 16) & 255).\((v >> 8) & 255).\(v & 255)"
        }
        return result
    }
}

// MARK: - Talking to a light over Wi-Fi (TCP port 10000)

final class TcpLink {
    private let conn: NWConnection
    private let queue = DispatchQueue(label: "friday.aidot.tcp")
    private var buffer = Data()
    private var waitingNote = ""

    init(host: String, port: UInt16) {
        let tcp = NWProtocolTCP.Options()
        tcp.noDelay = true
        tcp.connectionTimeout = 3
        let params = NWParameters(tls: nil, tcp: tcp)
        conn = NWConnection(host: NWEndpoint.Host(host), port: NWEndpoint.Port(rawValue: port) ?? 10000, using: params)
    }

    func open(timeout: Double) async throws {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            var finished = false
            let finish: (Error?) -> Void = { e in
                if finished { return }
                finished = true
                if let e = e { cont.resume(throwing: e) } else { cont.resume() }
            }
            conn.stateUpdateHandler = { [weak self] st in
                switch st {
                case .ready:
                    finish(nil)
                case .failed(let e):
                    finish(AidotError("unreachable: \(e)"))
                case .waiting(let e):
                    self?.waitingNote = "\(e)"
                case .cancelled:
                    finish(AidotError("unreachable: cancelled"))
                default:
                    break
                }
            }
            conn.start(queue: queue)
            queue.asyncAfter(deadline: .now() + timeout) { [weak self] in
                let note = self?.waitingNote ?? ""
                finish(AidotError("unreachable: " + (note.isEmpty ? "timeout" : note)))
            }
        }
    }

    func send(_ d: Data) async throws {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            conn.send(content: d, completion: .contentProcessed { e in
                if let e = e { cont.resume(throwing: AidotError("closed: \(e)")) } else { cont.resume() }
            })
        }
    }

    private func chunk(timeout: Double) async throws -> Data {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Data, Error>) in
            var finished = false
            conn.receive(minimumIncompleteLength: 1, maximumLength: 65536) { data, _, complete, error in
                if finished { return }
                finished = true
                if let d = data, !d.isEmpty {
                    cont.resume(returning: d)
                } else if let e = error {
                    cont.resume(throwing: AidotError("read: \(e)"))
                } else if complete {
                    cont.resume(throwing: AidotError("closed"))
                } else {
                    cont.resume(returning: Data())
                }
            }
            queue.asyncAfter(deadline: .now() + timeout) {
                if finished { return }
                finished = true
                cont.resume(throwing: AidotError("timeout"))
            }
        }
    }

    func read(_ n: Int, timeout: Double) async throws -> Data {
        let end = Date().addingTimeInterval(timeout)
        while buffer.count < n {
            let left = end.timeIntervalSinceNow
            if left <= 0 { throw AidotError("timeout") }
            let d = try await chunk(timeout: left)
            buffer.append(d)
        }
        let out = Data(buffer.prefix(n))
        buffer = Data(buffer.dropFirst(n))
        return out
    }

    func close() {
        conn.cancel()
    }
}

enum Lan {
    static func runAll(_ devs: [Dev], ips: [String: String], userId: String, attr: Attr?) async -> [LanResult] {
        return await withTaskGroup(of: LanResult.self) { group -> [LanResult] in
            for d in devs {
                let ip = ips[d.id] ?? ""
                group.addTask { await Lan.run(d, ip: ip, userId: userId, attr: attr) }
            }
            var out: [LanResult] = []
            for await r in group { out.append(r) }
            return out
        }
    }

    static func frame(_ obj: [String: Any], type: UInt16, key: Data) throws -> Data {
        let json = try JSONSerialization.data(withJSONObject: obj, options: [.withoutEscapingSlashes])
        guard let enc = aesCrypt(json, key: key, encrypt: true) else { throw AidotError("crypto") }
        var d = Data([0x1E, 0xED, UInt8((type >> 8) & 0xFF), UInt8(type & 0xFF)])
        let n = UInt32(enc.count)
        d.append(contentsOf: [UInt8((n >> 24) & 0xFF), UInt8((n >> 16) & 0xFF), UInt8((n >> 8) & 0xFF), UInt8(n & 0xFF)])
        d.append(enc)
        return d
    }

    static func readMessage(_ link: TcpLink, key: Data, timeout: Double) async throws -> [String: Any] {
        let head = try await link.read(8, timeout: timeout)
        let size = (Int(head[4]) << 24) | (Int(head[5]) << 16) | (Int(head[6]) << 8) | Int(head[7])
        if size < 0 || size > 1_000_000 { throw AidotError("closed: bad size") }
        var body = Data()
        if size > 0 { body = try await link.read(size, timeout: timeout) }
        guard let plain = aesCrypt(body, key: key, encrypt: false) else { throw AidotError("bad-key") }
        guard let j = (try? JSONSerialization.jsonObject(with: plain)) as? [String: Any] else { throw AidotError("bad-reply") }
        return j
    }

    static func stamp() -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd HH:mm:ss.SSSSSS"
        return f.string(from: Date())
    }

    static func run(_ dev: Dev, ip: String, userId: String, attr: Attr?) async -> LanResult {
        if ip.isEmpty { return LanResult(id: dev.id, ok: false, reason: "unreachable: no address", ip: "", on: nil, dim: nil) }
        let link = TcpLink(host: ip, port: 10000)
        defer { link.close() }
        do {
            try await link.open(timeout: 2.5)

            // 1. log in to the light
            let loginMsg: [String: Any] = [
                "service": "device",
                "method": "loginReq",
                "seq": String(String(nowMs()).suffix(9)),
                "srcAddr": userId,
                "deviceId": dev.id,
                "payload": [
                    "userId": userId,
                    "password": orNull(dev.password),
                    "timestamp": stamp(),
                    "ascNumber": 1
                ] as [String: Any]
            ]
            try await link.send(try frame(loginMsg, type: 1, key: dev.key))
            let resp = try await readMessage(link, key: dev.key, timeout: 3.0)
            let ack = num((resp["ack"] as? [String: Any])?["code"]) ?? 0
            if ack != 200 { return LanResult(id: dev.id, ok: false, reason: "login-\(ack)", ip: ip, on: nil, dim: nil) }
            let asc = (num((resp["payload"] as? [String: Any])?["ascNumber"]) ?? 0) + 1

            // 2. send the change (or ask for the state)
            var attrObj: Any = [Any]()
            var method = "getDevAttrReq"
            if let a = attr {
                var o: [String: Any] = [:]
                if let v = a.on { o["OnOff"] = v }
                if let v = a.dim {
                    if v <= 0 { o["OnOff"] = 0 } else { o["Dimming"] = v }
                }
                if let v = a.cct { o["CCT"] = max(dev.cctMin, min(dev.cctMax, v)) }
                if let v = a.rgbw { o["RGBW"] = Int(v) }
                if o["OnOff"] == nil { o["OnOff"] = 1 }
                attrObj = o
                method = "setDevAttrReq"
            }
            var payload: [String: Any] = ["attr": attrObj, "channel": "tcp", "ascNumber": asc]
            var msg: [String: Any] = [
                "method": method,
                "service": "device",
                "srcAddr": "0." + userId,
                "seq": "ha93" + String(format: "%05d", 2),
                "tst": nowMs(),
                "deviceId": dev.id
            ]
            if dev.simple {
                payload["devId"] = dev.id
                payload["parentId"] = dev.id
                payload["userId"] = userId
                payload["password"] = orNull(dev.password)
                msg["clientId"] = "ha-" + userId
            } else {
                payload["devId"] = ""
                payload["parentId"] = ""
                payload["userId"] = ""
                payload["password"] = ""
                msg["clientId"] = ""
            }
            msg["payload"] = payload
            try await link.send(try frame(msg, type: 1, key: dev.key))

            // 3. listen briefly for the light's answer (its new state)
            var on: Int? = nil
            var dim: Int? = nil
            let end = Date().addingTimeInterval(attr == nil ? 2.0 : 1.2)
            while end.timeIntervalSinceNow > 0 {
                guard let m = try? await readMessage(link, key: dev.key, timeout: end.timeIntervalSinceNow) else { break }
                if let p = m["payload"] as? [String: Any], let at = p["attr"] as? [String: Any] {
                    if let v = num(at["OnOff"]) { on = v }
                    if let v = num(at["Dimming"]) { dim = v }
                    if on != nil { break }
                }
            }
            return LanResult(id: dev.id, ok: true, reason: "", ip: ip, on: on, dim: dim)
        } catch {
            let r = (error as? AidotError)?.code ?? "\(error)"
            return LanResult(id: dev.id, ok: false, reason: r, ip: ip, on: nil, dim: nil)
        }
    }
}
