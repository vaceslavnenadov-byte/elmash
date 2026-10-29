// Сборка статического сайта: src/pages/*.html + partials -> dist/
// Запуск: node build.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL(".", import.meta.url).pathname;
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

const site = JSON.parse(readFileSync(join(SRC, "site.json"), "utf8"));
const partial = (name) => readFileSync(join(SRC, "partials", `${name}.html`), "utf8");

// {{site.phone}}, {{page.title}} и т.п.
function fill(tpl, ctx) {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => {
    const value = key.split(".").reduce((o, k) => (o == null ? o : o[k]), ctx);
    return value == null ? m : String(value);
  });
}

// Шапка страницы в виде HTML-комментария с парами "ключ: значение"
function parsePage(raw) {
  const match = raw.match(/^<!--([\s\S]*?)-->\s*/);
  const meta = {};
  if (match) {
    for (const line of match[1].split("\n")) {
      const i = line.indexOf(":");
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return { meta, body: match ? raw.slice(match[0].length) : raw };
}

if (existsSync(DIST)) rmSync(DIST, { recursive: true });
mkdirSync(DIST, { recursive: true });

const layout = partial("layout");
const pages = readdirSync(join(SRC, "pages")).filter((f) => f.endsWith(".html"));

for (const file of pages) {
  const { meta, body } = parsePage(readFileSync(join(SRC, "pages", file), "utf8"));
  const ctx = { site, page: { ...meta, file } };

  // Подсветка активного пункта меню
  let header = partial("header");
  if (meta.nav) {
    header = header.replaceAll(`data-nav="${meta.nav}"`, `data-nav="${meta.nav}" aria-current="page"`);
  }

  const html = fill(
    layout
      .replace("{{header}}", header)
      .replace("{{footer}}", partial("footer"))
      .replace("{{content}}", body),
    ctx
  );
  writeFileSync(join(DIST, file), html);
  console.log("✓", file);
}

cpSync(join(ROOT, "assets"), join(DIST, "assets"), { recursive: true });
console.log(`Готово: ${pages.length} страниц в dist/`);
