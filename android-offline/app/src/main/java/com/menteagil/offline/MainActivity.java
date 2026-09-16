package com.menteagil.offline;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.view.Window;
import android.view.WindowInsets;
import android.widget.FrameLayout;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

public final class MainActivity extends Activity {
    private WebView webView;
    private MobileRankingBridge mobileRankingBridge;
    private ConnectivityBridge connectivityBridge;
    private MobileAccountBridge mobileAccountBridge;
    private ProfilePhotoBridge profilePhotoBridge;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(9, 14, 29));
        window.setNavigationBarColor(Color.rgb(9, 14, 29));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(9, 14, 29));
        configureWebView(webView);
        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(Color.rgb(9, 14, 29));
        container.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        if (Build.VERSION.SDK_INT >= 30) {
            // Android 15 draws edge-to-edge by default. Keep controls clear of
            // status/navigation bars, display cutouts, and the soft keyboard.
            window.setDecorFitsSystemWindows(false);
            container.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets safe = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()
                        | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        setContentView(container);

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
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setSafeBrowsingEnabled(true);
        settings.setTextZoom(100);

        SecureDataBridge store = new SecureDataBridge(this);
        view.addJavascriptInterface(store, "MenteAgilData");
        mobileRankingBridge = new MobileRankingBridge(view, store);
        view.addJavascriptInterface(mobileRankingBridge, "MenteAgilRanking");
        mobileAccountBridge = new MobileAccountBridge(this, view, store);
        view.addJavascriptInterface(mobileAccountBridge, "MenteAgilAccount");
        profilePhotoBridge = new ProfilePhotoBridge(this, view, store);
        view.addJavascriptInterface(profilePhotoBridge, "MenteAgilPhoto");
        connectivityBridge = new ConnectivityBridge(this, view);
        view.addJavascriptInterface(connectivityBridge, "MenteAgilConnectivity");
        view.setWebViewClient(new LocalOnlyWebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                connectivityBridge.publish();
            }
        });
    }

    @Override protected void onResume() {
        super.onResume();
        if (connectivityBridge != null) connectivityBridge.start();
    }

    @Override protected void onPause() {
        if (connectivityBridge != null) connectivityBridge.stop();
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == ProfilePhotoBridge.REQUEST && profilePhotoBridge != null) profilePhotoBridge.result(resultCode, data);
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
            webView.removeJavascriptInterface("MenteAgilRanking");
            webView.removeJavascriptInterface("MenteAgilConnectivity");
            webView.removeJavascriptInterface("MenteAgilAccount");
            webView.removeJavascriptInterface("MenteAgilPhoto");
            if (mobileAccountBridge != null) mobileAccountBridge.close();
            if (profilePhotoBridge != null) profilePhotoBridge.close();
            if (connectivityBridge != null) connectivityBridge.stop();
            if (mobileRankingBridge != null) mobileRankingBridge.close();
            webView.destroy();
        }
        super.onDestroy();
    }

    private static class LocalOnlyWebViewClient extends WebViewClient {
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
            // Profile photos are decoded local JPEGs; they never require a network request.
            if (!request.isForMainFrame() && request.getUrl().toString().startsWith("data:image/jpeg;base64,")) return null;

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
