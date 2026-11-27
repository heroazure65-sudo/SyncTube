package com.heroazure.synctube.twastest;

import android.app.Activity;
import android.content.ComponentName;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.VideoView;

import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;
import androidx.browser.trusted.TrustedWebActivityIntent;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;

import com.heroazure.synctube.twastest.R;

/**
 * Plays the bundled SyncTube mascot intro, then launches the verified TWA.
 * If the video cannot be decoded or the trusted browser is unavailable,
 * it falls back to a normal Chrome Custom Tab rather than exiting silently.
 */
public final class SyncTubeLauncherActivity extends Activity {
    private static final Uri START_URL = Uri.parse("https://synctube.pntr.dev/");
    private boolean launchStarted;
    private boolean serviceBound;

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
        playIntroThenLaunch();
    }

    private void playIntroThenLaunch() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(105, 185, 213));

        VideoView video = new VideoView(this);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT);
        params.gravity = android.view.Gravity.CENTER;
        root.addView(video, params);
        setContentView(root);

        video.setOnCompletionListener(mp -> launchBrowser());
        video.setOnErrorListener((mp, what, extra) -> {
            launchBrowser();
            return true;
        });

        try {
            Uri intro = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.synctube_intro);
            video.setVideoURI(intro);
            video.setOnPreparedListener(mp -> {
                mp.setLooping(false);
                video.start();
            });
        } catch (RuntimeException error) {
            launchBrowser();
        }
    }

    private void launchBrowser() {
        if (launchStarted || isFinishing()) return;

        String browser = CustomTabsClient.getPackageName(this, null);
        if (browser == null) browser = "com.android.chrome";

        serviceBound = CustomTabsClient.bindCustomTabsService(
                this, browser, serviceConnection);
        if (!serviceBound) launchCustomTab();
    }

    private void launchCustomTab() {
        if (launchStarted || isFinishing()) return;
        launchStarted = true;
        try {
            new CustomTabsIntent.Builder().build().launchUrl(this, START_URL);
        } catch (RuntimeException error) {
            android.widget.TextView message = new android.widget.TextView(this);
            message.setText("SyncTube couldn't open the browser. Please check Chrome is installed and enabled.");
            message.setPadding(32, 48, 32, 32);
            setContentView(message);
        }
    }

    @Override
    protected void onDestroy() {
        if (serviceBound) {
            try {
                unbindService(serviceConnection);
            } catch (IllegalArgumentException ignored) {
                // Service was already disconnected.
            }
        }
        super.onDestroy();
    }
}
