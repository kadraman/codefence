// swift-tools-version:5.9
import PackageDescription

// Fixture: exact SwiftPM pins with known OSV advisories (fake project, not installable).
let package = Package(
  name: "VulnerableSwiftApp",
  platforms: [.macOS(.v13)],
  dependencies: [
    .package(url: "https://github.com/apple/swift-nio-http2.git", .exact("1.37.0")),
    .package(url: "https://github.com/apple/swift-nio.git", exact: "2.65.0"),
    .package(url: "https://github.com/apple/swift-log.git", from: "1.5.0")
  ],
  targets: [
    .executableTarget(
      name: "VulnerableSwiftApp",
      dependencies: [
        .product(name: "NIOHTTP2", package: "swift-nio-http2"),
        .product(name: "NIO", package: "swift-nio"),
        .product(name: "Logging", package: "swift-log")
      ]
    )
  ]
)
