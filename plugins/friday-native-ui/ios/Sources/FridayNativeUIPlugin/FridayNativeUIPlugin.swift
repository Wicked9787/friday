import Foundation
import UIKit
import SwiftUI
import Capacitor
import LocalAuthentication
import UserNotifications

@objc(FridayNativeUIPlugin)
public final class FridayNativeUIPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FridayNativeUIPlugin"
    public let jsName = "FridayNativeUI"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "present", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dismiss", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestNotifications", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBiometricLock", returnType: CAPPluginReturnPromise)
    ]

    private var host: UIHostingController<FridayNativeRootView>?

    @objc public func present(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let show: () -> Void = { [weak self] in
                guard let self else { call.reject("Friday native UI unavailable"); return }
                guard let presenter = self.bridge?.viewController else {
                    call.reject("No active iOS view controller")
                    return
                }
                if self.host != nil {
                    call.resolve(["presented": true, "alreadyVisible": true])
                    return
                }
                let view = FridayNativeRootView { [weak self] id, text in
                    self?.notifyListeners("command", data: ["id": id, "text": text])
                } onClose: { [weak self] in
                    self?.dismissPresented()
                }
                let controller = UIHostingController(rootView: view)
                controller.modalPresentationStyle = .fullScreen
                controller.view.backgroundColor = UIColor.black
                self.host = controller
                presenter.present(controller, animated: true) {
                    call.resolve(["presented": true])
                }
            }

            if UserDefaults.standard.bool(forKey: "friday.native.biometricLock") {
                let context = LAContext()
                var error: NSError?
                guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
                    call.reject("Device authentication is unavailable")
                    return
                }
                context.evaluatePolicy(.deviceOwnerAuthentication,
                    localizedReason: "Unlock Friday") { success, authError in
                    DispatchQueue.main.async {
                        guard success else {
                            call.reject(authError?.localizedDescription ?? "Authentication cancelled")
                            return
                        }
                        show()
                    }
                }
            } else {
                show()
            }
        }
    }

    @objc public func dismiss(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.dismissPresented()
            call.resolve(["dismissed": true])
        }
    }

    @objc public func requestNotifications(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            DispatchQueue.main.async {
                if let error {
                    call.reject(error.localizedDescription)
                } else {
                    call.resolve(["granted": granted])
                }
            }
        }
    }

    @objc public func setBiometricLock(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        if enabled {
            let context = LAContext()
            var error: NSError?
            guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
                call.reject(error?.localizedDescription ?? "Device authentication unavailable")
                return
            }
            context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Enable Friday app lock") { success, authError in
                DispatchQueue.main.async {
                    guard success else {
                        call.reject(authError?.localizedDescription ?? "Authentication cancelled")
                        return
                    }
                    UserDefaults.standard.set(true, forKey: "friday.native.biometricLock")
                    call.resolve(["enabled": true])
                }
            }
        } else {
            UserDefaults.standard.set(false, forKey: "friday.native.biometricLock")
            call.resolve(["enabled": false])
        }
    }

    private func dismissPresented() {
        host?.dismiss(animated: true)
        host = nil
    }
}

private enum FridayNativeTheme {
    static let background = Color(red: 0.025, green: 0.031, blue: 0.039)
    static let panel = Color(red: 0.075, green: 0.085, blue: 0.095)
    static let gold = Color(red: 0.84, green: 0.70, blue: 0.43)
    static let silver = Color(red: 0.77, green: 0.81, blue: 0.85)
    static let muted = Color(red: 0.48, green: 0.52, blue: 0.57)
    static let line = Color.white.opacity(0.09)
}

private struct FridayNativeAction: Identifiable {
    let key: String
    let title: String
    let icon: String
    var id: String { key }
}

private struct FridayNativeRootView: View {
    let command: (String, String) -> Void
    let close: () -> Void

    @State private var tab = 0
    @State private var message = ""
    @State private var notifications = false
    @State private var biometricLock = UserDefaults.standard.bool(forKey: "friday.native.biometricLock")
    @State private var status = "NATIVE INTERFACE READY"

