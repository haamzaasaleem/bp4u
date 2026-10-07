/* ==========================================================================
   Site-wide behavior: nav, search, garment rendering, product cards,
   reviews, newsletter, quote form, reveal-on-scroll.
   ========================================================================== */

(function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var DESIGN_KEY = "bp4u-design";

  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Toast ---------- */
  var toastTimer;
  function toast(msg) {
    var el = $(".toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-visible"); }, 2800);
  }
  window.BPToast = toast;

  /* ---------- Saved design helpers (localStorage, guarded) ---------- */
  function loadDesign() {
    try { return JSON.parse(localStorage.getItem(DESIGN_KEY) || "null"); } catch (e) { return null; }
  }
  function saveDesign(data) {
    try { localStorage.setItem(DESIGN_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
  }
  window.BPDesignStore = { load: loadDesign, save: saveDesign };

  function updateSavedBadge() {
    var badge = $("[data-saved-count]");
    if (badge) badge.hidden = !loadDesign();
  }

  /* ---------- Mobile nav ---------- */
  function initNav() {
    var toggle = $(".nav-toggle");
    if (!toggle) return;
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    $$("#site-nav a").forEach(function (a) {
      a.addEventListener("click", function () {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Garment rendering for [data-garment] ---------- */
  function renderGarments(ctx) {
    $$("[data-garment]", ctx).forEach(function (el) {
      if (el.dataset.rendered) return;
      var type = el.dataset.garment;
      el.innerHTML = BP.garmentSVG(type, el.dataset.color || "#ffffff");
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      el.style.containerType = "inline-size";
      var mock = el.dataset.mock;
      if (mock) {
        var places = BP.PLACEMENTS[type];
        var place = places.filter(function (p) { return p.id === el.dataset.place; })[0] || places[0];
        var b = place.box;
        var span = document.createElement("span");
        span.className = "mock-logo";
        span.setAttribute("aria-hidden", "true");
        span.style.cssText =
          "left:" + (b[0] / 3) + "%;top:" + (b[1] / 3) + "%;width:" + (b[2] / 3) + "%;height:" + (b[3] / 3) + "%;" +
          "display:flex;align-items:center;justify-content:center;white-space:pre-line;" +
          "color:" + (el.dataset.mockColor || "#fff") + ";" +
          "font-size:" + (b[2] / 3 / Math.max(6, longestLine(mock)) * 1.7).toFixed(2) + "cqw;";
        span.textContent = mock;
        el.appendChild(span);
      }
      el.dataset.rendered = "1";
    });
  }
  function longestLine(str) {
    return str.split("\n").reduce(function (m, l) { return Math.max(m, l.length); }, 0);
  }

  /* ---------- Product cards ---------- */
  function productCard(p) {
    var first = BP.COLORS[p.colors[0]];
    var swatches = p.colors.map(function (key, i) {
      var c = BP.COLORS[key];
      return '<button type="button" class="swatch" style="background:' + c.hex + '" data-swatch="' + c.hex +
        '" data-color-key="' + key + '" aria-label="' + c.name + '" aria-pressed="' + (i === 0) + '"></button>';
    }).join("");
    var methods = p.methods.map(function (m) { return m === "print" ? "Printing" : "Embroidery"; }).join(" · ");
    var media = p.image
      ? '<img src="' + p.image + '" alt="' + escapeHTML(p.name) + '" loading="lazy">'
      : BP.garmentSVG(p.garment, first.hex, { label: p.name + " in " + first.name });
    return '' +
      '<article class="product-card reveal" data-cat="' + p.cat + '" data-id="' + p.id + '">' +
        '<a class="product-media" href="design.html?product=' + p.id + '&color=' + p.colors[0] + '" data-card-link>' +
          (p.badge ? '<span class="tag">' + escapeHTML(p.badge) + '</span>' : '') + media +
        '</a>' +
        '<div class="product-body">' +
          '<span class="product-meta">' + BP.CATEGORIES[p.cat].name + ' · ' + methods + '</span>' +
          '<h3>' + escapeHTML(p.name) + '</h3>' +
          '<p class="product-meta" style="margin:0">' + escapeHTML(p.desc) + '</p>' +
          '<div class="swatches">' + swatches + '</div>' +
          '<div class="product-price">From $' + p.price.toFixed(2) + ' <small>/ piece before decoration</small></div>' +
          '<div class="product-actions">' +
            '<a class="btn btn--primary" href="design.html?product=' + p.id + '&color=' + p.colors[0] + '" data-card-link>Customize</a>' +
            '<a class="btn btn--outline" href="contact.html?product=' + encodeURIComponent(p.name) + '">Quote</a>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function bindSwatches(ctx) {
    ctx.addEventListener("click", function (e) {
      var sw = e.target.closest("[data-swatch]");
      if (!sw) return;
      var card = sw.closest(".product-card");
      var p = BP.getProduct(card.dataset.id);
      $$("[data-swatch]", card).forEach(function (s) { s.setAttribute("aria-pressed", String(s === sw)); });
      if (!p.image) {
        var media = $(".product-media", card);
        var oldSvg = $("svg", media);
        var tmp = document.createElement("div");
        tmp.innerHTML = BP.garmentSVG(p.garment, sw.dataset.swatch, { label: p.name + " in " + BP.COLORS[sw.dataset.colorKey].name });
        media.replaceChild(tmp.firstChild, oldSvg);
      }
      $$("[data-card-link]", card).forEach(function (a) {
        a.href = "design.html?product=" + p.id + "&color=" + sw.dataset.colorKey;
      });
    });
  }

  function initProductGrids() {
    $$("[data-product-grid]").forEach(function (grid) {
      var list = BP.PRODUCTS;
      if (grid.dataset.ids) {
        list = grid.dataset.ids.split(",").map(BP.getProduct).filter(Boolean);
      }
      grid.innerHTML = list.map(productCard).join("");
      bindSwatches(grid);
      if (grid.hasAttribute("data-filterable")) initFilters(grid);
    });
  }

  var CAT_COPY = {
    all: ["All Products", "Embroidered medical jackets, polos, and hats, plus printed t-shirts. Pick a style, then personalize it in the Design Studio."],
    medical: ["The Embroiderology Dept.", "Medical embroidery, only at Business Printing 4 U. Jackets, lab coats, and scrubs embroidered with names, credentials, and your practice logo."],
    polos: ["Polos & Business Wear", "Professional polos that make your whole team look put-together, with your logo stitched on the chest."],
    hats: ["Custom Hats", "Structured caps, truckers, and dad hats with crisp embroidered logos."],
    tees: ["Custom T-Shirts", "Bright, durable printed tees for teams, events, schools, and family reunions."]
  };

  function initFilters(grid) {
    var params = new URLSearchParams(location.search);
    var q = (params.get("q") || "").trim().toLowerCase();
    var current = CAT_COPY[params.get("cat")] ? params.get("cat") : "all";
    var chips = $$("[data-filter]");
    var count = $("[data-result-count]");

    function apply(cat, pushState) {
      current = cat;
      chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c.dataset.filter === cat)); });
      var shown = 0;
      $$(".product-card", grid).forEach(function (card) {
        var p = BP.getProduct(card.dataset.id);
        var hay = (p.name + " " + p.desc + " " + BP.CATEGORIES[p.cat].name).toLowerCase();
        var ok = (cat === "all" || p.cat === cat) && (!q || hay.indexOf(q) !== -1);
        card.hidden = !ok;
        if (ok) { shown++; card.classList.add("is-visible"); }
      });
      var copy = CAT_COPY[cat];
      $("[data-cat-title]").textContent = q ? "Results for “" + q + "”" : copy[0];
      $("[data-cat-desc]").textContent = copy[1];
      $("[data-crumb]").textContent = copy[0];
      document.title = copy[0] + " | Business Printing 4 U";
      if (count) count.textContent = shown ? shown + " product" + (shown === 1 ? "" : "s") : "No matches. Try another search, or ask us. We can source almost anything!";
      $$('#site-nav a[href^="products.html"]').forEach(function (a) {
        var m = a.getAttribute("href").match(/cat=(\w+)/);
        var isCur = m ? m[1] === cat : cat === "all";
        if (isCur) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
      });
      if (pushState) {
        var url = cat === "all" ? "products.html" : "products.html?cat=" + cat;
        history.replaceState(null, "", url);
      }
    }
    chips.forEach(function (c) {
      c.addEventListener("click", function () { q = ""; apply(c.dataset.filter, true); });
    });
    apply(current, false);
  }

  /* ---------- Header search (live suggestions) ---------- */
  function initSearch() {
    var form = $("[data-search]");
    if (!form) return;
    var input = $("input", form);
    var box = $(".search-results", form);
    var active = -1;

    function results(q) {
      q = q.toLowerCase();
      return BP.PRODUCTS.filter(function (p) {
        return (p.name + " " + p.desc + " " + BP.CATEGORIES[p.cat].name).toLowerCase().indexOf(q) !== -1;
      }).slice(0, 6);
    }
    function render() {
      var q = input.value.trim();
      active = -1;
      if (!q) { box.classList.remove("is-open"); return; }
      var list = results(q);
      box.innerHTML = list.length
        ? list.map(function (p) {
            return '<a role="option" href="design.html?product=' + p.id + '">' +
              BP.garmentSVG(p.garment, BP.COLORS[p.colors[0]].hex) + '<span>' + escapeHTML(p.name) + '</span></a>';
          }).join("")
        : '<div class="empty">No matches. Press Enter to search all products.</div>';
      box.classList.add("is-open");
    }
    input.addEventListener("input", render);
    input.addEventListener("focus", render);
    input.addEventListener("keydown", function (e) {
      var links = $$("a", box);
      if (!links.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
        links.forEach(function (l, i) { l.classList.toggle("is-active", i === active); });
      } else if (e.key === "Enter" && active > -1) {
        e.preventDefault();
        location.href = links[active].href;
      } else if (e.key === "Escape") {
        box.classList.remove("is-open");
      }
    });
    document.addEventListener("click", function (e) {
      if (!form.contains(e.target)) box.classList.remove("is-open");
    });
  }

  /* ---------- Banner slider ---------- */
  function initSlider() {
    var root = $("[data-slider]");
    if (!root) return;
    var slides = $$(".slide", root);
    var dotsWrap = $("[data-slide-dots]", root);
    var idx = 0, timer = null;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    dotsWrap.innerHTML = slides.map(function (_, i) {
      return '<button type="button" aria-label="Show slide ' + (i + 1) + '"></button>';
    }).join("");
    var dots = $$("button", dotsWrap);

    function go(i) {
      idx = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) {
        s.classList.toggle("is-active", n === idx);
        s.setAttribute("aria-hidden", String(n !== idx));
        s.tabIndex = n === idx ? 0 : -1;
      });
      dots.forEach(function (d, n) { d.setAttribute("aria-current", String(n === idx)); });
    }
    function play() { if (!reduce) { stop(); timer = setInterval(function () { go(idx + 1); }, 6000); } }
    function stop() { clearInterval(timer); }

    dots.forEach(function (d, n) { d.addEventListener("click", function () { go(n); play(); }); });
    $("[data-slide-prev]", root).addEventListener("click", function () { go(idx - 1); play(); });
    $("[data-slide-next]", root).addEventListener("click", function () { go(idx + 1); play(); });
    root.addEventListener("mouseenter", stop);
    root.addEventListener("mouseleave", play);
    root.addEventListener("focusin", stop);

    var startX = null;
    root.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; stop(); }, { passive: true });
    root.addEventListener("touchend", function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
      startX = null; play();
    });

    go(0);
    play();
  }

  /* ---------- Reviews scroller ---------- */
  function initReviews() {
    var row = $("[data-review-row]");
    if (!row) return;
    function step(dir) {
      var card = $(".review", row);
      var w = card ? card.getBoundingClientRect().width + 24 : 300;
      row.scrollBy({ left: dir * w, behavior: "smooth" });
    }
    $("[data-review-prev]").addEventListener("click", function () { step(-1); });
    $("[data-review-next]").addEventListener("click", function () { step(1); });
  }

  /* ---------- Newsletter (no backend yet) ---------- */
  function initNewsletter() {
    $$("[data-newsletter]").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        form.reset();
        toast("Thanks for signing up! Watch your inbox for deals.");
      });
    });
  }

  /* ---------- Quote form ---------- */
  function initQuoteForm() {
    var form = $("[data-quote-form]");
    if (!form) return;
    var params = new URLSearchParams(location.search);

    // Pre-fill from product card "Quote" links
    var prod = params.get("product");
    if (prod) {
      var p = BP.PRODUCTS.filter(function (x) { return x.name === prod; })[0];
      if (p) {
        form.product.value = BP.CATEGORIES[p.cat].name;
        form.message.value = "I'm interested in the " + p.name + ".\n";
      } else {
        var opt = $$("option", form.product).filter(function (o) { return o.value.toLowerCase().indexOf(prod.toLowerCase()) !== -1 || prod.toLowerCase().indexOf(o.value.toLowerCase().split(" ")[0]) === 0 && o.value; })[0];
        if (opt) form.product.value = opt.value;
      }
    }

    // Attach saved design from the Design Studio
    var design = params.get("from") === "design" ? loadDesign() : null;
    var summary = $("[data-design-summary]");
    if (design && summary) {
      var dp = BP.getProduct(design.productId);
      if (dp) {
        summary.hidden = false;
        summary.className = "design-summary";
        summary.innerHTML = BP.garmentSVG(dp.garment, design.colorHex) +
          '<div><strong>Your design is attached</strong><br>' +
          escapeHTML(dp.name) + ' · ' + escapeHTML(design.colorName) + ' · ' + escapeHTML(design.methodLabel) + ' · ' + escapeHTML(design.placementLabel) +
          (design.qty ? '<br>' + design.qty + ' pcs (' + escapeHTML(design.sizesText) + ') · est. $' + design.total.toFixed(2) : '') +
          (design.hasImage ? '<br>Includes uploaded logo' : '') + '</div>';
        form.product.value = BP.CATEGORIES[dp.cat].name;
        if (design.qty) form.quantity.value = design.qty;
        if (design.text) form.message.value = "Text on design: " + design.text.replace(/\n/g, " / ") + "\n";
      }
    }

    function setError(field, msg) {
      var wrap = field.closest(".field");
      var err = $(".error", wrap);
      wrap.classList.toggle("has-error", !!msg);
      if (msg) {
        if (!err) { err = document.createElement("span"); err.className = "error"; wrap.appendChild(err); }
        err.textContent = msg;
        field.setAttribute("aria-invalid", "true");
      } else {
        if (err) err.remove();
        field.removeAttribute("aria-invalid");
      }
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var firstBad = null;
      $$("[required]", form).forEach(function (f) {
        var msg = "";
        if (!f.value.trim()) msg = "This field is required.";
        else if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value)) msg = "Please enter a valid email.";
        setError(f, msg);
        if (msg && !firstBad) firstBad = f;
      });
      if (firstBad) { firstBad.focus(); return; }

      // TODO: connect to a backend (WordPress form plugin, Formspree, etc.)
      var name = form.name.value.trim().split(" ")[0];
      form.parentNode.innerHTML =
        '<div class="form-success">' +
          '<div class="icon-circle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
          '<h2>Thank you, ' + escapeHTML(name) + '!</h2>' +
          '<p>We got your request and someone from our family will reach out within one business day with your free quote and proof.</p>' +
          '<a class="btn btn--dark" href="products.html">Keep Browsing</a>' +
        '</div>';
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    $$("[required]", form).forEach(function (f) {
      f.addEventListener("input", function () { if (f.closest(".has-error")) setError(f, ""); });
    });
  }

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    var els = $$(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -40px 0px", threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
    initNav();
    initSearch();
    renderGarments(document);
    initProductGrids();
    initSlider();
    initReviews();
    initNewsletter();
    initQuoteForm();
    updateSavedBadge();
    initReveal();
  });
})();
