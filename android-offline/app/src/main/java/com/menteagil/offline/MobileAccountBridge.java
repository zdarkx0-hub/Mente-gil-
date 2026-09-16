package com.menteagil.offline;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MobileAccountBridge {
    private static final String ORIGIN = "https://mente-agil-vinicius.zdarkx0.chatgpt.site";
    private static final Set<String> ACTIONS = new HashSet<>(Arrays.asList(
        "auth/start", "auth/poll", "me", "profile", "logout", "progress", "friends",
        "friend/find", "friend/request", "friend/respond", "privacy/delete"));
    private final Activity activity;
    private final WebView webView;
    private final SecureDataBridge store;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    MobileAccountBridge(Activity activity, WebView webView, SecureDataBridge store) {
        this.activity=activity; this.webView=webView; this.store=store;
    }

    @JavascriptInterface public void post(String requestId, String action, String json) {
        if (requestId==null || !requestId.matches("^[A-Za-z0-9-]{8,80}$") || !ACTIONS.contains(action) || json==null || json.length()>700_000) return;
        executor.execute(() -> {
            try {
                JSONObject body=new JSONObject(json);
                if (action.equals("auth/start")) {
                    byte[] bytes=new byte[32]; new SecureRandom().nextBytes(bytes);
                    String verifier=hex(bytes);
                    body.put("challenge",hex(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.UTF_8))));
                    JSONObject response=request(action,body);
                    if (!response.has("error")) {
                        JSONObject pending=new JSONObject().put("deviceCode",response.getString("deviceCode")).put("verifier",verifier)
                            .put("authorizationUrl",response.getString("authorizationUrl")).put("expiresAt",response.getLong("expiresAt"));
                        if(!store.saveValue("pending_login",pending.toString())) throw new IllegalStateException("Could not save login");
                        response.remove("deviceCode");
                    }
                    deliver(requestId,response);
                } else if (action.equals("auth/poll")) {
                    JSONObject pending=new JSONObject(store.loadValue("pending_login"));
                    JSONObject response=request(action,pending);
                    if(response.has("token")) {
                        store.setAccount(response.getJSONObject("account").getString("id"),response.getString("token"));
                        store.removeValue("pending_login"); response.remove("token");
                    }
                    deliver(requestId,response);
                } else {
                    JSONObject response=request(action,body);
                    if (!response.has("error") && (action.equals("logout") || action.equals("privacy/delete"))) store.logout();
                    deliver(requestId,response);
                }
            } catch(Exception ignored) {
                try { deliver(requestId,new JSONObject().put("error","Não foi possível conectar. Seu progresso continua neste celular.")); }
                catch(Exception invalidJson) { }
            }
        });
    }

    @JavascriptInterface public void openLogin() {
        try {
            JSONObject pending=new JSONObject(store.loadValue("pending_login"));
            Uri uri=Uri.parse(pending.getString("authorizationUrl"));
            if(!"https".equals(uri.getScheme()) || !"mente-agil-vinicius.zdarkx0.chatgpt.site".equals(uri.getHost()) || !"/mobile/connect".equals(uri.getPath())) return;
            activity.runOnUiThread(() -> {
                try { activity.startActivity(new Intent(Intent.ACTION_VIEW,uri)); }
                catch(Exception ignored) { webView.evaluateJavascript("window.MenteAccount&&window.MenteAccount.notice('Não foi possível abrir o navegador.')",null); }
            });
        } catch(Exception ignored) { }
    }

    @JavascriptInterface public boolean connected() { return !store.loadValue("account_token").isEmpty(); }
    @JavascriptInterface public void logoutLocal() { store.logout(); }

    private JSONObject request(String action,JSONObject body) throws Exception {
        HttpURLConnection c=(HttpURLConnection)new URL(ORIGIN+"/api/mobile-account/"+action).openConnection();
        c.setInstanceFollowRedirects(false); c.setConnectTimeout(8000); c.setReadTimeout(20000);
        c.setRequestMethod("POST"); c.setRequestProperty("Content-Type","application/json");
        c.setRequestProperty("Accept","application/json");
        String token=store.loadValue("account_token");
        if(!token.isEmpty()) c.setRequestProperty("Authorization","Bearer "+token);
        try {
            c.setDoOutput(true);
            try(java.io.OutputStream out=c.getOutputStream()) { out.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            int status=c.getResponseCode();
            InputStream source=status>=200&&status<400?c.getInputStream():c.getErrorStream();
            if(source==null) throw new IllegalStateException("Empty response");
            try(InputStream input=source;ByteArrayOutputStream output=new ByteArrayOutputStream()) {
                byte[] buffer=new byte[8192]; int n;
                while((n=input.read(buffer))!=-1) {
                    if(output.size()+n>1_500_000) throw new IllegalStateException("Response too large");
                    output.write(buffer,0,n);
                }
                JSONObject response=new JSONObject(output.toString("UTF-8"));
                // An expired login must allow reconnection without erasing offline history.
                if(status==401 && response.optBoolean("unauthorized")) store.removeValue("account_token");
                return response;
            }
        } finally { c.disconnect(); }
    }

    private void deliver(String id,JSONObject value) {
        webView.post(() -> webView.evaluateJavascript("window.MenteAccountNative&&window.MenteAccountNative.resolve("
            +JSONObject.quote(id)+","+JSONObject.quote(value.toString())+")",null));
    }
    private static String hex(byte[] bytes) { StringBuilder b=new StringBuilder();for(byte v:bytes)b.append(String.format("%02x",v&255));return b.toString(); }
    void close(){executor.shutdownNow();}
}
