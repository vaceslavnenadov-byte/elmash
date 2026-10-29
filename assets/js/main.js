/* Электромаш — интерактив сайта (без зависимостей) */
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const norm = (s) => s.toLowerCase().replace(/ё/g, "е");
  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /* ---------- Шапка: тень при прокрутке, кнопка «наверх» ---------- */
  const header = $(".site-header");
  const toTop = document.createElement("button");
  toTop.className = "to-top";
  toTop.type = "button";
  toTop.setAttribute("aria-label", "Наверх");
  toTop.textContent = "↑";
  toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  document.body.appendChild(toTop);

  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 10);
    toTop.classList.toggle("is-visible", window.scrollY > 700);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Мобильное меню ---------- */
  const burger = $(".burger");
  const nav = $("#nav");
  const setMenu = (open) => {
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    nav.classList.toggle("is-open", open);
    document.body.style.overflow = open ? "hidden" : "";
  };
  burger.addEventListener("click", () => setMenu(burger.getAttribute("aria-expanded") !== "true"));
  $$(".nav__toggle").forEach((btn) =>
    btn.addEventListener("click", () => {
      const item = btn.closest(".nav__item");
      const open = !item.classList.contains("is-open");
      item.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    })
  );
  nav.addEventListener("click", (e) => {
    if (e.target.closest(".dropdown a, .nav__link") && nav.classList.contains("is-open")) setMenu(false);
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 1100 && nav.classList.contains("is-open")) setMenu(false);
  });

  /* ---------- Поиск ---------- */
  const index = window.SEARCH_INDEX || [];
  const findItems = (q) => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return index.filter((it) => {
      const hay = norm(it.t + " " + it.s);
      return words.every((w) => hay.includes(w));
    });
  };
  const highlight = (text, q) => {
    let html = escapeHtml(text);
    norm(q).split(/\s+/).filter((w) => w.length > 1).forEach((w) => {
      const re = new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/е/g, "[её]") + ")", "gi");
      html = html.replace(re, "<mark>$1</mark>");
    });
    return html;
  };
  const renderResults = (items, q) =>
    items.length
      ? items.map((it) => `<a href="${it.u}">${highlight(it.t, q)}<small>${escapeHtml(it.s)}</small></a>`).join("")
      : `<div class="search__empty">Ничего не найдено. Позвоните нам — подскажем: <b>8 800 101-61-51</b></div>`;

  $$(".search").forEach((form) => {
    const input = $("input", form);
    const box = $(".search__results", form);
    let active = -1;
    const close = () => { box.hidden = true; active = -1; };
    input.addEventListener("input", () => {
      const q = input.value.trim();
      if (q.length < 2) return close();
      box.innerHTML = renderResults(findItems(q).slice(0, 8), q);
      box.hidden = false;
      active = -1;
    });
    input.addEventListener("keydown", (e) => {
      const links = $$("a", box);
      if (box.hidden || !links.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
        links.forEach((a, i) => a.classList.toggle("is-active", i === active));
      } else if (e.key === "Enter" && active >= 0) {
        e.preventDefault();
        links[active].click();
      } else if (e.key === "Escape") {
        close();
      }
    });
    document.addEventListener("click", (e) => { if (!form.contains(e.target)) close(); });
    box.addEventListener("click", (e) => { if (e.target.closest("a")) close(); });
  });

  // Страница результатов поиска
  const resultsPage = $("[data-search-page]");
  if (resultsPage) {
    const q = new URLSearchParams(location.search).get("q") || "";
    $("#q").value = q;
    $("[data-search-query]").textContent = q ? `«${q}»` : "";
    const items = findItems(q);
    resultsPage.innerHTML = q
      ? `<p class="toolbar__count">Найдено: ${items.length}</p><div class="search__results search__results--page">${renderResults(items, q)}</div>`
      : `<p>Введите запрос в строку поиска вверху страницы.</p>`;
  }

  /* ---------- Фильтр каталога ---------- */
  $$("[data-catalog]").forEach((root) => {
    const cards = $$(".card", root);
    const input = $("[data-catalog-filter]", root);
    const count = $("[data-catalog-count]", root);
    const empty = $(".empty", root);
    let group = "all";
    const apply = () => {
      const words = input ? norm(input.value).split(/\s+/).filter(Boolean) : [];
      let shown = 0;
      cards.forEach((card) => {
        const text = norm(card.textContent);
        const ok = (group === "all" || card.dataset.group === group) && words.every((w) => text.includes(w));
        card.hidden = !ok;
        if (ok) shown++;
      });
      if (count) count.textContent = `Показано: ${shown} из ${cards.length}`;
      if (empty) empty.hidden = shown > 0;
    };
    $$(".chip", root).forEach((chip) =>
      chip.addEventListener("click", () => {
        $$(".chip", root).forEach((c) => c.classList.toggle("is-active", c === chip));
        group = chip.dataset.filter;
        apply();
      })
    );
    if (input) input.addEventListener("input", apply);
    apply();
  });

  /* ---------- Модальное окно заявки ---------- */
  const modal = $("#request-modal");
  let lastFocus = null;
  const openModal = (product) => {
    lastFocus = document.activeElement;
    const productBox = $(".form__product", modal);
    $("#request-title", modal).textContent = product ? "Запрос цены" : "Заказать звонок";
    productBox.hidden = !product;
    $("[data-product-name]", modal).textContent = product || "";
    $("input[name=product]", modal).value = product || "";
    $(".form__status", modal).textContent = "";
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => $("input[name=name]", modal).focus(), 50);
  };
  const closeModal = () => {
    modal.hidden = true;
    document.body.style.overflow = nav.classList.contains("is-open") ? "hidden" : "";
    if (lastFocus) lastFocus.focus();
  };
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-request]");
    if (trigger) { e.preventDefault(); openModal(trigger.dataset.request); }
    if (e.target.closest("[data-close]")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });
  // Удержание фокуса внутри окна
  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const f = $$("button, input, textarea, a[href]", modal).filter((el) => !el.closest("[hidden]") && el.type !== "hidden");
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- Отправка форм ---------- */
  const cfg = window.SITE || {};
  $$("form[data-form]").forEach((form) => {
    const status = $(".form__status", form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      let valid = true;
      $$("[required]", form).forEach((el) => {
        const ok = el.type === "checkbox" ? el.checked : el.value.trim().length > (el.type === "tel" ? 5 : 0);
        (el.closest(".field") || el.closest(".check")).classList.toggle("is-invalid", !ok);
        if (!ok) valid = false;
      });
      if (!valid) {
        status.className = "form__status is-error";
        status.textContent = "Заполните имя, телефон и подтвердите согласие.";
        return;
      }
      const data = Object.fromEntries(new FormData(form));
      status.className = "form__status";

      if (cfg.formEndpoint) {
        status.textContent = "Отправляем…";
        try {
          const res = await fetch(cfg.formEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data, page: location.href }),
          });
          if (!res.ok) throw new Error(res.status);
          form.reset();
          status.className = "form__status is-ok";
          status.textContent = "Спасибо! Заявка принята, мы свяжемся с вами в рабочее время.";
        } catch (err) {
          status.className = "form__status is-error";
          status.textContent = `Не удалось отправить. Позвоните нам или напишите на ${cfg.email}.`;
        }
        return;
      }

      // Без серверного обработчика — открываем почтовый клиент с готовым письмом
      const subject = data.product ? `Запрос цены: ${data.product}` : "Заявка с сайта";
      const body = [
        data.product && `Оборудование: ${data.product}`,
        `Имя: ${data.name}`,
        `Телефон: ${data.phone}`,
        data.email && `E-mail: ${data.email}`,
        data.message && `Комментарий: ${data.message}`,
      ].filter(Boolean).join("\n");
      location.href = `mailto:${cfg.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      status.className = "form__status is-ok";
      status.textContent = "Открылся почтовый клиент — отправьте письмо. Или позвоните: 8 800 101-61-51.";
    });
    form.addEventListener("input", (e) => {
      const wrap = e.target.closest(".is-invalid");
      if (wrap) wrap.classList.remove("is-invalid");
    });
  });

  /* ---------- Просмотр документов ---------- */
  const galleryItems = $$("[data-lightbox]");
  if (galleryItems.length) {
    const lb = document.createElement("div");
    lb.className = "lightbox";
    lb.hidden = true;
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.innerHTML = `<button class="lightbox__close" type="button" aria-label="Закрыть">×</button>
      <button class="lightbox__nav lightbox__prev" type="button" aria-label="Предыдущий">‹</button>
      <img alt="">
      <button class="lightbox__nav lightbox__next" type="button" aria-label="Следующий">›</button>`;
    document.body.appendChild(lb);
    const img = $("img", lb);
    let current = 0;
    const show = (i) => {
      current = (i + galleryItems.length) % galleryItems.length;
      const el = galleryItems[current];
      img.src = el.dataset.lightbox;
      img.alt = el.dataset.caption || "";
      lb.hidden = false;
      document.body.style.overflow = "hidden";
    };
    const hide = () => { lb.hidden = true; document.body.style.overflow = ""; galleryItems[current].focus(); };
    galleryItems.forEach((el, i) => el.addEventListener("click", () => show(i)));
    $(".lightbox__close", lb).addEventListener("click", hide);
    $(".lightbox__prev", lb).addEventListener("click", () => show(current - 1));
    $(".lightbox__next", lb).addEventListener("click", () => show(current + 1));
    lb.addEventListener("click", (e) => { if (e.target === lb) hide(); });
    document.addEventListener("keydown", (e) => {
      if (lb.hidden) return;
      if (e.key === "Escape") hide();
      if (e.key === "ArrowLeft") show(current - 1);
      if (e.key === "ArrowRight") show(current + 1);
    });
  }
})();
