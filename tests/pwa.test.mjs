import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("mobile app manifest has standalone identity, install icons and useful shortcuts", async () => {
  const manifest = JSON.parse(await readFile(new URL("public/manifest.webmanifest", root), "utf8"));

  assert.equal(manifest.name, "Mente Ágil — Cálculo Mental");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.lang, "pt-BR");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192" && icon.purpose === "any"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"));
  assert.deepEqual(manifest.shortcuts.map((shortcut) => shortcut.url), ["/treinar", "/treinar/especificos", "/progresso"]);
});

test("service worker keeps private APIs out of Cache Storage and caches the study shell", async () => {
  const worker = await readFile(new URL("public/sw.js", root), "utf8");
  const offline = await readFile(new URL("public/offline.html", root), "utf8");
  const layout = await readFile(new URL("app/layout.jsx", root), "utf8");
  const controls = await readFile(new URL("app/pwa-controls.jsx", root), "utf8");

  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /APP_SHELL/);
  assert.match(worker, /"\/treinar\/especificos"/);
  assert.match(worker, /request\.mode === "navigate"/);
  assert.match(worker, /cacheShell\(\)/);
  assert.match(offline, /Você está sem internet/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(controls, /registration\.update\(\)/);
  assert.match(controls, /Abrir no Chrome/);
  assert.match(controls, /ready && !installed/);
  assert.match(controls, /syncPendingMutations/);
  assert.match(controls, /Modo offline/);
});

test("all declared application icons exist and are nonempty", async () => {
  const icons = ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];
  for (const icon of icons) {
    const info = await stat(new URL(`public/icons/${icon}`, root));
    assert.ok(info.size > 1000, `${icon} should contain a rendered PNG`);
  }
});
