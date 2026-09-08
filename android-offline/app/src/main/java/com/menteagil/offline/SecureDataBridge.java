package com.menteagil.offline;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public final class SecureDataBridge {
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "mente_agil_offline_data_v1";
    private static final String PREFS = "mente_agil_secure_store";
    private static final String DATA = "encrypted_progress";
    private static final int MAX_JSON_LENGTH = 750_000;

    private final SharedPreferences preferences;

    SecureDataBridge(Context context) {
        preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @JavascriptInterface
    public synchronized String load() {
        String encoded = preferences.getString(DATA, "");
        if (encoded == null || encoded.isEmpty()) return "";

        try {
            String[] parts = encoded.split("\\.", 2);
            if (parts.length != 2) return "";

            byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
            byte[] encrypted = Base64.decode(parts[1], Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            return "";
        }
    }

    @JavascriptInterface
    public synchronized boolean save(String json) {
        if (json == null || json.length() > MAX_JSON_LENGTH) return false;

        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
            byte[] encrypted = cipher.doFinal(json.getBytes(StandardCharsets.UTF_8));
            String payload = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
                + "."
                + Base64.encodeToString(encrypted, Base64.NO_WRAP);
            return preferences.edit().putString(DATA, payload).commit();
        } catch (Exception ignored) {
            return false;
        }
    }

    @JavascriptInterface
    public synchronized boolean clear() {
        return preferences.edit().remove(DATA).commit();
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
        keyStore.load(null);
        SecretKey existing = (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        if (existing != null) return existing;

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        generator.init(new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build());
        return generator.generateKey();
    }
}
