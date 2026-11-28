plugins {
  id("com.android.application")
}

android {
  namespace = "ca.massai.assist"
  compileSdk = 34

  defaultConfig {
    applicationId = "ca.massai.assist"
    minSdk = 26
    targetSdk = 34
    versionCode = 1
    versionName = "1.0"
  }

  buildTypes {
    release {
      isMinifyEnabled = false
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
}

dependencies {
  // No libraries on purpose: a WebView, a speech recogniser and a voice are enough,
  // and every dependency is weight in an app that must open in under a second.
}
