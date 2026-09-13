package com.menteagil.offline;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKeyFactory;
import javax.crypto.SecretKey;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

public final class SecureDataBridge {
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "mente_agil_offline_data_v1";
    private static final String PREFS = "mente_agil_secure_store";
    private static final String DATA = "encrypted_progress";
    private static final int MAX_JSON_LENGTH = 750_000;
    private static final int BACKUP_ITERATIONS = 210_000;
    private static final String BACKUP_PREFIX = "MAB1";

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

    @JavascriptInterface
    public synchronized boolean clearAll() {
        boolean cleared = preferences.edit().clear().commit();
        try {
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) keyStore.deleteEntry(KEY_ALIAS);
            return cleared;
        } catch (Exception ignored) {
            return false;
        }
    }

    @JavascriptInterface
    public synchronized String exportBackup(String json, String passphrase) {
        if (json == null || json.length() > MAX_JSON_LENGTH || !validPassphrase(passphrase)) return "";
        try {
            byte[] salt = new byte[24];
            new SecureRandom().nextBytes(salt);
            SecretKey key = backupKey(passphrase, salt);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            byte[] encrypted = cipher.doFinal(json.getBytes(StandardCharsets.UTF_8));
            return BACKUP_PREFIX + "."
                + Base64.encodeToString(salt, Base64.NO_WRAP) + "."
                + Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + "."
                + Base64.encodeToString(encrypted, Base64.NO_WRAP);
        } catch (Exception ignored) {
            return "";
        }
    }

    @JavascriptInterface
    public synchronized String importBackup(String payload, String passphrase) {
        if (payload == null || payload.length() > MAX_JSON_LENGTH * 2 || !validPassphrase(passphrase)) return "";
        try {
            String[] parts = payload.trim().split("\\.", 4);
            if (parts.length != 4 || !BACKUP_PREFIX.equals(parts[0])) return "";
            byte[] salt = Base64.decode(parts[1], Base64.NO_WRAP);
            byte[] iv = Base64.decode(parts[2], Base64.NO_WRAP);
            byte[] encrypted = Base64.decode(parts[3], Base64.NO_WRAP);
            if (salt.length != 24 || iv.length != 12 || encrypted.length > MAX_JSON_LENGTH + 64) return "";
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, backupKey(passphrase, salt), new GCMParameterSpec(128, iv));
            String json = new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
            return json.length() <= MAX_JSON_LENGTH && json.startsWith("{") ? json : "";
        } catch (Exception ignored) {
            return "";
        }
    }

    private static boolean validPassphrase(String passphrase) {
        return passphrase != null && passphrase.length() >= 8 && passphrase.length() <= 128;
    }

    private static SecretKey backupKey(String passphrase, byte[] salt) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(passphrase.toCharArray(), salt, BACKUP_ITERATIONS, 256);
        try {
            byte[] encoded = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
            return new SecretKeySpec(encoded, "AES");
        } finally {
            spec.clearPassword();
        }
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
