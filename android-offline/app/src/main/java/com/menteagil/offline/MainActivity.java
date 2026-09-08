package com.menteagil.offline;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Window;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

public final class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(7, 18, 17));
        window.setNavigationBarColor(Color.rgb(7, 18, 17));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(7, 18, 17));
        configureWebView(webView);
        setContentView(webView);

        if (savedInstanceState == null) {
            webView.loadUrl("file:///android_asset/www/index.html");
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void configureWebView(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(false);
        settings.setDatabaseEnabled(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setTextZoom(100);

        view.addJavascriptInterface(new SecureDataBridge(this), "MenteAgilData");
        view.setWebViewClient(new LocalOnlyWebViewClient());
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("MenteAgilData");
            webView.destroy();
        }
        super.onDestroy();
    }

    private static final class LocalOnlyWebViewClient extends WebViewClient {
        private static boolean isLocal(Uri uri) {
            return "file".equals(uri.getScheme())
                && uri.getPath() != null
                && uri.getPath().startsWith("/android_asset/www/");
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return !isLocal(request.getUrl());
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            if (isLocal(request.getUrl())) return super.shouldInterceptRequest(view, request);

            return new WebResourceResponse(
                "text/plain",
                StandardCharsets.UTF_8.name(),
                403,
                "Offline only",
                java.util.Collections.emptyMap(),
                new ByteArrayInputStream(new byte[0])
            );
        }
    }
}
