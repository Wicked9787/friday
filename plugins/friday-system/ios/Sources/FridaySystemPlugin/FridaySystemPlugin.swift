import Foundation
import Capacitor
import UIKit
import SwiftUI
import EventKit
import Contacts
import UserNotifications
import AVFoundation

@objc(FridaySystemPlugin)
public class FridaySystemPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FridaySystemPlugin"
    public let jsName = "FridaySystem"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "deviceSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authorizationStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createReminder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createCalendarEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "findContacts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scheduleNotification", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pendingNotifications", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelNotification", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "speak", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showQuickActions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAppSettings", returnType: CAPPluginReturnPromise)
    ]

    private let eventStore = EKEventStore()
    private let contactsStore = CNContactStore()
    private let speech = AVSpeechSynthesizer()

    @objc public func deviceSnapshot(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let device = UIDevice.current
            device.isBatteryMonitoringEnabled = true
            let battery = device.batteryLevel
            let level: Any = battery < 0 ? NSNull() : NSNumber(value: Int((battery * 100).rounded()))
            let thermal: String
            switch ProcessInfo.processInfo.thermalState {
            case .nominal: thermal = "nominal"
            case .fair: thermal = "fair"
            case .serious: thermal = "serious"
            case .critical: thermal = "critical"
            @unknown default: thermal = "unknown"
            }
            call.resolve([
                "model": device.model,
                "systemName": device.systemName,
                "systemVersion": device.systemVersion,
                "batteryPercent": level,
                "batteryState": self.batteryStateName(device.batteryState),
                "lowPowerMode": ProcessInfo.processInfo.isLowPowerModeEnabled,
                "thermalState": thermal,
                "userInterfaceStyle": device.userInterfaceStyle == .dark ? "dark" : "light"
            ])
        }
    }

    private func batteryStateName(_ state: UIDevice.BatteryState) -> String {
        switch state {
        case .charging: return "charging"
        case .full: return "full"
        case .unplugged: return "unplugged"
        case .unknown: return "unknown"
        @unknown default: return "unknown"
        }
    }

    @objc public func authorizationStatus(_ call: CAPPluginCall) {
        let kind = call.getString("kind") ?? ""
        switch kind {
        case "calendar":
            call.resolve(["status": eventStatus(EKEventStore.authorizationStatus(for: .event))])
        case "reminders":
            call.resolve(["status": eventStatus(EKEventStore.authorizationStatus(for: .reminder))])
        case "contacts":
            call.resolve(["status": contactStatus(CNContactStore.authorizationStatus(for: .contacts))])
        case "notifications":
            UNUserNotificationCenter.current().getNotificationSettings { settings in
                call.resolve(["status": self.notificationStatus(settings.authorizationStatus)])
            }
        default:
            call.reject("kind must be calendar, reminders, contacts, or notifications")
        }
    }

    private func eventStatus(_ status: EKAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "notDetermined"
        case .restricted: return "restricted"
        case .denied: return "denied"
        case .authorized, .fullAccess: return "authorized"
        case .writeOnly: return "writeOnly"
        @unknown default: return "unknown"
        }
    }

    private func contactStatus(_ status: CNAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "notDetermined"
        case .restricted: return "restricted"
        case .denied: return "denied"
        case .authorized: return "authorized"
        case .limited: return "limited"
        @unknown default: return "unknown"
        }
    }

    private func notificationStatus(_ status: UNAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "notDetermined"
        case .denied: return "denied"
        case .authorized: return "authorized"
        case .provisional: return "provisional"
        case .ephemeral: return "ephemeral"
        @unknown default: return "unknown"
        }
    }

    @objc public func requestAccess(_ call: CAPPluginCall) {
        let kind = call.getString("kind") ?? ""
        switch kind {
        case "calendar":
            if #available(iOS 17.0, *) {
                eventStore.requestFullAccessToEvents { granted, error in
                    if let error = error { call.reject(error.localizedDescription); return }
                    call.resolve(["granted": granted, "status": granted ? "authorized" : "denied"])
                }
            } else {
                eventStore.requestAccess(to: .event) { granted, error in
                    if let error = error { call.reject(error.localizedDescription); return }
                    call.resolve(["granted": granted, "status": granted ? "authorized" : "denied"])
                }
            }
        case "reminders":
            if #available(iOS 17.0, *) {
                eventStore.requestFullAccessToReminders { granted, error in
                    if let error = error { call.reject(error.localizedDescription); return }
                    call.resolve(["granted": granted, "status": granted ? "authorized" : "denied"])
                }
            } else {
                eventStore.requestAccess(to: .reminder) { granted, error in
                    if let error = error { call.reject(error.localizedDescription); return }
                    call.resolve(["granted": granted, "status": granted ? "authorized" : "denied"])
                }
            }
        case "contacts":
            contactsStore.requestAccess(for: .contacts) { granted, error in
                if let error = error { call.reject(error.localizedDescription); return }
                call.resolve(["granted": granted, "status": granted ? "authorized" : "denied"])
            }
        case "notifications":
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
                if let error = error { call.reject(error.localizedDescription); return }
                call.resolve(["granted": granted, "status": granted ? "authorized" : "denied"])
            }
        default:
            call.reject("kind must be calendar, reminders, contacts, or notifications")
        }
    }

    @objc public func createReminder(_ call: CAPPluginCall) {
        guard let title = call.getString("title"), !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            call.reject("A reminder title is required"); return
        }
        let reminder = EKReminder(eventStore: eventStore)
        reminder.title = title
        reminder.calendar = eventStore.defaultCalendarForNewReminders()
        reminder.notes = call.getString("notes")
        if let due = call.getDouble("dueAt") {
            reminder.dueDateComponents = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: Date(timeIntervalSince1970: due / 1000))
        }
        do {
            try eventStore.save(reminder, commit: true)
            call.resolve(["ok": true, "identifier": reminder.calendarItemIdentifier])
        } catch { call.reject(error.localizedDescription) }
    }

    @objc public func createCalendarEvent(_ call: CAPPluginCall) {
        guard let title = call.getString("title"), !title.isEmpty,
              let start = call.getDouble("startAt"), let end = call.getDouble("endAt") else {
            call.reject("title, startAt, and endAt are required"); return
        }
        let startDate = Date(timeIntervalSince1970: start / 1000)
        let endDate = Date(timeIntervalSince1970: end / 1000)
        guard endDate > startDate else { call.reject("endAt must be after startAt"); return }
        let event = EKEvent(eventStore: eventStore)
        event.title = title
        event.startDate = startDate
        event.endDate = endDate
        event.calendar = eventStore.defaultCalendarForNewEvents
        event.notes = call.getString("notes")
        do {
            try eventStore.save(event, span: .thisEvent, commit: true)
            call.resolve(["ok": true, "identifier": event.eventIdentifier ?? ""])
        } catch { call.reject(error.localizedDescription) }
    }

    @objc public func findContacts(_ call: CAPPluginCall) {
        let query = (call.getString("query") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { call.reject("query is required"); return }
        let keys: [CNKeyDescriptor] = [CNContactGivenNameKey, CNContactFamilyNameKey, CNContactPhoneNumbersKey, CNContactEmailAddressesKey] as [CNKeyDescriptor]
        let request = CNContactFetchRequest(keysToFetch: keys)
        request.sortOrder = .userDefault
        var matches: [[String: Any]] = []
        do {
            try contactsStore.enumerateContacts(with: request) { contact, stop in
                let name = "\(contact.givenName) \(contact.familyName)".trimmingCharacters(in: .whitespaces)
                if name.localizedCaseInsensitiveContains(query) ||
                    contact.phoneNumbers.contains(where: { $0.value.stringValue.localizedCaseInsensitiveContains(query) }) {
                    matches.append([
                        "identifier": contact.identifier,
                        "name": name,
                        "phones": contact.phoneNumbers.map { $0.value.stringValue },
                        "emails": contact.emailAddresses.map { String($0.value) }
                    ])
                    if matches.count >= 20 { stop.pointee = true }
                }
            }
            call.resolve(["contacts": matches])
        } catch { call.reject(error.localizedDescription) }
    }

    @objc public func scheduleNotification(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), !id.isEmpty,
              let title = call.getString("title"), !title.isEmpty,
              let body = call.getString("body"),
              let at = call.getDouble("at") else {
            call.reject("id, title, body, and at are required"); return
        }
        let date = Date(timeIntervalSince1970: at / 1000)
        guard date > Date() else { call.reject("Notification time must be in the future"); return }
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: id, content: content, trigger: trigger)) { error in
            if let error = error { call.reject(error.localizedDescription) }
            else { call.resolve(["ok": true, "id": id]) }
        }
    }

    @objc public func pendingNotifications(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
            let items = requests.map { ["id": $0.identifier, "title": $0.content.title, "body": $0.content.body] }
            call.resolve(["items": items])
        }
    }

    @objc public func cancelNotification(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), !id.isEmpty else { call.reject("id is required"); return }
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [id])
        call.resolve(["ok": true])
    }

    @objc public func speak(_ call: CAPPluginCall) {
        guard let text = call.getString("text"), !text.isEmpty else { call.reject("text is required"); return }
        let utterance = AVSpeechUtterance(string: text)
        utterance.rate = Float(call.getDouble("rate") ?? 0.5)
        if let language = call.getString("language"), let voice = AVSpeechSynthesisVoice(language: language) {
            utterance.voice = voice
        }
        DispatchQueue.main.async {
            self.speech.speak(utterance)
            call.resolve(["ok": true])
        }
    }

    @objc public func showQuickActions(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else { call.reject("No active view controller"); return }
            let view = FridayQuickActions { [weak self] action in
                self?.notifyListeners("quickAction", data: ["action": action])
                presenter.dismiss(animated: true)
            }
            let host = UIHostingController(rootView: view)
            host.modalPresentationStyle = .pageSheet
            if let sheet = host.sheetPresentationController {
                sheet.detents = [.medium(), .large()]
                sheet.prefersGrabberVisible = true
            }
            presenter.present(host, animated: true)
            call.resolve(["presented": true])
        }
    }

    @objc public func openAppSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else { call.reject("Settings URL unavailable"); return }
            UIApplication.shared.open(url) { opened in call.resolve(["opened": opened]) }
        }
    }
}

private struct FridayQuickActions: View {
    let onSelect: (String) -> Void
    private let actions: [(String, String, String)] = [
        ("Speak", "waveform", "speak"),
        ("Create reminder", "checkmark.circle", "reminder"),
        ("Calendar event", "calendar", "calendar"),
        ("Find contact", "person.crop.circle", "contacts"),
        ("Device status", "iphone", "device"),
        ("Notification", "bell", "notification")
    ]

    var body: some View {
        NavigationStack {
            List(actions, id: \.2) { item in
                Button { onSelect(item.2) } label: {
                    Label(item.0, systemImage: item.1)
                        .foregroundStyle(Color(red: 0.88, green: 0.75, blue: 0.48))
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color(red: 0.055, green: 0.06, blue: 0.075))
            .navigationTitle("Friday Tools")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { onSelect("close") }
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}
