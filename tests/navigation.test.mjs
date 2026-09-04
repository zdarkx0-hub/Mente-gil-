import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Include only visible markup; HTML's hidden attribute excludes the entire subtree.
function visibleMarkup(html) {
  const stack = [];
  const voids = new Set(["input", "br", "hr", "img", "meta", "link", "wbr"]);
  return (html.match(/<[^>]*>|[^<]+/g) ?? []).filter((token) => {
    const tag = token.match(/^<(\/)?([\w-]+)/);
    if (!tag) return !stack.some(Boolean);
    if (tag[1]) { const hidden = stack.some(Boolean); stack.pop(); return !hidden; }
    const hidden = stack.some(Boolean) || /\shidden(?:[\s=>])/.test(token);
    if (!voids.has(tag[2])) stack.push(hidden);
    return !hidden;
  }).join("");
}

test("each study URL renders its own controls while the shared layout retains sessions", async () => {
  const pages = [
    ["/", "Começar treino", /name="drill-count"|Top 10|id="achievements-title"/],
    ["/treinar", "Iniciar treino", /name="drill-count"|Top 10|id="achievements-title"/],
    ["/treinar/especificos", "Começar 10 questões", /Iniciar treino|Top 10|id="achievements-title"/],
    ["/revisar", "Revisar meus erros", /name="drill-count"|Top 10|id="achievements-title"/],
    ["/progresso", "Meu histórico de treinos específicos", /name="drill-count"|Top 10|id="achievements-title"/],
    ["/progresso/conquistas", "Minhas conquistas", /name="drill-count"|Top 10|Meu histórico de treinos específicos/],
    ["/ranking", "Top 10", /name="drill-count"|id="achievements-title"|Meu histórico de treinos específicos/]
  ];
  for (const [path, expected, unwanted] of pages) {
    const bundled = await build({
      entryPoints: [new URL("../app/study-app.jsx", import.meta.url).pathname],
      bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
      external: ["react", "react/jsx-runtime"],
      plugins: [{ name: "router-context", setup(builder) {
        builder.onResolve({ filter: /^next\/(link|navigation)$/ }, (args) => ({ path: args.path, namespace: "test-router" }));
        builder.onLoad({ filter: /.*/, namespace: "test-router" }, ({ path: modulePath }) => ({ contents: modulePath === "next/navigation"
          ? `export function usePathname(){return ${JSON.stringify(path)}}; export function useRouter(){return {replace(){}}}`
          : 'import React from "react"; export default function Link(props){return React.createElement("a", props, props.children)}', loader: "js" }));
      } }]
    });
    const module = { exports: {} };
    new Function("require", "exports", "module", bundled.outputFiles[0].text)(createRequire(import.meta.url), module.exports, module);
    const html = visibleMarkup(renderToStaticMarkup(React.createElement(module.exports.default)));
    assert.ok(html.includes(expected), `${path}: missing ${expected}`);
    assert.doesNotMatch(html, unwanted, `${path}: content from another page is visible`);
    await readFile(new URL(`../app/(study)${path === "/" ? "" : path}/page.jsx`, import.meta.url));
  }
  const layout = await readFile(new URL("../app/(study)/layout.jsx", import.meta.url), "utf8");
  assert.match(layout, /<StudyApp>\{children\}<\/StudyApp>/);
});
