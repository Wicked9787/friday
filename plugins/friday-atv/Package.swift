// swift-tools-version: 5.9
import PackageDescription

// The Apple TV protocol code comes from itsytv-core (MIT License, (c) 2026 Nick Ustinov),
// pinned to one exact commit so a change upstream can never slip into a build unseen.
let package = Package(
    name: "FridayAtv",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "FridayAtv", targets: ["FridayAtvPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/nickustinov/itsytv-core.git", revision: "0a09f06f5bd52287ae415d7a210eea7e181bbf27")
    ],
    targets: [
        .target(
            name: "FridayAtvPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "ItsytvCore", package: "itsytv-core")
            ],
            path: "ios/Sources/FridayAtvPlugin"
        )
    ]
)
