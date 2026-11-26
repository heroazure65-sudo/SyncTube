package com.heroazure.synctube.freshtest;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(15, 15, 21));
        webView.setWebViewClient(new WebViewClient());

        // Keep this test deliberately minimal: no JavaScript, no remote URL,
        // no cookies, no custom Chrome client, and no website dependencies.
        String html = "<!doctype html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'>"
                + "<style>body{margin:0;background:#0f0f15;color:#fff;font:18px sans-serif;"
                + "display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center}"
                + "main{padding:28px}h1{color:#8b5cf6;font-size:26px}p{line-height:1.6;color:#d1d5db}</style>"
                + "</head><body><main><h1>WEBVIEW STARTED</h1>"
                + "<p>The Android WebView engine opened successfully.</p>"
                + "<p>This page is stored inside the app.<br>No internet or website was loaded.</p>"
                + "</main></body></html>";

        setContentView(webView);
        webView.loadDataWithBaseURL(
                "https://local.synctube.test/",
                html,
                "text/html",
                "UTF-8",
                null
        );
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
