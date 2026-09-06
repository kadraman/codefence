// swift-tools-version:5.9
import PackageDescription

// Companion ranged Package.swift for Package.resolved fixture (not used when lock is in scope).
let package = Package(
  name: "VulnerableSwiftResolvedApp",
  dependencies: [
    .package(url: "https://github.com/apple/swift-nio-http2.git", from: "1.0.0"),
    .package(url: "https://github.com/apple/swift-nio.git", from: "2.0.0")
  ]
)
