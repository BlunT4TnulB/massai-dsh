plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The hosted Massai URL the WebView loads; override with -PMASSACOT_URL=...
val massacotUrl: String = (project.findProperty("MASSACOT_URL") as String?) ?: "http://localhost:3080"

android {
    namespace = "com.massai.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.massai.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "MASSACOT_URL", "\"$massacotUrl\"")
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}
