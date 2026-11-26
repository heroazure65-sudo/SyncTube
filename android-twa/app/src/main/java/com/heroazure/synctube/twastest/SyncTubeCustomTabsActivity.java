package com.heroazure.synctube.twastest;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;

import androidx.browser.customtabs.CustomTabsIntent;

/**
 * Opens SyncTube in Chrome Custom Tabs.
 * Custom Tabs use Chrome's browser profile, including its existing site cookies
 * and local storage, without using the TWA verification launcher.
 */
public final class SyncTubeCustomTabsActivity extends Activity {
    private static final String SYNC_TUBE_URL = "https://synctube.pntr.dev/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        CustomTabsIntent customTabsIntent = new CustomTabsIntent.Builder()
                .setShowTitle(true)
                .setToolbarColor(Color.rgb(11, 11, 18))
                .build();

        // Use the installed Chrome browser profile when available.
        customTabsIntent.intent.setPackage("com.android.chrome");

        try {
            customTabsIntent.launchUrl(this, Uri.parse(SYNC_TUBE_URL));
        } catch (ActivityNotFoundException chromeUnavailable) {
            Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(SYNC_TUBE_URL));
            try {
                startActivity(browserIntent);
            } catch (ActivityNotFoundException noBrowser) {
                // Keep the failure explicit rather than crashing silently.
            }
        }

        finish();
    }
}
