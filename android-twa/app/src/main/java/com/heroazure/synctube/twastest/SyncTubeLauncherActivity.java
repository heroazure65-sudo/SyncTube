package com.heroazure.synctube.twastest;

import androidx.browser.customtabs.CustomTabsCallback;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

/**
 * Diagnostic launcher: do not turn a provider quality-enforcement callback
 * into an uncaught host-app crash. If the origin is not verified, ABH can
 * fall back to a Custom Tab, which is still useful for testing sign-in/session.
 */
public final class SyncTubeLauncherActivity extends LauncherActivity {
    @Override
    protected CustomTabsCallback getCustomTabsCallback() {
        return new CustomTabsCallback();
    }
}
