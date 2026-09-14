const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app/src/main/assets/www/connectivity.js"), "utf8");

function mount({ online = true, native } = {}) {
  const badge = { dataset: { state: "unknown" } };
  const label = { textContent: "Verificando…" };
  const events = {};
  const document = {
    hidden: false,
    querySelector: (selector) => selector === "#connection-status" ? badge : label,
    addEventListener: (name, handler) => { events[name] = handler; }
  };
  const window = {
    MenteAgilConnectivity: native,
    addEventListener: (name, handler) => { events[name] = handler; }
  };
  const navigator = { onLine: online };
  vm.runInNewContext(source, { window, document, navigator });
  return { badge, label, events, window, document, navigator };
}

test("browser fallback initializes online and follows network transitions", () => {
  const view = mount();
  assert.equal(view.label.textContent, "Online");
  view.navigator.onLine = false;
  view.events.offline();
  assert.equal(view.label.textContent, "Offline");
  assert.match(view.badge.title, /treinos locais continuam/);
  view.navigator.onLine = true;
  view.events.online();
  assert.equal(view.label.textContent, "Online");
});

test("starts offline without blocking local training or requiring requests", () => {
  const view = mount({ online: false });
  assert.equal(view.badge.dataset.state, "offline");
  assert.equal(view.label.textContent, "Offline");
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|rankingRequest\(|localStorage|setInterval/);
});

test("Android state overrides an optimistic WebView navigator.onLine", () => {
  let nativeState = "offline";
  const view = mount({ online: true, native: { getStatus: () => nativeState } });
  assert.equal(view.label.textContent, "Offline");
  view.events.online();
  assert.equal(view.label.textContent, "Offline");
  nativeState = "online";
  view.window.MenteConnectivity.update(nativeState);
  assert.equal(view.label.textContent, "Online");
});

test("resume refreshes connectivity; errors never incorrectly claim Online", () => {
  let broken = false;
  const view = mount({ native: { getStatus: () => { if (broken) throw Error("unavailable"); return "online"; } } });
  broken = true;
  view.events.visibilitychange();
  assert.equal(view.label.textContent, "Verificando…");
  view.window.MenteConnectivity.update("invalid");
  assert.equal(view.badge.dataset.state, "unknown");
});

test("APK observes validated default networks and releases callbacks on pause", () => {
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const java = read("app/src/main/java/com/menteagil/offline/ConnectivityBridge.java");
  const activity = read("app/src/main/java/com/menteagil/offline/MainActivity.java");
  assert.match(read("app/src/main/AndroidManifest.xml"), /ACCESS_NETWORK_STATE/);
  assert.match(java, /NET_CAPABILITY_INTERNET/);
  assert.match(java, /NET_CAPABILITY_VALIDATED/);
  assert.match(java, /registerDefaultNetworkCallback\(observer, handler\)/);
  assert.match(java, /callback == this && network.equals\(current\)/);
  assert.match(java, /unregisterNetworkCallback/);
  assert.match(activity, /onPause\(\)[\s\S]*connectivityBridge.stop\(\)/);
  assert.match(activity, /WindowInsets.Type.ime\(\)/);
});

test("responsive theme surfaces and large equations do not use fixed neon panels", () => {
  const css = fs.readFileSync(path.join(root, "app/src/main/assets/www/styles.css"), "utf8");
  assert.match(css, /var\(--panel-2\), var\(--panel\)/);
  assert.match(css, /\.medal-grid, \.backup-actions \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /font-size: clamp\(2rem, 9vw, 4.5rem\)/);
  assert.doesNotMatch(css, /rgba\(18,26,48|rgba\(5,10,25|\.offline-badge/);
});
