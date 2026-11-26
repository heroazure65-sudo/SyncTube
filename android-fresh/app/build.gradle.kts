plugins {
    id("com.android.application")
}

android {
    namespace = "com.heroazure.synctube.freshtest"
    compileSdk = 36

    defaultConfig {
        // Separate package so the known-good native diagnostic can remain installed.
        applicationId = "com.heroazure.synctube.webviewtest"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "0.2.0-webview-runtime-test"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildTypes {
        debug {
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}
