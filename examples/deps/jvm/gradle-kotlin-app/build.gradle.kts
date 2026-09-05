plugins {
    java
}

description = "Fixture: Gradle Kotlin DSL dependencies with known CVEs (fake project, not installable)."

dependencies {
    implementation("org.apache.logging.log4j:log4j-core:2.14.1")
    api("com.fasterxml.jackson.core:jackson-databind:2.9.10")
    testImplementation(group = "junit", name = "junit", version = "4.13.2")
}
