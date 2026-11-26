package com.heroazure.synctube.twastest;

import android.app.Activity;
import android.content.ComponentName;
import android.net.Uri;
import android.os.Bundle;

import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;
import androidx.browser.trusted.TrustedWebActivityIntent;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;

import com.heroazure.synctube.twastest.R;

/**
 * Small native TWA launcher. It avoids Android Browser Helper's LauncherActivity
 * startup path, which was crashing on the test device.
 */
public final class SyncTubeLauncherActivity extends Activity {
    private static final Uri START_URL = Uri.parse("https://synctube.pntr.dev/");
    private boolean launchStarted;

    private final CustomTabsServiceConnection serviceConnection =
            new CustomTabsServiceConnection() {
        @Override
        public void onCustomTabsServiceConnected(ComponentName name, CustomTabsClient client) {
            client.warmup(0L);
            CustomTabsSession session = client.newSession(new CustomTabsCallback());
            if (session == null) {
                launchCustomTab();
                return;
            }

            try {
                TrustedWebActivityIntent twaIntent =
                        new TrustedWebActivityIntentBuilder(START_URL)
                                .setToolbarColor(getColor(R.color.sync_dark))
                                .setNavigationBarColor(getColor(R.color.sync_dark))
                                .build(session);
                launchStarted = true;
                twaIntent.launchTrustedWebActivity(SyncTubeLauncherActivity.this);
                finish();
            } catch (RuntimeException error) {
                launchCustomTab();
            }
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            if (!launchStarted) launchCustomTab();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        String browser = CustomTabsClient.getPackageName(this, null);
        if (browser == null) browser = "com.android.chrome";

        boolean bound = CustomTabsClient.bindCustomTabsService(
                this, browser, serviceConnection);
        if (!bound) launchCustomTab();
    }

    private void launchCustomTab() {
        if (launchStarted || isFinishing()) return;
        launchStarted = true;
        try {
            new CustomTabsIntent.Builder().build().launchUrl(this, START_URL);
        } catch (RuntimeException error) {
            // Leave a visible Android error screen rather than silently crashing.
            android.widget.TextView message = new android.widget.TextView(this);
            message.setText("SyncTube couldn't open the browser. Please check Chrome is installed and enabled.");
            message.setPadding(32, 48, 32, 32);
            setContentView(message);
        }
    }

    @Override
    protected void onDestroy() {
        try {
            unbindService(serviceConnection);
        } catch (IllegalArgumentException ignored) {
            // Service was not bound.
        }
        super.onDestroy();
    }
}
