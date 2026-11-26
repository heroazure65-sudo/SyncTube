plugins {
    id("com.android.application")
}

android {
    namespace = "com.heroazure.synctube.freshtest"
    compileSdk = 36

    defaultConfig {
        // Unique package keeps all diagnostic APKs installable side by side.
        applicationId = "com.heroazure.synctube.websitetest"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "0.3.0-website-load-test"
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