    var body: some View {
        ZStack {
            FridayNativeTheme.background.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                TabView(selection: $tab) {
                    home.tag(0)
                    commandCenter.tag(1)
                    memory.tag(2)
                    systems.tag(3)
                    settings.tag(4)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                bottomBar
            }
        }
        .preferredColorScheme(.dark)
        .statusBarHidden(false)
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 3) {
                Text("F.R.I.D.A.Y.")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .tracking(3.2)
                    .foregroundStyle(FridayNativeTheme.gold)
                Text("PERSONAL INTELLIGENCE")
                    .font(.system(size: 8, weight: .semibold, design: .monospaced))
                    .tracking(2)
                    .foregroundStyle(FridayNativeTheme.muted)
            }
            Spacer()
            HStack(spacing: 6) {
                Circle().fill(.green).frame(width: 6, height: 6)
                Text("ONLINE").font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundStyle(.green)
            }
            Button(action: close) {
                Image(systemName: "arrow.down.right.and.arrow.up.left")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(FridayNativeTheme.silver)
                    .frame(width: 34, height: 34)
                    .background(FridayNativeTheme.panel, in: Circle())
            }
            .accessibilityLabel("Return to Friday classic interface")
        }
        .padding(.horizontal, 22)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }

    private var home: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 22) {
                VStack(spacing: 7) {
                    FridayNativeOrb()
                        .frame(height: 220)
                        .padding(.top, 5)
                    Text("Good to see you.")
                        .font(.system(size: 23, weight: .medium, design: .rounded))
                        .foregroundStyle(.white)
                    Text(status)
                        .font(.system(size: 9, weight: .medium, design: .monospaced))
                        .tracking(1.5)
                        .foregroundStyle(FridayNativeTheme.muted)
                }
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 11) {
                    actionTile("Talk", "mic.fill", "voice")
                    actionTile("Home", "lightbulb", "home")
                    actionTile("Vision", "camera", "vision")
                    actionTile("Neural", "point.3.connected.trianglepath.dotted", "neural")
                    actionTile("Memory", "brain.head.profile", "memory")
                    actionTile("Schedule", "calendar", "schedule")
                }
                VStack(alignment: .leading, spacing: 13) {
                    sectionTitle("SYSTEM OVERVIEW", trailing: "4.2.3 ENGINE")
                    statusRow("AI brain router", "Existing engine", true)
                    statusRow("Personality + memory", "Preserved", true)
                    statusRow("Voice recognition", "Native speech plugin", true)
                    statusRow("HomeKit / AiDot", "Existing integrations", true)
                    statusRow("SwiftUI interface", "Active", true)
                }
                .padding(17)
                .nativeCard()
                Button { tab = 1 } label: {
                    Label("Open command center", systemImage: "terminal")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(FridayNativeTheme.gold)
                        .frame(maxWidth: .infinity)
                        .padding(15)
                        .nativeCard()
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
    }

    private var commandCenter: some View {
        VStack(spacing: 18) {
            pageHeading("COMMAND CENTER", subtitle: "Send requests to Friday's existing intelligence.")
            VStack(spacing: 10) {
                ForEach([
                    FridayNativeAction(key: "message", title: "Talk to Friday", icon: "bubble.left.and.bubble.right"),
                    FridayNativeAction(key: "voice", title: "Start live listening", icon: "waveform"),
                    FridayNativeAction(key: "home", title: "Control my Home", icon: "house"),
                    FridayNativeAction(key: "vision", title: "Open camera", icon: "camera"),
                    FridayNativeAction(key: "neural", title: "Open neural map", icon: "point.3.connected.trianglepath.dotted"),
                    FridayNativeAction(key: "settings", title: "Open settings", icon: "gearshape")
                ]) { item in
                    Button { command(item.key, "") } label: {
                        HStack(spacing: 13) {
                            Image(systemName: item.icon).foregroundStyle(FridayNativeTheme.gold).frame(width: 25)
                            Text(item.title).foregroundStyle(.white)
                            Spacer()
                            Image(systemName: "chevron.right").font(.system(size: 10)).foregroundStyle(FridayNativeTheme.muted)
                        }
                        .padding(15)
                        .nativeCard()
                    }
                }
            }
            Spacer(minLength: 10)
            HStack(spacing: 10) {
                TextField("Ask Friday anything...", text: $message, axis: .vertical)
                    .lineLimit(1...4)
                    .font(.system(size: 14))
                    .foregroundStyle(.white)
                    .tint(FridayNativeTheme.gold)
                Button {
                    let text = message.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !text.isEmpty else { return }
                    command("send", text)
                    message = ""
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 27))
                        .foregroundStyle(FridayNativeTheme.gold)
                }
            }
            .padding(13)
            .nativeCard()
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 22)
    }

    private var memory: some View {
        VStack(spacing: 18) {
            pageHeading("MEMORY & IDENTITY", subtitle: "Your existing memory and persona remain in Friday's original storage.")
            featureCard("Memory", "Search and manage existing memories, notes and chat history.", "brain") {
                command("send", "What do you remember?")
            }
            featureCard("Personality", "Open Friday's existing personality and reflection tools.", "sparkles") {
                command("send", "Open your personality and reflection settings.")
            }
            featureCard("Neural map", "Explore existing connected concepts and activity.", "point.3.connected.trianglepath.dotted") {
                command("neural", "")
            }
            featureCard("Backup & restore", "Use Friday's existing backup and Keychain recovery system.", "externaldrive") {
                command("settings", "")
            }
            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
    }

    private var systems: some View {
        ScrollView {
            VStack(spacing: 12) {
                pageHeading("CONNECTED SYSTEMS", subtitle: "Native capabilities already present in the project.")
                featureCard("Voice", "Speech recognition, Whisper fallback and iOS speech output.", "waveform") {
                    command("voice", "")
                }
                featureCard("Apple Home", "HomeKit lights, accessories, scenes and room controls.", "house") {
                    command("home", "")
                }
                featureCard("AiDot + Apple TV", "Direct local-network light and television integrations.", "lightbulb") {
                    command("send", "Show my Home and Apple TV controls.")
                }
                featureCard("Calendar + reminders", "Existing calendar and reminder integrations.", "calendar") {
                    command("send", "What's on my calendar today?")
                }
                featureCard("Notifications", "Enable iOS alerts for Friday's reminders and updates.", "bell") {
                    requestNotifications()
                }
                featureCard("Camera + photos", "Existing photo tools and camera development path.", "camera") {
                    command("vision", "")
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 24)
        }
    }

    private var settings: some View {
        Form {
            Section("FRIDAY NATIVE") {
                Toggle("Require Face ID / device passcode", isOn: $biometricLock)
                    .tint(FridayNativeTheme.gold)
                    .onChange(of: biometricLock) { _, enabled in
                        command("biometric", enabled ? "enable" : "disable")
                    }
                Button("Request notification permission") { requestNotifications() }
                    .foregroundStyle(FridayNativeTheme.gold)
                Button("Return to original Friday interface") { close() }
                    .foregroundStyle(FridayNativeTheme.gold)
            }
            Section("PRESERVATION") {
                Label("Original AI engines retained", systemImage: "checkmark.shield")
                Label("Existing memory and persona retained", systemImage: "brain")
                Label("Existing native plugins retained", systemImage: "puzzlepiece.extension")
                Label("Existing backup system retained", systemImage: "externaldrive")
            }
            Section("ABOUT") {
                LabeledContent("Native shell", value: "SwiftUI 1.0")
                LabeledContent("Existing Friday engine", value: "4.2.3")
                LabeledContent("Minimum iOS", value: "17.0")
            }
        }
        .scrollContentBackground(.hidden)
        .background(FridayNativeTheme.background)
        .tint(FridayNativeTheme.gold)
    }

    private func actionTile(_ title: String, _ icon: String, _ id: String) -> some View {
        Button {
            command(id, "")
        } label: {
            VStack(spacing: 9) {
                Image(systemName: icon).font(.system(size: 21)).foregroundStyle(FridayNativeTheme.gold)
                Text(title).font(.system(size: 11, weight: .medium)).foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 83)
            .nativeCard()
        }
    }

    private func featureCard(_ title: String, _ detail: String, _ icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 13) {
                Image(systemName: icon).font(.system(size: 19)).foregroundStyle(FridayNativeTheme.gold).frame(width: 28)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                    Text(detail).font(.system(size: 11)).foregroundStyle(FridayNativeTheme.muted).multilineTextAlignment(.leading)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 10)).foregroundStyle(FridayNativeTheme.muted)
            }
            .padding(15)
            .nativeCard()
        }
    }

    private func pageHeading(_ title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.system(size: 13, weight: .bold, design: .monospaced)).tracking(2).foregroundStyle(FridayNativeTheme.gold)
            Text(subtitle).font(.system(size: 12)).foregroundStyle(FridayNativeTheme.muted)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 5)
    }

    private func sectionTitle(_ title: String, trailing: String) -> some View {
        HStack {
            Text(title).font(.system(size: 10, weight: .bold, design: .monospaced)).tracking(1.4).foregroundStyle(FridayNativeTheme.gold)
            Spacer()
            Text(trailing).font(.system(size: 8, weight: .medium, design: .monospaced)).foregroundStyle(FridayNativeTheme.muted)
        }
    }

    private func statusRow(_ title: String, _ value: String, _ ok: Bool) -> some View {
        HStack {
            Text(title).font(.system(size: 12)).foregroundStyle(.white.opacity(0.85))
            Spacer()
            Text(value).font(.system(size: 10)).foregroundStyle(ok ? .green : FridayNativeTheme.muted)
        }
    }

    private func requestNotifications() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            DispatchQueue.main.async {
                notifications = granted
                status = granted ? "NOTIFICATIONS ENABLED" : "NOTIFICATION ACCESS NOT GRANTED"
            }
        }
    }

    private var bottomBar: some View {
        HStack(spacing: 0) {
            tabButton("Home", "house.fill", 0)
            tabButton("Command", "waveform", 1)
            tabButton("Memory", "brain.head.profile", 2)
            tabButton("Systems", "square.grid.2x2", 3)
            tabButton("Settings", "gearshape", 4)
        }
        .padding(.top, 10)
        .padding(.bottom, 8)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) { Rectangle().fill(FridayNativeTheme.line).frame(height: 1) }
    }

    private func tabButton(_ title: String, _ icon: String, _ index: Int) -> some View {
        Button {
            withAnimation(.spring(response: 0.34, dampingFraction: 0.82)) { tab = index }
        } label: {
            VStack(spacing: 5) {
                Image(systemName: icon).font(.system(size: 17))
                Text(title).font(.system(size: 8, weight: .medium))
            }
            .foregroundStyle(tab == index ? FridayNativeTheme.gold : FridayNativeTheme.muted)
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
    }
}

