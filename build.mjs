// Сборка статического сайта: src/pages/*.html + partials + data -> dist/
// Запуск: node build.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL(".", import.meta.url).pathname;
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

const site = JSON.parse(readFileSync(join(SRC, "site.json"), "utf8"));
const catalog = JSON.parse(readFileSync(join(SRC, "data", "catalog.json"), "utf8"));
const partial = (name) => readFileSync(join(SRC, "partials", `${name}.html`), "utf8");

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const pad = (n) => String(n).padStart(2, "0");
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const fmtDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const legacy = (path) => site.legacy + path;

// Адреса элементов каталога внутри нового сайта
const repairHref = (i) => `repair.html#r-${pad(i + 1)}`;
const testingHref = (i) => `testing.html#t-${pad(i + 1)}`;
const substationHref = (i) => `substations.html#s-${pad(i + 1)}`;

const requestBtn = (title) =>
  `<button class="btn btn--primary btn--sm" type="button" data-request="${esc(title)}">Запросить цену</button>`;
const moreLink = (path) =>
  `<a class="link-more" href="${legacy(path)}" target="_blank" rel="noopener">Подробнее</a>`;

// --- Блоки, которые вставляются в страницы маркерами <!-- @имя --> ---
const blocks = {
  "menu:repair": () =>
    catalog.repair.map((it, i) => `<li><a href="${repairHref(i)}">${esc(it.title)}</a></li>`).join("\n"),

  "menu:testing": () =>
    Object.entries(catalog.testingGroups)
      .map(([key, name]) => {
        const items = catalog.testing
          .map((it, i) => ({ it, i }))
          .filter(({ it }) => it.group === key)
          .map(({ it, i }) => `<li><a href="${testingHref(i)}"><span class="num">${pad(i + 1)}</span>${esc(it.title)}</a></li>`)
          .join("\n");
        return `<div class="mega__col"><p class="mega__title">${esc(name)}</p><ul>${items}</ul></div>`;
      })
      .join("\n"),

  "cards:repair": () =>
    catalog.repair
      .map(
        (it, i) => `<article class="card card--product" id="r-${pad(i + 1)}">
  <div class="card__media card__media--contain"><img src="assets/img/${it.img}" alt="${esc(it.title)}" loading="lazy"></div>
  <div class="card__body">
    <h3 class="card__title">${esc(it.title)}</h3>
    <div class="card__actions">${requestBtn(it.title)}${moreLink(it.old)}</div>
  </div>
</article>`
      )
      .join("\n"),

  "chips:testing": () =>
    `<button class="chip is-active" type="button" data-filter="all">Все <span>${catalog.testing.length}</span></button>` +
    Object.entries(catalog.testingGroups)
      .map(([key, name]) => {
        const n = catalog.testing.filter((it) => it.group === key).length;
        return `<button class="chip" type="button" data-filter="${key}">${esc(name)} <span>${n}</span></button>`;
      })
      .join(""),

  "cards:testing": () =>
    catalog.testing
      .map(
        (it, i) => `<article class="card card--product" id="t-${pad(i + 1)}" data-group="${it.group}">
  <div class="card__media"><img src="assets/img/testing/${pad(i + 1)}.jpg" alt="${esc(it.title)}" loading="lazy"><span class="card__num">${pad(i + 1)}</span></div>
  <div class="card__body">
    <p class="card__kicker">${esc(catalog.testingGroups[it.group])}</p>
    <h3 class="card__title">${esc(it.title)}</h3>
    <div class="card__actions">${requestBtn(it.title)}${moreLink(it.old)}</div>
  </div>
</article>`
      )
      .join("\n"),

  "cards:substations": () =>
    catalog.substations
      .map(
        (it, i) => `<article class="card card--row" id="s-${pad(i + 1)}">
  <div class="card__media card__media--contain"><img src="assets/img/${it.img}" alt="${esc(it.title)}" loading="lazy"></div>
  <div class="card__body">
    <h3 class="card__title">${esc(it.title)}</h3>
    <ul class="specs">${it.specs.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    <p>${esc(it.text)}</p>
    <div class="card__actions">${requestBtn(it.title)}${moreLink(it.old)}</div>
  </div>
</article>`
      )
      .join("\n"),

  "news:all": () => catalog.news.map(newsCard).join("\n"),
  "news:latest": () => catalog.news.slice(0, 3).map(newsCard).join("\n"),
};

function newsCard(it) {
  return `<article class="news-card">
  <a class="news-card__media" href="${legacy(it.old)}" target="_blank" rel="noopener"><img src="assets/img/${it.img}" alt="" loading="lazy"></a>
  <div class="news-card__body">
    <time datetime="${it.date}">${fmtDate(it.date)}</time>
    <h3><a href="${legacy(it.old)}" target="_blank" rel="noopener">${esc(it.title)}</a></h3>
    ${it.text ? `<p>${esc(it.text)}</p>` : ""}
  </div>
</article>`;
}

// Индекс для поиска в шапке
const searchIndex = [
  ...catalog.repair.map((it, i) => ({ t: it.title, s: "Электроремонтное оборудование", u: repairHref(i) })),
  ...catalog.testing.map((it, i) => ({ t: it.title, s: "Испытательное оборудование", u: testingHref(i) })),
  ...catalog.substations.map((it, i) => ({ t: it.title, s: "Подстанции", u: substationHref(i) })),
  { t: "Автоклавы для изделий из ПКМ и препрегов", s: "Автоклавы", u: "autoclaves.html" },
  { t: "Аттестация испытательного оборудования", s: "Услуги", u: "attestation.html" },
  { t: "Документы, сертификаты ISO, СРО", s: "Компания", u: "documents.html" },
  { t: "Награды и дипломы", s: "Компания", u: "awards.html" },
  { t: "Сотрудники", s: "Компания", u: "staff.html" },
  { t: "Реквизиты", s: "Контакты", u: "contacts.html#requisites" },
];

// {{site.phone}}, {{page.title}} и т.п.
function fill(tpl, ctx) {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => {
    const value = key.split(".").reduce((o, k) => (o == null ? o : o[k]), ctx);
    return value == null ? m : String(value);
  });
}

const expandBlocks = (html) =>
  html.replace(/<!--\s*@([\w:]+)\s*-->/g, (m, name) => {
    if (!blocks[name]) throw new Error(`Неизвестный блок @${name}`);
    return blocks[name]();
  });

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
    expandBlocks(
      layout
        .replace("{{header}}", () => header)
        .replace("{{footer}}", () => partial("footer"))
        .replace("{{modal}}", () => partial("modal"))
        .replace("{{content}}", () => body)
    ),
    ctx
  );
  writeFileSync(join(DIST, file), html);
  console.log("✓", file);
}

cpSync(join(ROOT, "assets"), join(DIST, "assets"), { recursive: true });
writeFileSync(
  join(DIST, "assets", "js", "search-index.js"),
  `window.SEARCH_INDEX = ${JSON.stringify(searchIndex)};\nwindow.SITE = ${JSON.stringify({ email: site.email, formEndpoint: site.formEndpoint })};\n`
);
console.log(`Готово: ${pages.length} страниц в dist/`);
