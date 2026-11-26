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

        setContentView(webView);

        // The only functional change from the successful local test:
        // load the live SyncTube HTTPS page instead of bundled local HTML.
        // JavaScript and other optional WebView features remain at defaults.
        webView.loadUrl("https://synctube.pntr.dev/");
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
