package com.menteagil.offline;

import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MobileRankingBridge {
    private static final String API = "https://mente-agil-vinicius.zdarkx0.chatgpt.site/api/mobile-ranking";
    private static final int MAX_RESPONSE_BYTES = 64 * 1024;
    private static final Set<String> OPERATIONS = immutableSet("add", "sub", "mul");
    private static final Set<String> LEVELS = immutableSet("base", "medium", "advanced");
    private static final Set<String> ACTIONS = immutableSet(
        "session", "answer", "finish", "medals", "privacy/export", "privacy/delete"
    );

    private final WebView webView;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    MobileRankingBridge(WebView webView) {
        this.webView = webView;
    }

    @JavascriptInterface
    public void list(String requestId, String operation, String level, int duration) {
        if (!validRequestId(requestId) || !OPERATIONS.contains(operation) || !LEVELS.contains(level) || (duration != 60 && duration != 120)) {
            deliver(requestId, errorJson("Categoria inválida."));
            return;
        }
        executor.execute(() -> {
            try {
                String query = "?operation=" + encode(operation) + "&level=" + encode(level) + "&duration=" + duration;
                deliver(requestId, request("GET", API + query, null));
            } catch (Exception ignored) {
                deliver(requestId, errorJson("Sem conexão com o ranking mobile."));
            }
        });
    }

    @JavascriptInterface
    public void post(String requestId, String action, String body) {
        if (!validRequestId(requestId) || !ACTIONS.contains(action) || body == null || body.length() > 100_000) {
            deliver(requestId, errorJson("Solicitação inválida."));
            return;
        }
        try {
            new JSONObject(body);
        } catch (Exception ignored) {
            deliver(requestId, errorJson("Dados inválidos."));
            return;
        }
        executor.execute(() -> {
            try {
                deliver(requestId, request("POST", API + "/" + action, body));
            } catch (Exception ignored) {
                deliver(requestId, errorJson("Sem conexão com o ranking mobile."));
            }
        });
    }

    void close() {
        executor.shutdownNow();
    }

    private String request(String method, String endpoint, String body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(8_000);
        connection.setReadTimeout(10_000);
        connection.setRequestMethod(method);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("X-Mente-Agil-Mobile", "1");
        connection.setRequestProperty("User-Agent", "MenteAgilMobile/1.2.0 Android");
        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
        }

        int status = connection.getResponseCode();
        InputStream stream = status >= 200 && status < 400 ? connection.getInputStream() : connection.getErrorStream();
        String response = readLimited(stream);
        connection.disconnect();
        return response.isEmpty() ? errorJson("Resposta vazia do ranking.") : response;
    }

    private static String readLimited(InputStream stream) throws Exception {
        if (stream == null) return "";
        try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int total = 0;
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > MAX_RESPONSE_BYTES) throw new IllegalStateException("Response too large");
                output.write(buffer, 0, read);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private void deliver(String requestId, String responseJson) {
        if (!validRequestId(requestId)) return;
        webView.post(() -> webView.evaluateJavascript(
            "window.MenteRankingNative&&window.MenteRankingNative.resolve("
                + JSONObject.quote(requestId) + "," + JSONObject.quote(responseJson) + ")",
            null
        ));
    }

    private static boolean validRequestId(String requestId) {
        return requestId != null && requestId.matches("^[A-Za-z0-9-]{8,80}$");
    }

    private static String encode(String value) throws Exception {
        return URLEncoder.encode(value, StandardCharsets.UTF_8.name());
    }

    private static String errorJson(String message) {
        return "{\"error\":" + JSONObject.quote(message) + "}";
    }

    private static Set<String> immutableSet(String... values) {
        return Collections.unmodifiableSet(new HashSet<>(Arrays.asList(values)));
    }
}
