"use client";

const DB_NAME = "mente-agil-private-offline-v1";
const DB_VERSION = 1;
const CACHE_STORE = "private-cache";
const QUEUE_STORE = "sync-queue";
const KEY_STORE = "vault-keys";
const VAULT_KEY_ID = "aes-gcm-v1";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let dbPromise = null;
let vaultKeyPromise = null;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Falha no armazenamento local."));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Falha no armazenamento local."));
    transaction.onabort = () => reject(transaction.error || new Error("Operação local cancelada."));
  });
}

function openDatabase() {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Armazenamento offline indisponível."));
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CACHE_STORE)) database.createObjectStore(CACHE_STORE, { keyPath: "key" });
      if (!database.objectStoreNames.contains(QUEUE_STORE)) database.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      if (!database.objectStoreNames.contains(KEY_STORE)) database.createObjectStore(KEY_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Não foi possível abrir o armazenamento offline."));
  });
  return dbPromise;
}

async function getVaultKey() {
  if (vaultKeyPromise) return vaultKeyPromise;
  vaultKeyPromise = (async () => {
    if (!globalThis.crypto?.subtle) throw new Error("Criptografia local indisponível.");
    const database = await openDatabase();
    const readTx = database.transaction(KEY_STORE, "readonly");
    const existing = await requestResult(readTx.objectStore(KEY_STORE).get(VAULT_KEY_ID));
    await transactionDone(readTx);
    if (existing?.value) return existing.value;

    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const writeTx = database.transaction(KEY_STORE, "readwrite");
    writeTx.objectStore(KEY_STORE).put({ id: VAULT_KEY_ID, value: key });
    await transactionDone(writeTx);
    return key;
  })();
  return vaultKeyPromise;
}

async function seal(value) {
  const key = await getVaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = encoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return { iv, ciphertext };
}

async function unseal(record) {
  if (!record?.iv || !record?.ciphertext) return null;
  const key = await getVaultKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(record.iv) },
    key,
    record.ciphertext
  );
  return JSON.parse(decoder.decode(plain));
}

function dispatchStatus(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("mente-agil-offline-status", { detail }));
}

async function cacheRecordKey(key) {
  const database = await openDatabase();
  const transaction = database.transaction(CACHE_STORE, "readonly");
  const record = await requestResult(transaction.objectStore(CACHE_STORE).get(key));
  await transactionDone(transaction);
  return record;
}

export async function readPrivateValue(key) {
  try {
    return await unseal(await cacheRecordKey(key));
  } catch {
    return null;
  }
}

export async function writePrivateValue(key, value) {
  const database = await openDatabase();
  const sealed = await seal(value);
  const transaction = database.transaction(CACHE_STORE, "readwrite");
  transaction.objectStore(CACHE_STORE).put({ key, updatedAt: Date.now(), ...sealed });
  await transactionDone(transaction);
  return value;
}

export async function updatePrivateValue(key, updater, fallback = null) {
  const current = (await readPrivateValue(key)) ?? fallback;
  const next = updater(current);
  await writePrivateValue(key, next);
  return next;
}

const apiCacheKey = (url) => `api:${url}`;

function apiError(message, status, data) {
  const error = new Error(message);
  error.status = status;
  error.data = data;
  error.permanent = status >= 400 && status < 500 && status !== 408 && status !== 429;
  return error;
}

async function responseJson(response) {
  try { return await response.json(); }
  catch { return {}; }
}

export async function privateJsonFetch(url) {
  let networkFailure = null;
  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      const data = await responseJson(response);
      if (response.ok) {
        await writePrivateValue(apiCacheKey(url), data);
        return { data, fromCache: false };
      }
      const error = apiError(data.error || "Não foi possível carregar os dados.", response.status, data);
      if (error.permanent) throw error;
      networkFailure = error;
    } catch (error) {
      if (error?.permanent) throw error;
      networkFailure = error;
    }
  }

  const cached = await readPrivateValue(apiCacheKey(url));
  if (cached !== null) return { data: cached, fromCache: true };
  throw networkFailure || new Error("Esses dados ainda não estão disponíveis offline neste aparelho.");
}

