import AppIntents

/// Siri entry point for opening Friday. iOS still owns the wake phrase and
/// microphone/session permissions; this intent only launches the app.
@available(iOS 16.0, *)
public struct OpenFridayAssistantIntent: AppIntent {
    public static var title: LocalizedStringResource = "Open Friday"
    public static var description = IntentDescription("Open Friday, your personal assistant.")
    public static var openAppWhenRun: Bool = true

    public init() {}

    public func perform() async throws -> some IntentResult {
        .result()
    }
}

@available(iOS 16.0, *)
public struct FridayAppShortcuts: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenFridayAssistantIntent(),
            phrases: [
                "Open \(.applicationName)",
                "Wake up \(.applicationName)",
                "Talk to \(.applicationName)"
            ],
            shortTitle: "Open Friday",
            systemImageName: "sparkles"
        )
    }
}