private struct FridayNativeOrb: View {
    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { timeline in
            let time = timeline.date.timeIntervalSinceReferenceDate
            Canvas { context, size in
                let c = CGPoint(x: size.width / 2, y: size.height / 2)
                let radius = min(size.width, size.height) * 0.39
                let glow = Path(ellipseIn: CGRect(x: c.x-radius*1.45, y: c.y-radius*1.45, width: radius*2.9, height: radius*2.9))
                context.fill(glow, with: .radialGradient(Gradient(colors: [FridayNativeTheme.gold.opacity(0.18), .clear]), center: c, startRadius: 2, endRadius: radius*1.45))
                for i in 0..<180 {
                    let a = Double(i) * .pi * 2 / 180 + time * (i.isMultiple(of: 2) ? 0.13 : -0.09)
                    let r = radius * (0.72 + 0.22 * sin(time * 0.7 + Double(i) * 0.17))
                    let p = CGPoint(x: c.x + cos(a)*r, y: c.y + sin(a)*r)
                    let rect = CGRect(x: p.x, y: p.y, width: 1.6, height: 1.6)
                    context.fill(Path(ellipseIn: rect), with: .color(i.isMultiple(of: 3) ? FridayNativeTheme.gold.opacity(0.9) : FridayNativeTheme.silver.opacity(0.72)))
                }
                let core = Path(ellipseIn: CGRect(x: c.x-radius*0.54, y: c.y-radius*0.54, width: radius*1.08, height: radius*1.08))
                context.fill(core, with: .radialGradient(Gradient(colors: [Color.white.opacity(0.18), Color(red: 0.12, green: 0.13, blue: 0.15), .black]), center: CGPoint(x: c.x-radius*0.16, y: c.y-radius*0.2), startRadius: 1, endRadius: radius*0.58))
                let ring = Path(ellipseIn: CGRect(x: c.x-radius*0.88, y: c.y-radius*0.88, width: radius*1.76, height: radius*1.76))
                context.stroke(ring, with: .color(FridayNativeTheme.gold.opacity(0.58)), lineWidth: 0.8)
            }
        }
        .accessibilityLabel("Friday's animated particle orb")
    }
}

private extension View {
    func nativeCard() -> some View {
        background(FridayNativeTheme.panel.opacity(0.82), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(FridayNativeTheme.line, lineWidth: 1))
    }
}
