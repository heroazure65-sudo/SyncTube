package com.heroazure.synctube;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import com.google.androidbrowserhelper.trusted.LauncherActivity;

public final class SplashActivity extends Activity {
    private static final long ANIMATION_DURATION_MS = 1550L;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean launched;
    private final Runnable openWebsite = () -> {
        if (isFinishing() || launched) return;
        launched = true;
        try {
            startActivity(new Intent(this, LauncherActivity.class));
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
        } catch (RuntimeException exception) {
            android.util.Log.e("SyncTube", "Unable to open the Trusted Web Activity", exception);
        }
        finish();
    };

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(11, 11, 18));
        window.setNavigationBarColor(Color.rgb(11, 11, 18));
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        applyImmersiveMode();
        setContentView(new SyncTubeSplashView(this));
        handler.postDelayed(openWebsite, ANIMATION_DURATION_MS);
    }

    private void applyImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyImmersiveMode();
    }

    @Override protected void onDestroy() {
        handler.removeCallbacks(openWebsite);
        super.onDestroy();
    }
}