async function enqueueMutation(url, body, queueKey) {
  const database = await openDatabase();
  const id = queueKey ? `${url}:${queueKey}` : crypto.randomUUID();
  const sealed = await seal({ url, method: "POST", body });
  const transaction = database.transaction(QUEUE_STORE, "readwrite");
  transaction.objectStore(QUEUE_STORE).put({ id, createdAt: Date.now(), ...sealed });
  await transactionDone(transaction);
  dispatchStatus({ pendingChanged: true });
  return id;
}

async function deleteMutation(id) {
  const database = await openDatabase();
  const transaction = database.transaction(QUEUE_STORE, "readwrite");
  transaction.objectStore(QUEUE_STORE).delete(id);
  await transactionDone(transaction);
}

async function queueRecords() {
  const database = await openDatabase();
  const transaction = database.transaction(QUEUE_STORE, "readonly");
  const records = await requestResult(transaction.objectStore(QUEUE_STORE).getAll());
  await transactionDone(transaction);
  return (records || []).sort((a, b) => a.createdAt - b.createdAt);
}

export async function getPendingSyncCount() {
  try { return (await queueRecords()).length; }
  catch { return 0; }
}

export async function postJsonOrQueue(url, body, { queueKey = null, allowQueue = true } = {}) {
  let networkFailure = null;
  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await responseJson(response);
      if (response.ok) return { state: "saved", data, status: response.status };
      const error = apiError(data.error || "Não foi possível salvar os dados.", response.status, data);
      if (error.permanent) throw error;
      networkFailure = error;
    } catch (error) {
      if (error?.permanent) throw error;
      networkFailure = error;
    }
  }

  if (!allowQueue) throw networkFailure || new Error("Internet necessária para esta ação.");
  await enqueueMutation(url, body, queueKey);
  return { state: "queued", data: null, status: 202 };
}

export async function syncPendingMutations() {
  if (typeof navigator === "undefined" || !navigator.onLine) {
    return { synced: 0, pending: await getPendingSyncCount(), blocked: false };
  }

  const records = await queueRecords();
  let synced = 0;
  let blocked = false;

  for (const record of records) {
    let mutation;
    try { mutation = await unseal(record); }
    catch { blocked = true; break; }

    try {
      const response = await fetch(mutation.url, {
        method: mutation.method || "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mutation.body)
      });
      if (response.ok) {
        await deleteMutation(record.id);
        synced += 1;
        continue;
      }
      if (response.status === 401 || response.status === 403) {
        blocked = true;
        break;
      }
      if (response.status >= 500 || response.status === 408 || response.status === 429) break;
      blocked = true;
      break;
    } catch {
      break;
    }
  }

  const pending = await getPendingSyncCount();
  dispatchStatus({ pendingChanged: true, synced, pending, blocked });
  if (synced && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mente-agil-sync", { detail: { synced, pending } }));
  }
  return { synced, pending, blocked };
}

export async function rememberDrillSession(session) {
  return updatePrivateValue(apiCacheKey("/api/drills"), (current) => {
    const sessions = Array.isArray(current?.sessions) ? current.sessions.filter((item) => item.id !== session.id) : [];
    return { sessions: [session, ...sessions].slice(0, 10) };
  }, { sessions: [] });
}

export async function removeCachedReviewError(error) {
  return updatePrivateValue(apiCacheKey("/api/review/errors"), (current) => {
    const errors = Array.isArray(current?.errors) ? current.errors.filter((item) => item.id !== error.id) : [];
    const summary = {
      total: errors.length,
      add: errors.filter((item) => item.operation === "add").length,
      sub: errors.filter((item) => item.operation === "sub").length,
      mul: errors.filter((item) => item.operation === "mul").length
    };
    return { errors, summary };
  }, { errors: [], summary: { total: 0, add: 0, sub: 0, mul: 0 } });
}
