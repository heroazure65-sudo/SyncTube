plugins {
    id("com.android.application")
}

android {
    namespace = "com.heroazure.synctube.twastest"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.heroazure.synctube.customtabstest"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "0.6.0-custom-tabs-test"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildTypes {
        debug { }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

dependencies {
    implementation("androidx.browser:browser:1.8.0")
}
