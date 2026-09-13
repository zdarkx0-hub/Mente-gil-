const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("mobile edition exposes a separate leaderboard and independent-version notice", () => {
  const html = read("app/src/main/assets/www/index.html");
  assert.match(html, /data-screen="ranking"/);
  assert.match(html, /Este placar não se mistura com o ranking do site/);
  assert.match(html, /O aplicativo e o site evoluem separadamente/);
  assert.match(html, /data-value="120"/);
});

test("training remains local while only the native ranking bridge has network access", () => {
  const manifest = read("app/src/main/AndroidManifest.xml");
  const bridge = read("app/src/main/java/com/menteagil/offline/MobileRankingBridge.java");
  const html = read("app/src/main/assets/www/index.html");
  assert.match(manifest, /android\.permission\.INTERNET/);
  assert.match(bridge, /https:\/\/mente-agil-vinicius\.zdarkx0\.chatgpt\.site\/api\/mobile-ranking/);
  assert.match(html, /connect-src 'none'/);
});

test("mobile layout uses five destinations and keeps large touch targets", () => {
  const css = read("app/src/main/assets/www/styles.css");
  assert.match(css, /grid-template-columns: repeat\(5, 1fr\)/);
  assert.match(css, /min-height: 56px/);
  assert.match(css, /--lime: #c8ff64/);
});

test("version 1.2 exposes four earned themes and a verified medal collection", () => {
  const html = read("app/src/main/assets/www/index.html");
  const app = read("app/src/main/assets/www/app.js");
  const css = read("app/src/main/assets/www/styles.css");
  assert.match(html, /id="theme-grid"/);
  assert.match(html, /id="medal-grid"/);
  for (const theme of ["neon", "flames", "crystal", "eclipse"]) {
    assert.match(app, new RegExp('id: "' + theme + '"'));
  }
  assert.match(css, /body\[data-theme="flames"\]/);
  assert.match(css, /body\[data-theme="crystal"\]/);
  assert.match(css, /body\[data-theme="eclipse"\]/);
  assert.match(app, /Escolha no máximo três medalhas/);
  assert.match(app, /rankingEligibleMedals/);
});

test("privacy controls include encrypted portable backup and separate deletion choices", () => {
  const html = read("app/src/main/assets/www/index.html");
  const secureBridge = read("app/src/main/java/com/menteagil/offline/SecureDataBridge.java");
  const rankingBridge = read("app/src/main/java/com/menteagil/offline/MobileRankingBridge.java");
  assert.match(html, /Backup criptografado/);
  assert.match(html, /Apagar somente o histórico local/);
  assert.match(html, /Excluir perfil e histórico do ranking/);
  assert.match(secureBridge, /PBKDF2WithHmacSHA256/);
  assert.match(secureBridge, /AES\/GCM\/NoPadding/);
  assert.match(secureBridge, /exportBackup/);
  assert.match(secureBridge, /importBackup/);
  assert.match(rankingBridge, /"answer", "finish", "medals"/);
  assert.doesNotMatch(rankingBridge, /Set\.of/);
});
