import WidgetKit
import SwiftUI

private struct FridayWidgetEntry: TimelineEntry {
    let date: Date
}

private struct FridayWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> FridayWidgetEntry { FridayWidgetEntry(date: .now) }
    func getSnapshot(in context: Context, completion: @escaping (FridayWidgetEntry) -> Void) {
        completion(FridayWidgetEntry(date: .now))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<FridayWidgetEntry>) -> Void) {
        completion(Timeline(entries: [FridayWidgetEntry(date: .now)], policy: .never))
    }
}

struct FridayLockScreenWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "FridayLockScreenWidget", provider: FridayWidgetProvider()) { _ in
            Link(destination: URL(string: "friday://wake")!) {
                ZStack {
                    Circle().fill(.black)
                    Circle().stroke(Color(red: 0.84, green: 0.70, blue: 0.43), lineWidth: 1.5).padding(4)
                    Circle().fill(Color(red: 0.84, green: 0.70, blue: 0.43).opacity(0.28)).frame(width: 10, height: 10)
                }
            }
            .containerBackground(.black, for: .widget)
        }
        .configurationDisplayName("Friday")
        .description("Friday's open orb. Tap to wake her.")
        .supportedFamilies([.accessoryCircular])
    }
}
