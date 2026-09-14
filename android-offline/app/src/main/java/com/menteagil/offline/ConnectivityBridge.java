package com.menteagil.offline;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

/** Observes connectivity only; never sends requests or changes game/profile data. */
public final class ConnectivityBridge {
    private final ConnectivityManager manager;
    private final WebView webView;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private volatile String status = "unknown";
    private ConnectivityManager.NetworkCallback callback;

    public ConnectivityBridge(Context context, WebView webView) {
        manager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        this.webView = webView;
    }

    @JavascriptInterface
    public String getStatus() {
        return status;
    }

    // All lifecycle calls and network callbacks run on the main thread.
    public void start() {
        if (callback != null || manager == null) return;
        ConnectivityManager.NetworkCallback observer = new ConnectivityManager.NetworkCallback() {
            private Network current;

            @Override public void onAvailable(Network network) {
                if (callback != this) return;
                current = network;
                // Wait for onCapabilitiesChanged; querying here races Android.
            }

            @Override public void onCapabilitiesChanged(Network network, NetworkCapabilities caps) {
                if (callback == this && network.equals(current)) setCapabilities(caps);
            }

            @Override public void onLost(Network network) {
                if (callback == this && network.equals(current)) {
                    current = null;
                    setCapabilities(null);
                }
            }
        };
        callback = observer;
        try {
            manager.registerDefaultNetworkCallback(observer, handler);
            Network active = manager.getActiveNetwork();
            setCapabilities(active == null ? null : manager.getNetworkCapabilities(active));
        } catch (SecurityException | IllegalArgumentException exception) {
            callback = null;
            status = "unknown";
            publish();
        }
    }

    private void setCapabilities(NetworkCapabilities caps) {
        boolean connected = caps != null
            && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        status = connected ? "online" : "offline";
        publish();
    }

    public void publish() {
        webView.evaluateJavascript("window.MenteConnectivity && window.MenteConnectivity.update('"
            + status + "');", null);
    }

    public void stop() {
        ConnectivityManager.NetworkCallback previous = callback;
        callback = null; // Ignore callbacks already queued before unregistering.
        if (previous != null && manager != null) {
            try {
                manager.unregisterNetworkCallback(previous);
            } catch (IllegalArgumentException ignored) {
                // Callback was already released by Android.
            }
        }
    }
}
