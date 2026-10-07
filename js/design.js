/* ==========================================================================
   Design Studio — pick a garment, color, decoration, add logo/text,
   drag it within the print area, and get an estimated price.
   ========================================================================== */

(function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];
  var UPCHARGE = { "2XL": 2, "3XL": 3 }; // placeholder size upcharges

  var state = {
    productId: null,
    colorKey: null,
    method: null,
    placementId: null,
    view: "front",
    text: "",
    font: "'Libre Baskerville', serif",
    textColor: "#ffffff",
    textSize: 11,
    image: null,
    imgSize: 70,
    offset: { x: 0, y: 0 }, // fraction of print area
    qty: {}
  };

  var els = {};

  function product() { return BP.getProduct(state.productId); }
  function placements() { return BP.PLACEMENTS[product().garment]; }
  function placement() {
    var list = placements();
    return list.filter(function (p) { return p.id === state.placementId; })[0] || list[0];
  }

  /* ---------- Builders ---------- */
  function buildCategoryPicker() {
    els.catPicker.innerHTML = Object.keys(BP.CATEGORIES).map(function (key) {
      var c = BP.CATEGORIES[key];
      return '<button type="button" data-cat="' + key + '" aria-pressed="false">' +
        BP.garmentSVG(c.garment, "#d9d4ca") + c.short + '</button>';
    }).join("");
    els.catPicker.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cat]");
      if (!b) return;
      var first = BP.PRODUCTS.filter(function (p) { return p.cat === b.dataset.cat; })[0];
      selectProduct(first.id);
    });
  }

  function buildProductSelect() {
    var groups = Object.keys(BP.CATEGORIES).map(function (key) {
      var opts = BP.PRODUCTS.filter(function (p) { return p.cat === key; }).map(function (p) {
        return '<option value="' + p.id + '">' + p.name + ' — from $' + p.price + '</option>';
      }).join("");
      return '<optgroup label="' + BP.CATEGORIES[key].name + '">' + opts + '</optgroup>';
    }).join("");
    els.productSelect.innerHTML = groups;
    els.productSelect.addEventListener("change", function () { selectProduct(els.productSelect.value); });
  }

  function selectProduct(id, colorKey) {
    var p = BP.getProduct(id) || BP.PRODUCTS[0];
    var prev = state.productId && product();
    var newCategory = !prev || prev.cat !== p.cat;
    state.productId = p.id;
    if (newCategory) { state.method = p.methods[0]; state.placementId = placements()[0].id; }
    state.colorKey = colorKey && p.colors.indexOf(colorKey) !== -1 ? colorKey : p.colors[0];
    if (p.methods.indexOf(state.method) === -1) state.method = p.methods[0];
    if (!placements().some(function (pl) { return pl.id === state.placementId; })) state.placementId = placements()[0].id;
    state.view = placement().view;
    state.offset = { x: 0, y: 0 };

    els.productSelect.value = p.id;
    $$("[data-cat]", els.catPicker).forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.cat === p.cat)); });

    // colors
    els.colorRow.innerHTML = p.colors.map(function (key) {
      var c = BP.COLORS[key];
      return '<button type="button" class="swatch" style="background:' + c.hex + '" data-color="' + key + '" aria-label="' + c.name + '" aria-pressed="' + (key === state.colorKey) + '"></button>';
    }).join("");

    // methods
    els.methodRow.innerHTML = p.methods.map(function (m) {
      var label = m === "print" ? "Screen Print" : "Embroidery";
      var note = m === "print" ? "Best for tees & big designs" : "Stitched, premium & durable";
      return '<div><input type="radio" name="method" id="m-' + m + '" value="' + m + '"' + (m === state.method ? " checked" : "") + '>' +
        '<label for="m-' + m + '"><strong>' + label + '</strong><span>' + note + '</span></label></div>';
    }).join("");

    // placements
    els.placement.innerHTML = placements().map(function (pl) {
      return '<option value="' + pl.id + '">' + pl.label + '</option>';
    }).join("");
    els.placement.value = state.placementId;

    // back view available?
    var hasBack = placements().some(function (pl) { return pl.view === "back"; });
    $('[data-view="back"]', els.viewToggle).disabled = !hasBack;

    // sizes
    var sizes = p.garment === "hat" ? ["One Size"] : SIZES;
    var prevTotal = totalQty();
    state.qty = {};
    els.sizeGrid.innerHTML = sizes.map(function (s, i) {
      var v = 0;
      if (sizes.length === 1) v = prevTotal || 12;
      else if (!prevTotal && (s === "M" || s === "L")) v = 6;
      state.qty[s] = v;
      return '<label>' + s + '<input type="number" min="0" inputmode="numeric" value="' + v + '" data-size="' + s + '" aria-label="Quantity ' + s + '"></label>';
    }).join("");
    if (sizes.length > 1 && prevTotal) {
      state.qty.M = Math.ceil(prevTotal / 2); state.qty.L = Math.floor(prevTotal / 2);
      $('[data-size="M"]').value = state.qty.M; $('[data-size="L"]').value = state.qty.L;
    }

    // default thread color contrasts with the garment
    var hex = BP.COLORS[state.colorKey].hex;
    if (!state.textTouched) {
      state.textColor = BP.isLight(hex) ? "#1f2a44" : "#ffffff";
      els.textColor.value = state.textColor;
    }
    render();
  }

  /* ---------- Rendering ---------- */
  function render() {
    var p = product();
    var color = BP.COLORS[state.colorKey];
    var pl = placement();

    els.stageSvg.innerHTML = BP.garmentSVG(p.garment, color.hex, { view: state.view, label: p.name + " in " + color.name + ", " + state.view + " view" });
    els.colorName.textContent = color.name;

    $$("button", els.viewToggle).forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.view === state.view)); });

    var b = pl.box;
    var onThisView = pl.view === state.view;
    els.printArea.style.left = (b[0] / 3) + "%";
    els.printArea.style.top = (b[1] / 3) + "%";
    els.printArea.style.width = (b[2] / 3) + "%";
    els.printArea.style.height = (b[3] / 3) + "%";
    els.printArea.hidden = !onThisView;
    els.printArea.classList.toggle("is-light", !BP.isLight(color.hex));
    els.printArea.classList.toggle("hide-guides", !els.guides.checked);

    // text
    els.designText.textContent = state.text;
    els.designText.hidden = !state.text;
    els.designText.style.fontFamily = state.font;
    els.designText.style.color = state.textColor;
    els.designText.classList.toggle("is-stitch", state.method === "embroidery");
    var areaW = els.printArea.getBoundingClientRect().width || 100;
    els.designText.style.fontSize = (areaW * state.textSize / 100).toFixed(1) + "px";

    // image
    if (state.image) {
      els.designImg.src = state.image;
      els.designImg.hidden = false;
      els.designImg.style.width = (areaW * state.imgSize / 100) + "px";
    } else {
      els.designImg.hidden = true;
      els.designImg.removeAttribute("src");
    }
    els.imgControls.hidden = !state.image;

    positionLayer();
    updatePrice();
  }

  function positionLayer() {
    var area = els.printArea.getBoundingClientRect();
    els.layer.style.transform = "translate(calc(-50% + " + (state.offset.x * area.width) + "px), calc(-50% + " + (state.offset.y * area.height) + "px))";
  }

  /* ---------- Pricing ---------- */
  function totalQty() {
    return Object.keys(state.qty).reduce(function (s, k) { return s + (state.qty[k] || 0); }, 0);
  }

  function computePrice() {
    var p = product();
    var qty = totalQty();
    var deco = BP.PRICING.decoration[state.method];
    var garment = 0;
    Object.keys(state.qty).forEach(function (s) { garment += (p.price + (UPCHARGE[s] || 0)) * (state.qty[s] || 0); });
    var decoTotal = deco * qty;
    var tier = BP.PRICING.tiers.filter(function (t) { return qty >= t.min; })[0] || { off: 0 };
    var subtotal = garment + decoTotal;
    var total = subtotal * (1 - tier.off);
    return { qty: qty, garment: garment, deco: decoTotal, off: tier.off, total: total, each: qty ? total / qty : 0 };
  }

  function money(n) { return "$" + n.toFixed(2); }

  function updatePrice() {
    var pr = computePrice();
    $("[data-sum-garment]").textContent = money(pr.garment);
    $("[data-sum-deco]").textContent = money(pr.deco);
    $("[data-sum-method]").textContent = state.method === "print" ? "screen print" : "embroidery";
    $("[data-sum-discount]").textContent = pr.off ? "−" + Math.round(pr.off * 100) + "%" : "Order 12+ to save";
    $("[data-sum-each]").textContent = money(pr.each);
    $("[data-sum-qty]").textContent = pr.qty;
    $("[data-sum-total]").textContent = money(pr.total);
  }

  /* ---------- Drag to position ---------- */
  function initDrag() {
    var start = null;
    els.layer.addEventListener("pointerdown", function (e) {
      if (!state.text && !state.image) return;
      e.preventDefault();
      els.layer.setPointerCapture(e.pointerId);
      start = { x: e.clientX, y: e.clientY, ox: state.offset.x, oy: state.offset.y };
    });
    els.layer.addEventListener("pointermove", function (e) {
      if (!start) return;
      var area = els.printArea.getBoundingClientRect();
      var layer = els.layer.getBoundingClientRect();
      var maxX = Math.max(0, (area.width - layer.width) / 2 / area.width);
      var maxY = Math.max(0, (area.height - layer.height) / 2 / area.height);
      state.offset.x = clamp(start.ox + (e.clientX - start.x) / area.width, -maxX, maxX);
      state.offset.y = clamp(start.oy + (e.clientY - start.y) / area.height, -maxY, maxY);
      positionLayer();
    });
    ["pointerup", "pointercancel"].forEach(function (ev) {
      els.layer.addEventListener(ev, function () { start = null; });
    });
  }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* ---------- Upload ---------- */
  function readFile(file) {
    if (!file || !/^image\//.test(file.type)) { BPToast("Please choose an image file (PNG, JPG or SVG)."); return; }
    if (file.size > 8 * 1024 * 1024) { BPToast("That file is over 8MB. Email it to us instead!"); return; }
    var reader = new FileReader();
    reader.onload = function () { state.image = reader.result; state.offset = { x: 0, y: 0 }; render(); BPToast("Logo added. Drag it to position."); };
    reader.readAsDataURL(file);
  }

  /* ---------- Save / quote ---------- */
  function snapshot() {
    var p = product();
    var pr = computePrice();
    var sizesText = Object.keys(state.qty).filter(function (k) { return state.qty[k]; })
      .map(function (k) { return k + "×" + state.qty[k]; }).join(", ");
    return {
      productId: p.id,
      colorKey: state.colorKey,
      colorHex: BP.COLORS[state.colorKey].hex,
      colorName: BP.COLORS[state.colorKey].name,
      method: state.method,
      methodLabel: state.method === "print" ? "Screen Print" : "Embroidery",
      placementId: placement().id,
      placementLabel: placement().label,
      text: state.text,
      font: state.font,
      textColor: state.textColor,
      textSize: state.textSize,
      imgSize: state.imgSize,
      offset: state.offset,
      hasImage: !!state.image,
      qtyBySize: state.qty,
      qty: pr.qty,
      sizesText: sizesText,
      total: pr.total,
      savedAt: Date.now()
    };
  }

  function persist() {
    var snap = snapshot();
    // Images can exceed storage limits; try with the image first, then without.
    var withImg = Object.assign({}, snap, { image: state.image });
    return BPDesignStore.save(withImg) || BPDesignStore.save(snap);
  }

  function restore(saved) {
    selectProduct(saved.productId, saved.colorKey);
    if (product().methods.indexOf(saved.method) !== -1) state.method = saved.method;
    state.placementId = saved.placementId;
    state.view = placement().view;
    state.text = saved.text || "";
    state.font = saved.font || state.font;
    state.textColor = saved.textColor || state.textColor;
    state.textSize = saved.textSize || state.textSize;
    state.imgSize = saved.imgSize || state.imgSize;
    state.image = saved.image || null;
    state.offset = saved.offset || { x: 0, y: 0 };
    state.textTouched = true;
    if (saved.qtyBySize) {
      Object.keys(saved.qtyBySize).forEach(function (k) {
        var input = $('[data-size="' + k + '"]');
        if (input) { input.value = saved.qtyBySize[k]; state.qty[k] = saved.qtyBySize[k]; }
      });
    }
    els.textInput.value = state.text;
    els.font.value = state.font;
    els.textColor.value = state.textColor;
    els.textSize.value = state.textSize;
    els.imgSize.value = state.imgSize;
    els.placement.value = state.placementId;
    var radio = $('input[name="method"][value="' + state.method + '"]');
    if (radio) radio.checked = true;
    render();
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    els = {
      catPicker: $("[data-cat-picker]"),
      productSelect: $("[data-product-select]"),
      colorRow: $("[data-color-row]"),
      colorName: $("[data-color-name]"),
      methodRow: $("[data-method-row]"),
      placement: $("[data-placement]"),
      stageSvg: $("[data-stage-svg]"),
      printArea: $("[data-print-area]"),
      layer: $("[data-design-layer]"),
      designText: $("[data-design-text]"),
      designImg: $("[data-design-img]"),
      imgControls: $("[data-img-controls]"),
      imgSize: $("[data-img-size]"),
      textInput: $("[data-text-input]"),
      font: $("[data-font]"),
      textColor: $("[data-text-color]"),
      textSize: $("[data-text-size]"),
      sizeGrid: $("[data-size-grid]"),
      viewToggle: $("[data-view-toggle]"),
      guides: $("[data-guides]")
    };
    if (!els.stageSvg) return;

    buildCategoryPicker();
    buildProductSelect();

    els.colorRow.addEventListener("click", function (e) {
      var b = e.target.closest("[data-color]");
      if (!b) return;
      state.colorKey = b.dataset.color;
      $$("[data-color]", els.colorRow).forEach(function (s) { s.setAttribute("aria-pressed", String(s === b)); });
      if (!state.textTouched) {
        state.textColor = BP.isLight(BP.COLORS[state.colorKey].hex) ? "#1f2a44" : "#ffffff";
        els.textColor.value = state.textColor;
      }
      render();
    });
    els.methodRow.addEventListener("change", function (e) { state.method = e.target.value; render(); });
    els.placement.addEventListener("change", function () {
      state.placementId = els.placement.value;
      state.view = placement().view;
      state.offset = { x: 0, y: 0 };
      render();
    });
    els.viewToggle.addEventListener("click", function (e) {
      var b = e.target.closest("[data-view]");
      if (!b || b.disabled) return;
      state.view = b.dataset.view;
      // jump to the first placement on that side
      var pl = placements().filter(function (x) { return x.view === state.view; })[0];
      if (pl && placement().view !== state.view) {
        state.placementId = pl.id; els.placement.value = pl.id; state.offset = { x: 0, y: 0 };
      }
      render();
    });
    els.guides.addEventListener("change", render);
    $("[data-center]").addEventListener("click", function () { state.offset = { x: 0, y: 0 }; positionLayer(); });

    els.textInput.addEventListener("input", function () { state.text = els.textInput.value; render(); });
    els.font.addEventListener("change", function () { state.font = els.font.value; render(); });
    els.textColor.addEventListener("input", function () { state.textColor = els.textColor.value; state.textTouched = true; render(); });
    els.textSize.addEventListener("input", function () { state.textSize = +els.textSize.value; render(); });
    els.imgSize.addEventListener("input", function () { state.imgSize = +els.imgSize.value; render(); });
    $("[data-remove-img]").addEventListener("click", function () { state.image = null; render(); });

    var upload = $("[data-upload]");
    $("[data-file]").addEventListener("change", function (e) { readFile(e.target.files[0]); e.target.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) {
      upload.addEventListener(ev, function (e) { e.preventDefault(); upload.classList.add("is-drag"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      upload.addEventListener(ev, function (e) { e.preventDefault(); upload.classList.remove("is-drag"); });
    });
    upload.addEventListener("drop", function (e) { readFile(e.dataTransfer.files[0]); });

    els.sizeGrid.addEventListener("input", function (e) {
      var s = e.target.dataset.size;
      if (!s) return;
      state.qty[s] = Math.max(0, parseInt(e.target.value, 10) || 0);
      updatePrice();
    });

    $("[data-save-design]").addEventListener("click", function () {
      if (persist()) {
        var badge = $("[data-saved-count]"); if (badge) badge.hidden = false;
        BPToast("Design saved on this device.");
      } else {
        BPToast("Couldn’t save in this browser. Request a quote instead!");
      }
    });
    $("[data-request-quote]").addEventListener("click", function () {
      if (!totalQty()) { BPToast("Add at least one piece in Sizes & quantity."); return; }
      persist();
      location.href = "contact.html?from=design";
    });

    initDrag();
    var resizeTimer;
    window.addEventListener("resize", function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 100); });

    var params = new URLSearchParams(location.search);
    var saved = BPDesignStore.load();
    if (params.get("product")) {
      selectProduct(params.get("product"), params.get("color"));
    } else if (saved && BP.getProduct(saved.productId)) {
      restore(saved);
    } else {
      selectProduct("warmup-jacket");
      state.text = "Jane Smith, RN\nCardiology";
      els.textInput.value = state.text;
      render();
    }
    // fonts load async; re-measure once ready
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
  });
})();
