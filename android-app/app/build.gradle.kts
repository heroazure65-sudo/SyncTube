plugins {
    id("com.android.application")
}
android {
    namespace = "com.heroazure.synctube"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.heroazure.synctube.youtubetest"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-youtube-test"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildTypes {
        debug { }
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}
dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.4")
}
