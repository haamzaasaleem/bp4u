/* ==========================================================================
   BP4U Design Studio
   --------------------------------------------------------------------------
   Canvas-based designer (Fabric.js) with multiple views per garment, real
   inch measurements, embroidery rules, per-person names, live pricing and a
   production package (zip) for the shop.
   ========================================================================== */

(function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var S = 2;              // canvas px per garment viewBox unit (viewBox is 300 → canvas 600)
  var CANVAS = 600;
  var PRINT_DPI = 300;
  var MAX_PRINT_PX = 5400;
  var STORE_KEY = "bp4u-studio";
  var PROPS = ["bpKind", "bpSrc", "bpArt", "bpId"];
  var SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"];
  var UPCHARGE = { "2XL": 2, "3XL": 3, "4XL": 4 }; // placeholder size upcharges
  var CONFIG = window.BP_CONFIG || {};

  var FONTS = [
    "Inter", "Montserrat", "Oswald", "Bebas Neue", "Anton", "Roboto Slab",
    "Libre Baskerville", "Playfair Display", "Lobster", "Pacifico", "Great Vibes", "Permanent Marker"
  ];

  var CLIPART = [
    { id: "heart", name: "Heart", d: "M50 88 C20 66 6 48 6 32 C6 18 17 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 48 80 66 50 88 Z" },
    { id: "star", name: "Star", d: "M50 6 L62 38 L96 38 L68 58 L79 92 L50 71 L21 92 L32 58 L4 38 L38 38 Z" },
    { id: "cross", name: "Medical cross", d: "M36 6 H64 V36 H94 V64 H64 V94 H36 V64 H6 V36 H36 Z" },
    { id: "tooth", name: "Tooth", d: "M30 8 C18 8 10 18 12 34 C14 50 20 58 22 74 C24 88 28 94 33 94 C40 94 40 70 50 70 C60 70 60 94 67 94 C72 94 76 88 78 74 C80 58 86 50 88 34 C90 18 82 8 70 8 C62 8 58 12 50 12 C42 12 38 8 30 8 Z" },
    { id: "check", name: "Check badge", d: "M50 4 A46 46 0 1 1 49.9 4 Z M28 52 L43 67 L74 34 L67 27 L43 52 L35 44 Z", evenodd: true },
    { id: "bolt", name: "Lightning", d: "M58 4 L18 56 H46 L38 96 L82 40 H54 Z" },
    { id: "leaf", name: "Leaf", d: "M88 10 C40 10 12 36 12 70 C12 80 16 88 20 92 C26 60 48 44 70 36 C52 48 34 66 28 94 C64 96 90 68 88 10 Z" },
    { id: "house", name: "House", d: "M50 8 L94 46 H82 V92 H60 V64 H40 V92 H18 V46 H6 Z" },
    { id: "mountain", name: "Mountains", d: "M4 88 L36 30 L52 56 L66 36 L96 88 Z" },
    { id: "sun", name: "Sun", d: "M50 30 A20 20 0 1 1 49.9 30 Z M47 2 H53 V20 H47 Z M47 80 H53 V98 H47 Z M2 47 H20 V53 H2 Z M80 47 H98 V53 H80 Z" },
    { id: "paw", name: "Paw", d: "M50 52 C68 52 80 70 76 82 C72 92 60 88 50 88 C40 88 28 92 24 82 C20 70 32 52 50 52 Z M22 30 a8 10 0 1 0 0.1 0 Z M38 14 a8 10 0 1 0 0.1 0 Z M62 14 a8 10 0 1 0 0.1 0 Z M78 30 a8 10 0 1 0 0.1 0 Z" },
    { id: "crown", name: "Crown", d: "M8 80 L14 30 L34 52 L50 20 L66 52 L86 30 L92 80 Z M10 86 H90 V94 H10 Z" },
    { id: "flame", name: "Flame", d: "M50 4 C58 26 80 36 80 62 C80 82 66 96 50 96 C34 96 20 82 20 62 C20 46 30 38 34 26 C38 40 44 44 48 44 C46 30 46 16 50 4 Z" }
  ];

  /* ---------- state ---------- */
  var state = {
    designName: "Untitled design",
    productId: null,
    colorKey: null,
    method: null,
    viewId: "front",
    qty: {},
    names: { enabled: false, rows: [], preview: 0 },
    uploads: {}         // id -> { name, type, dataURL, placeable }
  };
  var canvases = {};    // viewId -> fabric.Canvas
  var history = {};     // viewId -> { stack: [], i: -1, lock: false }
  var pendingJSON = {}; // viewId -> json waiting to be loaded (product switch / restore)
  var saveTimer, thumbTimer;

  /* ---------- helpers ---------- */
  function product() { return BP.getProduct(state.productId); }
  function garment() { return product().garment; }
  function views() { return BP.VIEWS[garment()]; }
  function view(id) { return views().filter(function (v) { return v.id === (id || state.viewId); })[0] || views()[0]; }
  function area(v) { v = v || view(); return { x: v.area[0] * S, y: v.area[1] * S, w: v.area[2] * S, h: v.area[3] * S }; }
  function ppi(v) { v = v || view(); return (v.area[2] * S) / v.inW; }
  function inH(v) { return +(v.area[3] / v.area[2] * v.inW).toFixed(2); }
  function cv() { return canvases[state.viewId]; }
  function colorHex() { return BP.COLORS[state.colorKey].hex; }
  function isEmb() { return state.method === "embroidery"; }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function money(n) { return "$" + n.toFixed(2); }
  function inch(n) { return n.toFixed(2) + "″"; }
  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function threadName(hex) {
    hex = (hex || "").toLowerCase();
    var t = BP.THREADS.filter(function (x) { return x.hex === hex; })[0];
    return t ? t.name : hex;
  }
  function defaultInk() { return BP.isLight(colorHex()) ? "#1f2a44" : "#ffffff"; }
  function toast(msg) { if (window.BPToast) window.BPToast(msg); }
  function dataURLtoBlob(url) {
    var parts = url.split(","), mime = parts[0].match(/:(.*?);/)[1], bin = atob(parts[1]);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  function loadImage(src) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = rej;
      img.src = src;
    });
  }

  /* ======================================================================
     Stage: one Fabric canvas per view, garment drawing behind it
     ====================================================================== */
  fabric.Object.prototype.set({
    transparentCorners: false, cornerColor: "#ffffff", cornerStrokeColor: "#0f2a5c",
    borderColor: "#2e8540", cornerSize: 12, cornerStyle: "circle", padding: 4, borderScaleFactor: 1.5
  });

  function buildStage() {
    // remember current designs before tearing down
    Object.keys(canvases).forEach(function (id) {
      pendingJSON[id] = canvases[id].toJSON(PROPS);
      canvases[id].dispose();
    });
    canvases = {};
    var stage = $("[data-stage]");
    stage.innerHTML = "";

    views().forEach(function (v) {
      var a = area(v);
      var layer = document.createElement("div");
      layer.className = "view-layer";
      layer.dataset.view = v.id;
      layer.innerHTML =
        '<div class="garment-bg" data-garment-bg></div>' +
        '<canvas width="' + CANVAS + '" height="' + CANVAS + '"></canvas>' +
        '<div class="print-guide" style="left:' + (v.area[0] / 3) + '%;top:' + (v.area[1] / 3) + '%;width:' + (v.area[2] / 3) + '%;height:' + (v.area[3] / 3) + '%">' +
          '<span>' + v.inW + '″ × ' + inH(v) + '″ ' + (isEmb() ? "stitch" : "print") + ' area</span></div>';
      stage.appendChild(layer);

      var c = new fabric.Canvas($("canvas", layer), {
        preserveObjectStacking: true, enableRetinaScaling: true, stopContextMenu: true, fireRightClick: false
      });
      c.clipPath = new fabric.Rect({ left: a.x, top: a.y, width: a.w, height: a.h });
      canvases[v.id] = c;
      history[v.id] = history[v.id] && pendingJSON[v.id] ? history[v.id] : { stack: [], i: -1, lock: false };

      ["object:added", "object:removed", "object:modified"].forEach(function (ev) {
        c.on(ev, function () { onCanvasChange(v.id); });
      });
      c.on("text:changed", function () { syncTextPanel(); onCanvasChange(v.id, true); });
      ["selection:created", "selection:updated", "selection:cleared"].forEach(function (ev) {
        c.on(ev, function () { onSelection(); });
      });
      c.on("object:moving", liveReadout);
      c.on("object:scaling", liveReadout);
      c.on("object:rotating", liveReadout);

      if (pendingJSON[v.id]) {
        var json = pendingJSON[v.id];
        delete pendingJSON[v.id];
        history[v.id].lock = true;
        c.loadFromJSON(json, function () {
          c.clipPath = new fabric.Rect({ left: a.x, top: a.y, width: a.w, height: a.h });
          c.renderAll();
          history[v.id].lock = false;
          if (history[v.id].i < 0) pushHistory(v.id);
          refreshFonts(c);
          scheduleThumbs();
        });
      } else {
        pushHistory(v.id);
      }
    });
    // anything left in pendingJSON belongs to views this garment doesn't have
    var dropped = Object.keys(pendingJSON).filter(function (id) { return pendingJSON[id].objects && pendingJSON[id].objects.length; });
    if (dropped.length) toast("This product has no " + dropped.join(", ") + " area, so those designs were removed.");
    pendingJSON = {};

    paintGarments();
    buildViewThumbs();
    setView(views().some(function (v) { return v.id === state.viewId; }) ? state.viewId : "front");
    resizeStage();
  }

  function paintGarments() {
    views().forEach(function (v) {
      var layer = $('.view-layer[data-view="' + v.id + '"]');
      if (!layer) return;
      $("[data-garment-bg]", layer).innerHTML = BP.viewSVG(garment(), v.id, colorHex());
      $(".print-guide", layer).classList.toggle("is-dark", !BP.isLight(colorHex()));
      $(".print-guide span", layer).textContent = v.inW + "″ × " + inH(v) + "″ " + (isEmb() ? "stitch" : "print") + " area";
    });
    scheduleThumbs();
  }

  function resizeStage() {
    var wrap = $("[data-stage-wrap]");
    var size = Math.floor(Math.min(wrap.clientWidth - 24, wrap.clientHeight - 24, 760));
    size = Math.max(size, 240);
    if (document.body.classList.contains("is-zoomed")) size = Math.round(size * 1.7);
    var stage = $("[data-stage]");
    stage.style.width = size + "px";
    stage.style.height = size + "px";
    Object.keys(canvases).forEach(function (id) {
      canvases[id].setDimensions({ width: size + "px", height: size + "px" }, { cssOnly: true });
      canvases[id].calcOffset();
    });
    // keep Fabric's pointer math in sync after scrolling the zoomed stage
    wrap.onscroll = function () { Object.keys(canvases).forEach(function (id) { canvases[id].calcOffset(); }); };
  }

  function setView(id) {
    state.viewId = id;
    $$(".view-layer").forEach(function (l) { l.hidden = l.dataset.view !== id; });
    $$("[data-view-thumb]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.viewThumb === id)); });
    Object.keys(canvases).forEach(function (k) { if (k !== id) canvases[k].discardActiveObject().renderAll(); });
    if (cv()) cv().calcOffset();
    renderPresets();
    onSelection();
  }

  /* ---------- view thumbnails (right column) ---------- */
  function buildViewThumbs() {
    $("[data-view-thumbs]").innerHTML = views().map(function (v) {
      return '<button type="button" class="view-thumb" data-view-thumb="' + v.id + '" aria-pressed="false">' +
        '<span class="vt-img">' + BP.viewSVG(garment(), v.id, colorHex()) + '<img alt="" data-thumb-art></span>' +
        '<span class="vt-label">' + v.label + '</span><span class="vt-dot" hidden></span></button>';
    }).join("");
  }
  function scheduleThumbs() {
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(updateThumbs, 250);
  }
  function updateThumbs() {
    views().forEach(function (v) {
      var btn = $('[data-view-thumb="' + v.id + '"]');
      var c = canvases[v.id];
      if (!btn || !c) return;
      $(".vt-img svg", btn).outerHTML = BP.viewSVG(garment(), v.id, colorHex());
      var has = c.getObjects().length > 0;
      var img = $("[data-thumb-art]", btn);
      if (has) {
        img.src = c.toDataURL({ format: "png", multiplier: 0.2, enableRetinaScaling: false });
        img.hidden = false;
      } else {
        img.hidden = true;
      }
      $(".vt-dot", btn).hidden = !has;
    });
  }

  /* ======================================================================
     Changes, history, autosave
     ====================================================================== */
  function onCanvasChange(viewId, soft) {
    var h = history[viewId];
    if (!h || h.lock) return;
    if (!soft) pushHistory(viewId);
    scheduleThumbs();
    scheduleSave();
    updateWarnings();
    updatePriceBar();
  }
  function pushHistory(viewId) {
    var h = history[viewId];
    var json = JSON.stringify(canvases[viewId].toJSON(PROPS));
    if (h.stack[h.i] === json) return;
    h.stack = h.stack.slice(0, h.i + 1);
    h.stack.push(json);
    if (h.stack.length > 60) h.stack.shift();
    h.i = h.stack.length - 1;
    updateUndoButtons();
  }
  function restoreHistory(dir) {
    var id = state.viewId, h = history[id], c = cv();
    var next = h.i + dir;
    if (next < 0 || next >= h.stack.length) return;
    h.i = next;
    h.lock = true;
    var a = area();
    c.loadFromJSON(JSON.parse(h.stack[h.i]), function () {
      c.clipPath = new fabric.Rect({ left: a.x, top: a.y, width: a.w, height: a.h });
      c.renderAll();
      h.lock = false;
      onSelection();
      scheduleThumbs();
      scheduleSave();
      updateUndoButtons();
      updatePriceBar();
    });
  }
  function updateUndoButtons() {
    var h = history[state.viewId];
    if (!h) return;
    $("[data-undo]").disabled = h.i <= 0;
    $("[data-redo]").disabled = h.i >= h.stack.length - 1;
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 700);
  }
  function snapshotDesign(includeUploads) {
    var v = {};
    Object.keys(canvases).forEach(function (id) { v[id] = canvases[id].toJSON(PROPS); });
    var uploads = {};
    Object.keys(state.uploads).forEach(function (k) {
      var u = state.uploads[k];
      uploads[k] = { name: u.name, type: u.type, placeable: u.placeable, dataURL: includeUploads ? u.dataURL : null };
    });
    return {
      v: 2, designName: state.designName, productId: state.productId, colorKey: state.colorKey, method: state.method,
      qty: state.qty, names: state.names, views: v, uploads: uploads, savedAt: Date.now()
    };
  }
  function save(manual) {
    var ok = false;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(snapshotDesign(true))); ok = true; } catch (e) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(snapshotDesign(false))); ok = true; } catch (e2) { ok = false; }
    }
    if (manual) toast(ok ? "Design saved on this device." : "This design is too large to save in your browser. Finish your order in this tab.");
    $("[data-save-status]").textContent = ok ? "Saved" : "Not saved";
    return ok;
  }
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { return null; }
  }

  /* ======================================================================
     Adding objects
     ====================================================================== */
  function center() { var a = area(); return { x: a.x + a.w / 2, y: a.y + a.h / 2 }; }

  function fitInto(obj, frac) {
    var a = area();
    obj.setCoords();
    var br = obj.getBoundingRect(true, true);
    var k = Math.min((a.w * frac) / br.width, (a.h * frac) / br.height, 1);
    if (k < 1) obj.scale((obj.scaleX || 1) * k);
  }

  function place(obj, frac) {
    var c = cv(), p = center();
    obj.set({ originX: "center", originY: "center", left: p.x, top: p.y });
    obj.bpId = obj.bpId || uid();
    fitInto(obj, frac || 0.6);
    c.add(obj);
    c.setActiveObject(obj);
    c.requestRenderAll();
  }

  function addText(text, kind) {
    var size = Math.max(ppi() * 0.9, 18);
    var font = $("[data-new-font]") ? $("[data-new-font]").value : "Inter";
    var t = new fabric.IText(text || "Your text", {
      fontFamily: font, fontSize: size, fill: defaultInk(), textAlign: "center",
      fontWeight: isEmb() ? "700" : "400", paintFirst: "stroke", strokeWidth: 0, stroke: null
    });
    t.bpKind = kind || "text";
    place(t, 0.8);
    ensureFont(font).then(function () { reflowText(t); });
    return t;
  }

  function addImage(uploadId) {
    var u = state.uploads[uploadId];
    if (!u || !u.placeable) return;
    fabric.Image.fromURL(u.dataURL, function (img) {
      img.bpKind = "image";
      img.bpSrc = uploadId;
      place(img, 0.6);
      updateWarnings();
    });
  }

  function addArt(art) {
    var path = new fabric.Path(art.d, { fill: defaultInk(), fillRule: art.evenodd ? "evenodd" : "nonzero", strokeWidth: 0 });
    path.bpKind = "art";
    path.bpArt = art.id;
    path.scaleToWidth(ppi() * 2.5);
    place(path, 0.6);
  }

  /* ---------- fonts ---------- */
  function ensureFont(name) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('40px "' + name + '"'),
      document.fonts.load('bold 40px "' + name + '"')
    ]).catch(function () {});
  }
  function reflowText(t) {
    if (fabric.util.clearFabricFontCache) fabric.util.clearFabricFontCache(t.fontFamily);
    t.initDimensions();
    t.setCoords();
    if (t.canvas) t.canvas.requestRenderAll();
  }
  function refreshFonts(c) {
    c.getObjects().forEach(function (o) {
      if (o.type === "i-text") ensureFont(o.fontFamily).then(function () { reflowText(o); });
    });
  }

  /* ======================================================================
     Selection: toolbar, readout, warnings, panels
     ====================================================================== */
  function active() { return cv() ? cv().getActiveObject() : null; }

  function onSelection() {
    var o = active();
    $("[data-obj-toolbar]").hidden = !o;
    liveReadout();
    syncTextPanel();
    syncArtPanel();
    updateWarnings();
    updateUndoButtons();
    if (o && (o.type === "i-text") && !$('[data-panel="text"]').classList.contains("is-open") && window.innerWidth > 900) openPanel("text");
  }

  function boundsIn(o, v) {
    v = v || view();
    var a = area(v), k = ppi(v);
    o.setCoords();
    var br = o.getBoundingRect(true, true);
    return {
      w: br.width / k, h: br.height / k,
      left: (br.left - a.x) / k, top: (br.top - a.y) / k,
      cx: (br.left + br.width / 2 - (a.x + a.w / 2)) / k,
      inside: br.left >= a.x - 1 && br.top >= a.y - 1 && br.left + br.width <= a.x + a.w + 1 && br.top + br.height <= a.y + a.h + 1
    };
  }

  function liveReadout() {
    var o = active(), el = $("[data-readout]");
    if (!o) { el.hidden = true; return; }
    var b = boundsIn(o);
    el.hidden = false;
    el.textContent = inch(b.w) + " W × " + inch(b.h) + " H";
  }

  function objectWarnings(o, v) {
    var w = [];
    var b = boundsIn(o, v);
    if (!b.inside) w.push("Part of your design is outside the " + (isEmb() ? "stitch" : "print") + " area and will be cut off.");
    if (o.type === "i-text") {
      var capIn = (o.fontSize * (o.scaleY || 1) * 0.7) / ppi(v);
      if (isEmb() && capIn < 0.25) w.push("Text under 0.25″ tall is hard to stitch clearly. Make it a little bigger.");
      if (!isEmb() && capIn < 0.12) w.push("This text is very small and may not print clearly.");
    }
    if (o.type === "image" && o._element) {
      var natural = o._element.naturalWidth || o.width;
      var dpi = natural / (b.w || 1);
      if (dpi < 150) w.push("Low resolution: this image is about " + Math.round(dpi) + " DPI at this size. Upload a larger file or shrink it.");
      if (isEmb()) w.push("We’ll convert your logo to stitches. Small details and gradients get simplified.");
    }
    return w;
  }

  function updateWarnings() {
    var o = active(), box = $("[data-warnings]");
    var list = o ? objectWarnings(o) : [];
    box.innerHTML = list.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join("");
    box.hidden = !list.length;
  }

  /* ---------- object toolbar actions ---------- */
  function doAction(act) {
    var c = cv(), o = active();
    if (!o) return;
    if (act === "delete") {
      if (o.type === "activeSelection") { o.forEachObject(function (x) { c.remove(x); }); c.discardActiveObject(); }
      else c.remove(o);
    } else if (act === "duplicate") {
      o.clone(function (cl) {
        cl.set({ left: o.left + 14, top: o.top + 14 });
        PROPS.forEach(function (p) { if (o[p] != null) cl[p] = o[p]; });
        cl.bpId = uid();
        if (cl.type === "activeSelection") {
          cl.canvas = c;
          cl.forEachObject(function (x) { x.bpId = uid(); c.add(x); });
          cl.setCoords();
        } else c.add(cl);
        c.setActiveObject(cl);
      }, PROPS);
    } else if (act === "center") {
      var a = area();
      o.setPositionByOrigin(new fabric.Point(a.x + a.w / 2, o.getCenterPoint().y), "center", "center");
      o.setCoords();
      c.fire("object:modified", { target: o });
    } else if (act === "forward") { c.bringForward(o); c.fire("object:modified", { target: o }); }
    else if (act === "backward") { c.sendBackwards(o); c.fire("object:modified", { target: o }); }
    else if (act === "flip") { o.set("flipX", !o.flipX); c.fire("object:modified", { target: o }); }
    c.requestRenderAll();
    onSelection();
  }

  function applyPreset(p) {
    var c = cv(), o = active();
    if (!o) {
      var objs = c.getObjects();
      if (!objs.length) { toast("Add text, art, or a logo first."); return; }
      o = objs.length === 1 ? objs[0] : new fabric.ActiveSelection(objs, { canvas: c });
      c.setActiveObject(o);
    }
    var k = ppi(), a = area();
    o.setCoords();
    var br = o.getBoundingRect(true, true);
    var s = (p.w * k) / br.width;
    o.scaleX *= s; o.scaleY *= s;
    o.setCoords();
    br = o.getBoundingRect(true, true);
    var cx = a.x + p.cx * k, top = a.y + p.top * k;
    o.setPositionByOrigin(new fabric.Point(cx, top + br.height / 2), "center", "center");
    o.setCoords();
    c.fire("object:modified", { target: o });
    c.requestRenderAll();
    liveReadout();
    updateWarnings();
  }

  function renderPresets() {
    var v = view();
    $("[data-presets]").innerHTML = '<span>Quick place:</span>' + v.presets.map(function (p, i) {
      return '<button type="button" class="chip chip--sm" data-preset="' + i + '">' + p.label + ' <small>' + p.w + '″</small></button>';
    }).join("");
  }

  /* ======================================================================
     Panels
     ====================================================================== */
  function openPanel(name) {
    $$("[data-rail]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.rail === name)); });
    $$("[data-panel]").forEach(function (p) { p.classList.toggle("is-open", p.dataset.panel === name); });
    document.body.classList.add("panel-open");
  }
  function closePanel() {
    document.body.classList.remove("panel-open");
    $$("[data-rail]").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
  }

  /* ---------- product panel ---------- */
  function renderProductPanel() {
    var p = product();
    $("[data-cat-tabs]").innerHTML = Object.keys(BP.CATEGORIES).map(function (k) {
      return '<button type="button" class="chip chip--sm" data-cat-tab="' + k + '" aria-pressed="' + (k === p.cat) + '">' + BP.CATEGORIES[k].short + '</button>';
    }).join("");
    $("[data-style-list]").innerHTML = BP.PRODUCTS.filter(function (x) { return x.cat === p.cat; }).map(function (x) {
      return '<button type="button" class="style-item" data-style="' + x.id + '" aria-pressed="' + (x.id === p.id) + '">' +
        BP.garmentSVG(x.garment, BP.COLORS[x.colors[0]].hex) +
        '<span><strong>' + esc(x.name) + '</strong><small>From $' + x.price.toFixed(2) + ' · ' + x.methods.map(function (m) { return m === "print" ? "Print" : "Embroidery"; }).join(" / ") + '</small></span></button>';
    }).join("");
    $("[data-color-list]").innerHTML = p.colors.map(function (k) {
      var c = BP.COLORS[k];
      return '<button type="button" class="swatch swatch--lg" style="background:' + c.hex + '" data-color="' + k + '" aria-label="' + c.name + '" title="' + c.name + '" aria-pressed="' + (k === state.colorKey) + '"></button>';
    }).join("");
    $("[data-color-name]").textContent = BP.COLORS[state.colorKey].name;
    $("[data-method-list]").innerHTML = p.methods.map(function (m) {
      var label = m === "print" ? "Screen Print" : "Embroidery";
      var note = m === "print" ? "Full color, best for tees & big designs" : "Stitched, premium & built to last";
      return '<label class="method-opt"><input type="radio" name="method" value="' + m + '"' + (m === state.method ? " checked" : "") + '>' +
        '<span><strong>' + label + '</strong><small>' + note + '</small></span></label>';
    }).join("");
  }

  function selectProduct(id, colorKey) {
    var p = BP.getProduct(id) || BP.PRODUCTS[0];
    var prevGarment = state.productId ? garment() : null;
    state.productId = p.id;
    state.colorKey = colorKey && p.colors.indexOf(colorKey) !== -1 ? colorKey : (p.colors.indexOf(state.colorKey) !== -1 ? state.colorKey : p.colors[0]);
    if (p.methods.indexOf(state.method) === -1) setMethod(p.methods[0], true);
    if (prevGarment !== p.garment) buildStage(); else paintGarments();
    renderProductPanel();
    renderSizeInputs();
    updateBottomBar();
    scheduleSave();
  }

  function setMethod(m, silent) {
    state.method = m;
    document.body.classList.toggle("is-embroidery", m === "embroidery");
    renderThreadSwatches();
    if (!state.productId) return;
    if (Object.keys(canvases).length) paintGarments();
    updateBottomBar();
    updateWarnings();
    if (m === "embroidery" && !silent) maybeShowTips();
    scheduleSave();
  }

  function maybeShowTips(force) {
    var seen = false;
    try { seen = sessionStorage.getItem("bp4u-tips") === "1"; } catch (e) {}
    if (seen && !force) return;
    openModal("tips");
    try { sessionStorage.setItem("bp4u-tips", "1"); } catch (e) {}
  }

  /* ---------- color swatch rows (threads) ---------- */
  function renderThreadSwatches() {
    $$("[data-thread-row]").forEach(function (row) {
      row.innerHTML = BP.THREADS.map(function (t) {
        return '<button type="button" class="swatch" style="background:' + t.hex + '" data-thread="' + t.hex + '" title="' + t.name + '" aria-label="' + t.name + '"></button>';
      }).join("") + (isEmb() ? "" : '<label class="swatch swatch--custom" title="Custom color"><input type="color" data-custom-color aria-label="Custom color">+</label>');
    });
  }

  /* ---------- text panel ---------- */
  function syncTextPanel() {
    var o = active();
    var isText = o && o.type === "i-text";
    $("[data-text-new]").hidden = !!isText;
    $("[data-text-edit]").hidden = !isText;
    if (!isText) return;
    var ta = $("[data-text-content]");
    if (document.activeElement !== ta) ta.value = o.text;
    $("[data-text-font]").value = o.fontFamily;
    $("[data-text-bold]").setAttribute("aria-pressed", String(o.fontWeight === "700" || o.fontWeight === "bold"));
    $("[data-text-italic]").setAttribute("aria-pressed", String(o.fontStyle === "italic"));
    $$("[data-text-align]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.textAlign === o.textAlign)); });
    $("[data-text-spacing]").value = o.charSpacing || 0;
    $("[data-text-outline]").value = o.strokeWidth || 0;
    markSwatch("[data-thread-row=fill]", o.fill);
    markSwatch("[data-thread-row=stroke]", o.stroke);
    $("[data-text-color-name]").textContent = threadName(o.fill);
    $("[data-text-kind]").hidden = !(o.bpKind === "name" || o.bpKind === "line2");
  }
  function markSwatch(rowSel, hex) {
    $$(rowSel + " [data-thread]").forEach(function (s) { s.setAttribute("aria-pressed", String((hex || "").toLowerCase() === s.dataset.thread)); });
  }
  function setOnActive(props) {
    var o = active();
    if (!o) return;
    o.set(props);
    if (o.type === "i-text") reflowText(o);
    o.setCoords();
    cv().requestRenderAll();
    cv().fire("object:modified", { target: o });
    syncTextPanel();
    syncArtPanel();
    liveReadout();
  }

  /* ---------- art panel ---------- */
  function syncArtPanel() {
    var o = active();
    var isArt = o && o.type === "path";
    $("[data-art-color]").hidden = !isArt;
    if (isArt) markSwatch("[data-thread-row=art]", o.fill);
  }

  /* ---------- uploads ---------- */
  function handleFiles(files) {
    Array.prototype.forEach.call(files, function (file) {
      var ext = (file.name.split(".").pop() || "").toLowerCase();
      var isVectorDoc = ["pdf", "ai", "eps", "psd", "dst", "pes", "emb"].indexOf(ext) !== -1;
      if (file.size > 25 * 1024 * 1024) { toast(file.name + " is over 25MB. Please email it to us."); return; }
      var reader = new FileReader();
      reader.onload = function () {
        var id = uid();
        if (isVectorDoc || !/^image\//.test(file.type)) {
          state.uploads[id] = { name: file.name, type: file.type || ext, dataURL: reader.result, placeable: false };
          renderUploads();
          toast(file.name + " attached. Our artists will use it for your order.");
          scheduleSave();
          return;
        }
        prepareImage(reader.result, file.type).then(function (url) {
          state.uploads[id] = { name: file.name, type: file.type, dataURL: url, original: reader.result, placeable: true };
          renderUploads();
          addImage(id);
          scheduleSave();
        });
      };
      reader.readAsDataURL(file);
    });
  }
  // downscale very large rasters for the editor (originals are still kept)
  function prepareImage(url, type) {
    if (type === "image/svg+xml") return Promise.resolve(url);
    return loadImage(url).then(function (img) {
      var max = 4000;
      if (img.naturalWidth <= max && img.naturalHeight <= max) return url;
      var k = max / Math.max(img.naturalWidth, img.naturalHeight);
      var c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/png");
    }).catch(function () { return url; });
  }
  function renderUploads() {
    var ids = Object.keys(state.uploads);
    $("[data-upload-list]").innerHTML = ids.length ? ids.map(function (id) {
      var u = state.uploads[id];
      return '<div class="upload-item">' +
        (u.placeable && u.dataURL ? '<img src="' + u.dataURL + '" alt="">' : '<span class="file-ico">' + esc((u.name.split(".").pop() || "FILE").toUpperCase()) + '</span>') +
        '<span class="upload-name">' + esc(u.name) + '</span>' +
        (u.placeable && u.dataURL ? '<button type="button" class="link-btn" data-add-upload="' + id + '">Add</button>' : '<small>attached</small>') +
        '<button type="button" class="icon-btn" data-remove-upload="' + id + '" aria-label="Remove ' + esc(u.name) + '">×</button></div>';
    }).join("") : '<p class="hint">No uploads yet.</p>';
  }

  /* ---------- names (personalization) ---------- */
  function renderNames() {
    var n = state.names;
    $("[data-names-toggle]").checked = n.enabled;
    $("[data-names-body]").hidden = !n.enabled;
    var sizeOpts = function (sel) {
      var list = garment() === "hat" ? ["OSFA"] : SIZES;
      return list.map(function (s) { return '<option' + (s === sel ? " selected" : "") + '>' + s + '</option>'; }).join("");
    };
    $("[data-names-rows]").innerHTML = n.rows.map(function (r, i) {
      return '<div class="name-row" data-row="' + i + '">' +
        '<input type="text" placeholder="Name" value="' + esc(r.name) + '" data-f="name" aria-label="Name ' + (i + 1) + '">' +
        '<input type="text" placeholder="Title / credentials" value="' + esc(r.line2) + '" data-f="line2" aria-label="Line 2 for row ' + (i + 1) + '">' +
        '<select data-f="size" aria-label="Size for row ' + (i + 1) + '">' + sizeOpts(r.size) + '</select>' +
        '<button type="button" class="icon-btn" data-del-row="' + i + '" aria-label="Remove row ' + (i + 1) + '">×</button></div>';
    }).join("");
    $("[data-names-count]").textContent = n.rows.length + (n.rows.length === 1 ? " person" : " people");
    var cur = n.rows[n.preview];
    $("[data-names-preview]").textContent = cur ? (cur.name || "(blank)") + (cur.line2 ? " · " + cur.line2 : "") : "No names yet";
  }
  function applyNamePreview() {
    var row = state.names.rows[state.names.preview] || { name: "Name", line2: "Title" };
    Object.keys(canvases).forEach(function (id) {
      var c = canvases[id], changed = false;
      c.getObjects().forEach(function (o) {
        if (o.bpKind === "name" && o.text !== (row.name || "Name")) { o.set("text", row.name || "Name"); reflowText(o); changed = true; }
        if (o.bpKind === "line2" && o.text !== (row.line2 || " ")) { o.set("text", row.line2 || " "); reflowText(o); changed = true; }
      });
      if (changed) c.requestRenderAll();
    });
    scheduleThumbs();
  }
  function addNameFields() {
    var c = cv();
    var has = c.getObjects().some(function (o) { return o.bpKind === "name"; });
    if (has) { toast("Name fields are already on this side."); return; }
    var row = state.names.rows[state.names.preview] || { name: "Jane Smith, RN", line2: "Cardiology" };
    var k = ppi();
    var nm = new fabric.IText(row.name || "Name", { fontFamily: "Libre Baskerville", fontSize: k * 0.45, fill: defaultInk(), fontWeight: "700", textAlign: "center", originX: "center", originY: "center" });
    var l2 = new fabric.IText(row.line2 || "Title", { fontFamily: "Inter", fontSize: k * 0.3, fill: defaultInk(), fontWeight: "600", textAlign: "center", originX: "center", originY: "center" });
    nm.bpKind = "name"; l2.bpKind = "line2"; nm.bpId = uid(); l2.bpId = uid();
    var preset = view().presets[0];
    var cx = area().x + preset.cx * k, top = area().y + preset.top * k;
    nm.set({ left: cx, top: top + k * 0.3 });
    l2.set({ left: cx, top: top + k * 0.75 });
    // keep the name block inside narrow zones like sleeves
    [nm, l2].forEach(function (t) {
      t.setCoords();
      var maxW = area().w * 0.92;
      if (t.getScaledWidth() > maxW) t.scale((t.scaleX || 1) * maxW / t.getScaledWidth());
    });
    c.add(nm); c.add(l2);
    c.setActiveObject(nm);
    c.requestRenderAll();
    ensureFont("Libre Baskerville").then(function () { reflowText(nm); });
    ensureFont("Inter").then(function () { reflowText(l2); });
  }
  // One person per line. Tabs (spreadsheet paste): Name<TAB>Line 2<TAB>Size.
  // Commas: the last part is the size if it looks like one, the part before it
  // is line 2, and everything else is the name ("Jane Smith, RN, Cardiology, M").
  function parsePastedNames(text) {
    var valid = SIZES.concat(["OSFA"]);
    return text.split(/\r?\n/).map(function (line) {
      line = line.trim();
      if (!line) return null;
      var parts = (line.indexOf("\t") !== -1 ? line.split("\t") : line.split(",")).map(function (x) { return x.trim().replace(/^"|"$/g, ""); });
      var size = "M";
      if (parts.length > 1 && valid.indexOf(parts[parts.length - 1].toUpperCase()) !== -1) size = parts.pop().toUpperCase();
      var line2 = parts.length > 1 ? parts.pop() : "";
      return { name: parts.join(", "), line2: line2, size: garment() === "hat" ? "OSFA" : size };
    }).filter(function (r) { return r && r.name; });
  }

  /* ======================================================================
     Pricing
     ====================================================================== */
  function decoratedViews() {
    return views().filter(function (v) { return canvases[v.id] && canvases[v.id].getObjects().length; });
  }
  function qtyBySize() {
    if (state.names.enabled && state.names.rows.length) {
      var q = {};
      state.names.rows.forEach(function (r) { q[r.size] = (q[r.size] || 0) + 1; });
      return q;
    }
    return state.qty;
  }
  function inkColors(c) {
    var set = {};
    c.getObjects().forEach(function (o) {
      if (o.type === "image") set["img-" + o.bpSrc] = 1;
      else {
        if (o.fill && typeof o.fill === "string") set[o.fill.toLowerCase()] = 1;
        if (o.strokeWidth && o.stroke) set[o.stroke.toLowerCase()] = 1;
      }
    });
    return Object.keys(set).length;
  }
  function locationInfo(v) {
    var c = canvases[v.id];
    var objs = c.getObjects();
    var b;
    if (objs.length === 1) b = boundsIn(objs[0], v);
    else {
      // bounding box of all objects without mutating them
      var xs = [], ys = [], k = ppi(v), a = area(v);
      objs.forEach(function (o) { o.setCoords(); var r = o.getBoundingRect(true, true); xs.push(r.left, r.left + r.width); ys.push(r.top, r.top + r.height); });
      var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
      b = { w: (maxX - minX) / k, h: (maxY - minY) / k, left: (minX - a.x) / k, top: (minY - a.y) / k, cx: ((minX + maxX) / 2 - (a.x + a.w / 2)) / k };
    }
    return { view: v, bounds: b, colors: inkColors(c), sqIn: b.w * b.h };
  }
  function computePrice() {
    var p = product();
    var q = qtyBySize();
    var qty = Object.keys(q).reduce(function (s, k) { return s + (q[k] || 0); }, 0);
    var locs = decoratedViews().map(locationInfo);
    var decoEach = locs.reduce(function (sum, l) {
      var fee = BP.PRICING.decoration[state.method];
      if (isEmb() && l.sqIn > 16) fee += BP.PRICING.largeEmbroidery;
      if (!isEmb()) fee += Math.max(0, l.colors - 1) * BP.PRICING.extraPrintColor;
      return sum + fee;
    }, 0);
    var garmentTotal = 0;
    Object.keys(q).forEach(function (s) { garmentTotal += (p.price + (UPCHARGE[s] || 0)) * (q[s] || 0); });
    var decoTotal = decoEach * qty;
    var tier = BP.PRICING.tiers.filter(function (t) { return qty >= t.min; })[0] || { off: 0 };
    var subtotal = garmentTotal + decoTotal;
    var total = subtotal * (1 - tier.off);
    return { qty: qty, q: q, locs: locs, decoEach: decoEach, garmentTotal: garmentTotal, decoTotal: decoTotal, off: tier.off, total: total, each: qty ? total / qty : 0 };
  }
  function updatePriceBar() {
    var pr = computePrice();
    $("[data-bar-price]").textContent = pr.qty ? money(pr.each) + " each · " + pr.qty + " pcs" : (pr.locs.length ? pr.locs.length + " location" + (pr.locs.length > 1 ? "s" : "") + " decorated" : "Start designing");
  }
  function updateBottomBar() {
    var p = product();
    $("[data-bar-name]").textContent = p.name;
    $("[data-bar-color]").textContent = BP.COLORS[state.colorKey].name + " · " + (isEmb() ? "Embroidery" : "Screen Print");
    $("[data-bar-thumb]").innerHTML = BP.garmentSVG(p.garment, colorHex());
    $("[data-bar-swatch]").style.background = colorHex();
    updatePriceBar();
  }

  function renderSizeInputs() {
    var list = garment() === "hat" ? ["OSFA"] : SIZES;
    var q = {};
    list.forEach(function (s) { q[s] = state.qty[s] || 0; });
    if (!Object.keys(q).some(function (k) { return q[k]; })) {
      if (list.length === 1) q.OSFA = 12; else { q.M = 6; q.L = 6; }
    }
    state.qty = q;
  }

  /* ======================================================================
     Modals: tips, price/order
     ====================================================================== */
  function openModal(name) {
    $$("[data-modal]").forEach(function (m) { m.hidden = m.dataset.modal !== name; });
    $("[data-modal-root]").hidden = false;
    document.body.classList.add("modal-open");
    var first = $('[data-modal="' + name + '"] [data-autofocus]') || $('[data-modal="' + name + '"] button');
    if (first) first.focus();
  }
  function closeModal() {
    $("[data-modal-root]").hidden = true;
    document.body.classList.remove("modal-open");
  }

  function openPrice() {
    Object.keys(canvases).forEach(function (id) { canvases[id].discardActiveObject().renderAll(); });
    if (!decoratedViews().length) { toast("Add a logo, text, or art to your design first."); return; }
    renderPriceStep();
    showStep("qty");
    openModal("price");
  }
  function showStep(step) {
    $$("[data-step]").forEach(function (s) { s.hidden = s.dataset.step !== step; });
  }
  function renderPriceStep() {
    var named = state.names.enabled && state.names.rows.length;
    $("[data-qty-named]").hidden = !named;
    $("[data-qty-grid]").hidden = !!named;
    if (named) $("[data-qty-named]").textContent = "Quantities come from your names list (" + state.names.rows.length + " people). Edit sizes in the Names tab.";
    var list = garment() === "hat" ? ["OSFA"] : SIZES;
    $("[data-qty-grid]").innerHTML = list.map(function (s) {
      return '<label>' + (s === "OSFA" ? "One size" : s) + (UPCHARGE[s] ? '<small>+$' + UPCHARGE[s] + '</small>' : '<small>&nbsp;</small>') +
        '<input type="number" min="0" inputmode="numeric" value="' + (state.qty[s] || 0) + '" data-qty-size="' + s + '"></label>';
    }).join("");
    renderPriceSummary();
  }
  function renderPriceSummary() {
    var pr = computePrice();
    var locs = pr.locs.map(function (l) {
      return '<li><strong>' + l.view.label + '</strong> · ' + inch(l.bounds.w) + ' × ' + inch(l.bounds.h) +
        (isEmb() ? "" : " · " + l.colors + " color" + (l.colors > 1 ? "s" : "")) + '</li>';
    }).join("");
    var nextTier = BP.PRICING.tiers.slice().reverse().filter(function (t) { return t.min > pr.qty; })[0];
    $("[data-price-summary]").innerHTML =
      '<ul class="loc-list">' + locs + '</ul>' +
      '<div class="summary-line"><span>Garments</span><span>' + money(pr.garmentTotal) + '</span></div>' +
      '<div class="summary-line"><span>' + (isEmb() ? "Embroidery" : "Printing") + ' (' + pr.locs.length + ' location' + (pr.locs.length > 1 ? "s" : "") + ')</span><span>' + money(pr.decoTotal) + '</span></div>' +
      '<div class="summary-line"><span>Bulk discount</span><span>' + (pr.off ? "−" + Math.round(pr.off * 100) + "%" : "—") + '</span></div>' +
      '<div class="summary-line total"><span>' + pr.qty + ' pcs · ' + money(pr.each) + ' each</span><span>' + money(pr.total) + '</span></div>' +
      (nextTier ? '<p class="hint">Order ' + nextTier.min + '+ to save ' + Math.round(nextTier.off * 100) + '%.</p>' : "") +
      '<p class="hint">Estimate. Your exact price is confirmed on your free proof.</p>';
    $("[data-to-details]").disabled = !pr.qty;
    updatePriceBar();
  }

  /* ======================================================================
     Production package
     ====================================================================== */
  function orderId() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return "BP-" + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  }
  function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "file"; }

  function objectSpec(o, v) {
    var b = boundsIn(o, v);
    var spec = {
      type: o.bpKind || o.type,
      widthIn: +b.w.toFixed(2), heightIn: +b.h.toFixed(2),
      fromZoneLeftIn: +b.left.toFixed(2), fromZoneTopIn: +b.top.toFixed(2),
      offsetFromCenterIn: +b.cx.toFixed(2),
      rotationDeg: Math.round(o.angle || 0), flipped: !!o.flipX
    };
    if (o.type === "i-text") {
      spec.text = o.text; spec.font = o.fontFamily; spec.bold = o.fontWeight === "700" || o.fontWeight === "bold";
      spec.italic = o.fontStyle === "italic"; spec.align = o.textAlign; spec.letterSpacing = o.charSpacing || 0;
      spec.color = o.fill; spec.colorName = threadName(o.fill);
      if (o.strokeWidth) { spec.outline = o.stroke; spec.outlineName = threadName(o.stroke); spec.outlineWidth = o.strokeWidth; }
      spec.capHeightIn = +((o.fontSize * (o.scaleY || 1) * 0.7) / ppi(v)).toFixed(2);
    } else if (o.type === "path") {
      spec.art = o.bpArt; spec.color = o.fill; spec.colorName = threadName(o.fill);
    } else if (o.type === "image") {
      var u = state.uploads[o.bpSrc] || {};
      spec.file = u.name; spec.effectiveDpi = Math.round((o._element ? o._element.naturalWidth : o.width) / (b.w || 1));
    }
    return spec;
  }

  function exportPrint(v) {
    var c = canvases[v.id], a = area(v);
    var targetPx = Math.min(v.inW * PRINT_DPI, MAX_PRINT_PX);
    return c.toDataURL({ format: "png", left: a.x, top: a.y, width: a.w, height: a.h, multiplier: targetPx / a.w, enableRetinaScaling: false });
  }
  function exportSVG(v) {
    var c = canvases[v.id], a = area(v);
    return c.toSVG({ viewBox: { x: a.x, y: a.y, width: a.w, height: a.h }, width: v.inW + "in", height: inH(v) + "in" });
  }
  function exportMockup(v, size) {
    size = size || 1200;
    var svg = BP.viewSVG(garment(), v.id, colorHex(), { size: size });
    var art = canvases[v.id].toDataURL({ format: "png", multiplier: size / CANVAS, enableRetinaScaling: false });
    return Promise.all([loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)), loadImage(art)]).then(function (imgs) {
      var c = document.createElement("canvas");
      c.width = size; c.height = size;
      var ctx = c.getContext("2d");
      ctx.fillStyle = "#f4f7fb"; ctx.fillRect(0, 0, size, size);
      ctx.drawImage(imgs[0], 0, 0, size, size);
      ctx.drawImage(imgs[1], 0, 0, size, size);
      return c.toDataURL("image/png");
    });
  }

  function buildPackage(customer) {
    var id = orderId();
    var zip = new JSZip();
    var pr = computePrice();
    var p = product();
    var locs = decoratedViews();
    Object.keys(canvases).forEach(function (k) { canvases[k].discardActiveObject().renderAll(); });

    var order = {
      orderId: id, createdAt: new Date().toISOString(), designName: state.designName,
      customer: customer,
      product: { id: p.id, name: p.name, category: BP.CATEGORIES[p.cat].name, color: BP.COLORS[state.colorKey].name, colorHex: colorHex() },
      decoration: isEmb() ? "Embroidery" : "Screen Print",
      quantities: pr.q, totalPieces: pr.qty,
      estimate: { each: +pr.each.toFixed(2), total: +pr.total.toFixed(2), discount: pr.off },
      personalization: state.names.enabled ? state.names.rows : null,
      locations: [], attachments: []
    };

    var mockups = {};
    var chain = Promise.resolve();
    locs.forEach(function (v) {
      chain = chain.then(function () {
        var c = canvases[v.id];
        var spec = {
          location: v.label, zoneWidthIn: v.inW, zoneHeightIn: inH(v),
          artworkBounds: (function () { var b = locationInfo(v).bounds; return { widthIn: +b.w.toFixed(2), heightIn: +b.h.toFixed(2), fromZoneLeftIn: +b.left.toFixed(2), fromZoneTopIn: +b.top.toFixed(2), offsetFromCenterIn: +b.cx.toFixed(2) }; })(),
          colors: inkColors(c),
          objects: c.getObjects().map(function (o) { return objectSpec(o, v); }),
          files: { print: "print-files/" + v.id + "-print-300dpi.png", vector: "print-files/" + v.id + ".svg", mockup: "mockups/" + v.id + ".png" }
        };
        order.locations.push(spec);
        zip.file(spec.files.print, dataURLtoBlob(exportPrint(v)));
        zip.file(spec.files.vector, exportSVG(v));
        return exportMockup(v).then(function (url) {
          mockups[v.id] = url;
          zip.file(spec.files.mockup, dataURLtoBlob(url));
        });
      });
    });

    // one print file per person for sides that carry name fields
    chain = chain.then(function () {
      if (!state.names.enabled || !state.names.rows.length) return;
      var nameViews = locs.filter(function (v) { return canvases[v.id].getObjects().some(function (o) { return o.bpKind === "name" || o.bpKind === "line2"; }); });
      var rows = state.names.rows.slice(0, 150);
      var csv = "Name,Line 2,Size\n" + state.names.rows.map(function (r) {
        return [r.name, r.line2, r.size].map(function (x) { return '"' + String(x || "").replace(/"/g, '""') + '"'; }).join(",");
      }).join("\n");
      zip.file("names.csv", csv);
      var keep = state.names.preview;
      rows.forEach(function (r, i) {
        state.names.preview = i;
        applyNamePreview();
        nameViews.forEach(function (v) {
          Object.keys(canvases).forEach(function (k) { canvases[k].renderAll(); });
          zip.file("print-files/names/" + String(i + 1).padStart(3, "0") + "-" + slug(r.name) + "-" + v.id + ".png", dataURLtoBlob(exportPrint(v)));
        });
      });
      state.names.preview = keep;
      applyNamePreview();
    });

    return chain.then(function () {
      Object.keys(state.uploads).forEach(function (k) {
        var u = state.uploads[k];
        var src = u.original || u.dataURL;
        if (!src) return;
        var fname = "originals/" + slug(u.name.replace(/\.[^.]+$/, "")) + "-" + k + "." + (u.name.split(".").pop() || "bin");
        zip.file(fname, dataURLtoBlob(src));
        order.attachments.push({ name: u.name, file: fname, placedOnDesign: !!u.placeable });
      });
      zip.file("order.json", JSON.stringify(order, null, 2));
      zip.file("work-order.html", workOrderHTML(order, mockups));
      zip.file("README.txt", readme(order));
      return zip.generateAsync({ type: "blob", compression: "DEFLATE" }).then(function (blob) {
        return { id: id, blob: blob, order: order, filename: id + "-" + slug(customer.name) + ".zip" };
      });
    });
  }

  function readme(o) {
    return [
      "BUSINESS PRINTING 4 U: PRODUCTION PACKAGE",
      "Order " + o.orderId + " · " + new Date(o.createdAt).toLocaleString(),
      "",
      "work-order.html          Open in a browser and print. Proof, placements, sizes, colors.",
      "order.json               Everything in machine-readable form.",
      "print-files/*-300dpi.png Transparent artwork at 300 DPI, real size of each decoration zone.",
      "print-files/*.svg        Vector version (text stays editable; fonts listed in work order).",
      "print-files/names/       One print file per person (personalized orders).",
      "mockups/                 Garment previews for the customer proof.",
      "originals/               Customer's original uploaded files, untouched.",
      "names.csv                Names list (personalized orders).",
      "",
      "Embroidery: digitize from the SVG/PNG at the listed size and thread colors.",
      "Placement: measured from the top-left of each decoration zone; 'offset from center'",
      "is the horizontal distance from the zone's center line (negative = viewer's left)."
    ].join("\r\n");
  }

  function workOrderHTML(o, mockups) {
    var row = function (k, v) { return '<tr><th>' + esc(k) + '</th><td>' + esc(v) + '</td></tr>'; };
    var sizes = Object.keys(o.quantities).filter(function (k) { return o.quantities[k]; }).map(function (k) { return '<td><b>' + k + '</b><br>' + o.quantities[k] + '</td>'; }).join("");
    var locs = o.locations.map(function (l) {
      var objs = l.objects.map(function (x) {
        var what = x.type === "image" ? "Logo: " + x.file + " (" + x.effectiveDpi + " DPI)" :
          x.type === "art" ? "Clip art: " + x.art : (x.type === "name" ? "NAME (from list)" : x.type === "line2" ? "LINE 2 (from list)" : "Text: “" + x.text + "”");
        var color = x.colorName ? " · " + x.colorName + " (" + x.color + ")" : "";
        var font = x.font ? " · " + x.font + (x.bold ? " Bold" : "") + (x.italic ? " Italic" : "") + " · cap height " + x.capHeightIn + "″" : "";
        var outline = x.outlineName ? " · outline " + x.outlineName : "";
        return '<li>' + esc(what + color + font + outline) + '<br><small>' + x.widthIn + '″ W × ' + x.heightIn + '″ H · ' + x.fromZoneTopIn + '″ from top of zone · ' +
          x.offsetFromCenterIn + '″ from center' + (x.rotationDeg ? ' · rotated ' + x.rotationDeg + '°' : '') + '</small></li>';
      }).join("");
      return '<section class="loc"><img src="' + (mockups[l.files.mockup.replace("mockups/", "").replace(".png", "")] || "") + '" alt="">' +
        '<div><h2>' + esc(l.location) + '</h2><p><b>Artwork size:</b> ' + l.artworkBounds.widthIn + '″ × ' + l.artworkBounds.heightIn + '″ · ' +
        l.artworkBounds.fromZoneTopIn + '″ from top of ' + l.zoneWidthIn + '″ × ' + l.zoneHeightIn + '″ zone · ' + l.artworkBounds.offsetFromCenterIn + '″ from center</p>' +
        '<ul>' + objs + '</ul><p class="files">Files: ' + esc(l.files.print) + ' · ' + esc(l.files.vector) + '</p></div></section>';
    }).join("");
    var names = o.personalization ? '<h2>Names (' + o.personalization.length + ')</h2><table class="names"><tr><th>#</th><th>Name</th><th>Line 2</th><th>Size</th></tr>' +
      o.personalization.map(function (r, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.line2) + '</td><td>' + esc(r.size) + '</td></tr>'; }).join("") + '</table>' : "";
    var c = o.customer;
    return '<!doctype html><html><head><meta charset="utf-8"><title>Work order ' + o.orderId + '</title><style>' +
      'body{font:14px/1.5 system-ui,sans-serif;color:#12182b;max-width:900px;margin:24px auto;padding:0 16px}h1{margin:0}h2{margin:0 0 6px;font-size:18px}' +
      'table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #d5dbe6;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f4f7fb;width:180px}' +
      '.sizes td{text-align:center}.loc{display:grid;grid-template-columns:260px 1fr;gap:18px;border:1px solid #d5dbe6;border-radius:10px;padding:14px;margin:14px 0;page-break-inside:avoid}' +
      '.loc img{width:100%;border-radius:8px;background:#f4f7fb}.files{color:#667085;font-size:12px}.top{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0f2a5c;padding-bottom:10px;margin-bottom:14px}' +
      '.names th{width:auto}@media print{button{display:none}}</style></head><body>' +
      '<div class="top"><div><h1>Work Order ' + o.orderId + '</h1><div>' + new Date(o.createdAt).toLocaleString() + '</div></div><button onclick="print()">Print</button></div>' +
      '<table>' + row("Customer", c.name) + row("Organization", c.organization || "—") + row("Email", c.email) + row("Phone", c.phone || "—") +
      row("Needed by", c.neededBy || "—") + row("Notes", c.notes || "—") + '</table>' +
      '<table>' + row("Product", o.product.name) + row("Garment color", o.product.color + " (" + o.product.colorHex + ")") + row("Decoration", o.decoration) +
      row("Total pieces", o.totalPieces) + row("Estimate", "$" + o.estimate.each.toFixed(2) + " each · $" + o.estimate.total.toFixed(2) + " total") + '</table>' +
      '<table class="sizes"><tr>' + sizes + '</tr></table>' + locs + names +
      (o.attachments.length ? '<h2>Customer files</h2><ul>' + o.attachments.map(function (a) { return '<li>' + esc(a.name) + ' → ' + esc(a.file) + (a.placedOnDesign ? "" : " (not placed, use as reference)") + '</li>'; }).join("") + '</ul>' : "") +
      '</body></html>';
  }

  function submitOrder(customer) {
    var btn = $("[data-submit-order]");
    btn.disabled = true;
    btn.textContent = "Preparing your files…";
    return buildPackage(customer).then(function (pkg) {
      var finish = function (sent) {
        var url = URL.createObjectURL(pkg.blob);
        $("[data-done-id]").textContent = pkg.id;
        $("[data-done-download]").href = url;
        $("[data-done-download]").download = pkg.filename;
        $("[data-done-sent]").hidden = !sent;
        $("[data-done-manual]").hidden = sent;
        $("[data-done-mail]").href = "mailto:" + (CONFIG.shopEmail || "scrabb@crabbdigitalmedia.com") +
          "?subject=" + encodeURIComponent("Design order " + pkg.id) +
          "&body=" + encodeURIComponent("Hi! I just designed an order on your website.\n\nOrder: " + pkg.id + "\nName: " + customer.name + "\nPhone: " + (customer.phone || "") + "\n\nI've attached my order file (" + pkg.filename + ").");
        showStep("done");
        if (!sent) $("[data-done-download]").click();
      };
      if (!CONFIG.orderEndpoint) { finish(false); return; }
      var fd = new FormData();
      fd.append("package", pkg.blob, pkg.filename);
      fd.append("order", JSON.stringify(pkg.order));
      fd.append("name", customer.name);
      fd.append("email", customer.email);
      fd.append("phone", customer.phone || "");
      fd.append("website", customer.website || ""); // honeypot
      return fetch(CONFIG.orderEndpoint, { method: "POST", body: fd })
        .then(function (r) { return r.json(); })
        .then(function (res) { finish(!!(res && res.ok)); })
        .catch(function () { finish(false); });
    }).catch(function (err) {
      console.error(err);
      toast("Something went wrong preparing your files. Please call us at (559) 474-2808.");
    }).then(function () {
      btn.disabled = false;
      btn.textContent = "Submit Order Request";
    });
  }

  /* ======================================================================
     Wiring
     ====================================================================== */
  function bind() {
    // rail + panels
    $$("[data-rail]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.getAttribute("aria-pressed") === "true" && window.innerWidth <= 900) closePanel();
        else openPanel(b.dataset.rail);
      });
    });
    $$("[data-close-panel]").forEach(function (b) { b.addEventListener("click", closePanel); });

    // product panel
    $("[data-cat-tabs]").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cat-tab]");
      if (!b) return;
      var first = BP.PRODUCTS.filter(function (x) { return x.cat === b.dataset.catTab; })[0];
      selectProduct(first.id);
    });
    $("[data-style-list]").addEventListener("click", function (e) {
      var b = e.target.closest("[data-style]");
      if (b) selectProduct(b.dataset.style);
    });
    $("[data-color-list]").addEventListener("click", function (e) {
      var b = e.target.closest("[data-color]");
      if (!b) return;
      state.colorKey = b.dataset.color;
      paintGarments();
      renderProductPanel();
      updateBottomBar();
      scheduleSave();
    });
    $("[data-method-list]").addEventListener("change", function (e) { setMethod(e.target.value); renderProductPanel(); });
    $$("[data-show-tips]").forEach(function (b) { b.addEventListener("click", function () { maybeShowTips(true); }); });

    // text
    $("[data-add-text]").addEventListener("click", function () {
      var v = $("[data-new-text]").value.trim();
      addText(v || "Your text");
      $("[data-new-text]").value = "";
    });
    $("[data-new-text]").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("[data-add-text]").click(); } });
    $("[data-text-content]").addEventListener("input", function (e) { var o = active(); if (o && o.type === "i-text") { o.set("text", e.target.value); reflowText(o); scheduleThumbs(); liveReadout(); } });
    $("[data-text-content]").addEventListener("change", function () { var o = active(); if (o) cv().fire("object:modified", { target: o }); });
    $("[data-text-font]").addEventListener("change", function (e) {
      var f = e.target.value;
      setOnActive({ fontFamily: f });
      ensureFont(f).then(function () { var o = active(); if (o) reflowText(o); });
    });
    $("[data-text-bold]").addEventListener("click", function () { var o = active(); if (o) setOnActive({ fontWeight: (o.fontWeight === "700" || o.fontWeight === "bold") ? "400" : "700" }); });
    $("[data-text-italic]").addEventListener("click", function () { var o = active(); if (o) setOnActive({ fontStyle: o.fontStyle === "italic" ? "normal" : "italic" }); });
    $$("[data-text-align]").forEach(function (b) { b.addEventListener("click", function () { setOnActive({ textAlign: b.dataset.textAlign }); }); });
    $("[data-text-spacing]").addEventListener("input", function (e) { setOnActive({ charSpacing: +e.target.value }); });
    $("[data-text-outline]").addEventListener("input", function (e) {
      var w = +e.target.value, o = active();
      setOnActive({ strokeWidth: w, stroke: w ? (o.stroke || (BP.isLight(o.fill) ? "#111111" : "#ffffff")) : null });
    });

    // thread / color swatches (fill, stroke, art)
    document.addEventListener("click", function (e) {
      var sw = e.target.closest("[data-thread]");
      if (!sw) return;
      var row = sw.closest("[data-thread-row]").dataset.threadRow;
      if (row === "fill" || row === "art") setOnActive({ fill: sw.dataset.thread });
      else if (row === "stroke") setOnActive({ stroke: sw.dataset.thread, strokeWidth: active().strokeWidth || 2 });
      if (row === "fill") $("[data-text-outline]").value = active().strokeWidth || 0;
    });
    document.addEventListener("input", function (e) {
      if (!e.target.matches("[data-custom-color]")) return;
      var row = e.target.closest("[data-thread-row]").dataset.threadRow;
      if (row === "stroke") setOnActive({ stroke: e.target.value, strokeWidth: active().strokeWidth || 2 });
      else setOnActive({ fill: e.target.value });
    });

    // art
    $("[data-art-grid]").innerHTML = CLIPART.map(function (a) {
      return '<button type="button" class="art-item" data-art="' + a.id + '" title="' + a.name + '"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="' + a.d + '"' + (a.evenodd ? ' fill-rule="evenodd"' : '') + '/></svg><span>' + a.name + '</span></button>';
    }).join("");
    $("[data-art-grid]").addEventListener("click", function (e) {
      var b = e.target.closest("[data-art]");
      if (b) addArt(CLIPART.filter(function (a) { return a.id === b.dataset.art; })[0]);
    });

    // uploads
    var drop = $("[data-dropzone]");
    $("[data-file-input]").addEventListener("change", function (e) { handleFiles(e.target.files); e.target.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-drag"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-drag"); }); });
    drop.addEventListener("drop", function (e) { handleFiles(e.dataTransfer.files); });
    // drop anywhere on the stage too
    var wrap = $("[data-stage-wrap]");
    ["dragenter", "dragover"].forEach(function (ev) { wrap.addEventListener(ev, function (e) { e.preventDefault(); wrap.classList.add("is-drag"); }); });
    ["dragleave", "drop"].forEach(function (ev) { wrap.addEventListener(ev, function (e) { e.preventDefault(); wrap.classList.remove("is-drag"); }); });
    wrap.addEventListener("drop", function (e) { if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });
    // paste images from clipboard
    document.addEventListener("paste", function (e) {
      if (e.target.matches("input, textarea")) return;
      var files = Array.prototype.filter.call((e.clipboardData || {}).files || [], function (f) { return /^image\//.test(f.type); });
      if (files.length) handleFiles(files);
    });
    $("[data-upload-list]").addEventListener("click", function (e) {
      var add = e.target.closest("[data-add-upload]"), rem = e.target.closest("[data-remove-upload]");
      if (add) addImage(add.dataset.addUpload);
      if (rem) {
        var id = rem.dataset.removeUpload;
        Object.keys(canvases).forEach(function (k) {
          canvases[k].getObjects().filter(function (o) { return o.bpSrc === id; }).forEach(function (o) { canvases[k].remove(o); });
        });
        delete state.uploads[id];
        renderUploads();
        scheduleSave();
      }
    });

    // names
    $("[data-names-toggle]").addEventListener("change", function (e) {
      state.names.enabled = e.target.checked;
      if (state.names.enabled && !state.names.rows.length) state.names.rows = [{ name: "", line2: "", size: "M" }];
      renderNames();
      updatePriceBar();
      scheduleSave();
    });
    $("[data-names-add]").addEventListener("click", function () {
      state.names.rows.push({ name: "", line2: "", size: "M" });
      renderNames();
      var inputs = $$("[data-names-rows] .name-row:last-child input");
      if (inputs[0]) inputs[0].focus();
    });
    $("[data-names-rows]").addEventListener("input", function (e) {
      var row = e.target.closest("[data-row]");
      if (!row) return;
      var r = state.names.rows[+row.dataset.row];
      r[e.target.dataset.f] = e.target.value;
      if (+row.dataset.row === state.names.preview) applyNamePreview();
      $("[data-names-preview]").textContent = (state.names.rows[state.names.preview] || {}).name || "(blank)";
      updatePriceBar();
      scheduleSave();
    });
    $("[data-names-rows]").addEventListener("click", function (e) {
      var b = e.target.closest("[data-del-row]");
      if (!b) return;
      state.names.rows.splice(+b.dataset.delRow, 1);
      state.names.preview = Math.min(state.names.preview, Math.max(0, state.names.rows.length - 1));
      renderNames(); applyNamePreview(); updatePriceBar(); scheduleSave();
    });
    $("[data-names-paste-apply]").addEventListener("click", function () {
      var rows = parsePastedNames($("[data-names-paste]").value);
      if (!rows.length) { toast("Paste one person per line: Name, Title, Size"); return; }
      state.names.rows = state.names.rows.filter(function (r) { return r.name; }).concat(rows);
      $("[data-names-paste]").value = "";
      renderNames(); applyNamePreview(); updatePriceBar(); scheduleSave();
      toast(rows.length + " names added.");
    });
    $("[data-names-place]").addEventListener("click", addNameFields);
    $$("[data-names-nav]").forEach(function (b) {
      b.addEventListener("click", function () {
        var n = state.names.rows.length;
        if (!n) return;
        state.names.preview = (state.names.preview + (+b.dataset.namesNav) + n) % n;
        renderNames(); applyNamePreview();
      });
    });

    // stage toolbar + presets + views
    $("[data-obj-toolbar]").addEventListener("click", function (e) { var b = e.target.closest("[data-act]"); if (b) doAction(b.dataset.act); });
    $("[data-presets]").addEventListener("click", function (e) { var b = e.target.closest("[data-preset]"); if (b) applyPreset(view().presets[+b.dataset.preset]); });
    $("[data-view-thumbs]").addEventListener("click", function (e) { var b = e.target.closest("[data-view-thumb]"); if (b) setView(b.dataset.viewThumb); });
    $("[data-zoom]").addEventListener("click", function () {
      var z = document.body.classList.toggle("is-zoomed");
      $("[data-zoom]").setAttribute("aria-pressed", String(z));
      resizeStage();
      var o = active(), wrap = $("[data-stage-wrap]");
      if (z) {
        // scroll so the print area (or selection) is in view
        var a = area(), k = $("[data-stage]").clientWidth / CANVAS;
        var cx = o ? o.getCenterPoint().x : a.x + a.w / 2, cy = o ? o.getCenterPoint().y : a.y + a.h / 3;
        wrap.scrollLeft = cx * k - wrap.clientWidth / 2;
        wrap.scrollTop = cy * k - wrap.clientHeight / 2;
      }
    });
    $("[data-guides]").addEventListener("change", function (e) { document.body.classList.toggle("hide-guides", !e.target.checked); });
    $("[data-undo]").addEventListener("click", function () { restoreHistory(-1); });
    $("[data-redo]").addEventListener("click", function () { restoreHistory(1); });

    // design name
    var dn = $("[data-design-name]");
    dn.value = state.designName;
    dn.addEventListener("input", function () { state.designName = dn.value || "Untitled design"; scheduleSave(); });

    // bottom bar
    $("[data-change-product]").addEventListener("click", function () { openPanel("product"); });
    $("[data-save]").addEventListener("click", function () { save(true); });
    $("[data-get-price]").addEventListener("click", openPrice);
    $("[data-new-design]").addEventListener("click", function () {
      if (!confirm("Start a new design? Your current design will be cleared.")) return;
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
      location.href = "design.html?product=" + state.productId + "&color=" + state.colorKey;
    });

    // modals
    $("[data-modal-root]").addEventListener("click", function (e) { if (e.target.matches("[data-modal-root], [data-close-modal]") || e.target.closest("[data-close-modal]")) closeModal(); });
    $("[data-qty-grid]").addEventListener("input", function (e) {
      var s = e.target.dataset.qtySize;
      if (!s) return;
      state.qty[s] = Math.max(0, parseInt(e.target.value, 10) || 0);
      renderPriceSummary();
      scheduleSave();
    });
    $("[data-to-details]").addEventListener("click", function () { showStep("details"); var f = $("[data-order-form] input"); if (f) f.focus(); });
    $("[data-back-qty]").addEventListener("click", function () { showStep("qty"); });
    $("[data-order-form]").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      var bad = $$("[required]", f).filter(function (x) { return !x.value.trim() || (x.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.value)); });
      $$(".field", f).forEach(function (x) { x.classList.remove("has-error"); });
      if (bad.length) { bad.forEach(function (x) { x.closest(".field").classList.add("has-error"); }); bad[0].focus(); return; }
      submitOrder({
        name: f.cname.value.trim(), email: f.cemail.value.trim(), phone: f.cphone.value.trim(),
        organization: f.corg.value.trim(), neededBy: f.cdate.value.trim(), notes: f.cnotes.value.trim(), website: f.website.value
      });
    });

    // keyboard
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { if (!$("[data-modal-root]").hidden) closeModal(); return; }
      var typing = e.target.matches("input, textarea, select") || (active() && active().isEditing);
      var mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); restoreHistory(e.shiftKey ? 1 : -1); return; }
      if (mod && e.key.toLowerCase() === "y" && !typing) { e.preventDefault(); restoreHistory(1); return; }
      if (typing || !active()) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); doAction("delete"); }
      else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); doAction("duplicate"); }
      else if (e.key.indexOf("Arrow") === 0) {
        e.preventDefault();
        var o = active(), step = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowLeft") o.left -= step;
        if (e.key === "ArrowRight") o.left += step;
        if (e.key === "ArrowUp") o.top -= step;
        if (e.key === "ArrowDown") o.top += step;
        o.setCoords(); cv().requestRenderAll(); liveReadout();
        clearTimeout(o._nudge); o._nudge = setTimeout(function () { cv().fire("object:modified", { target: o }); }, 300);
      }
    });

    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(resizeStage, 80); });
  }

  /* ---------- fonts list ---------- */
  function fillFontSelects() {
    var opts = FONTS.map(function (f) { return '<option value="' + f + '" style="font-family:\'' + f + '\'">' + f + '</option>'; }).join("");
    $$("[data-font-select]").forEach(function (s) { s.innerHTML = opts; });
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    if (!window.fabric || !$("[data-stage]")) return;
    fillFontSelects();
    renderThreadSwatches();
    bind();

    var params = new URLSearchParams(location.search);
    var saved = loadSaved();
    var startProduct = params.get("product");
    if (!startProduct && saved && saved.v === 2 && BP.getProduct(saved.productId)) {
      state.designName = saved.designName || state.designName;
      state.method = saved.method;
      state.qty = saved.qty || {};
      state.names = saved.names || state.names;
      Object.keys(saved.uploads || {}).forEach(function (k) {
        var u = saved.uploads[k];
        if (u.dataURL || !u.placeable) state.uploads[k] = u;
      });
      Object.keys(saved.views || {}).forEach(function (k) { pendingJSON[k] = saved.views[k]; });
      $("[data-design-name]").value = state.designName;
      setMethod(saved.method || "embroidery", true);
      selectProduct(saved.productId, saved.colorKey);
    } else {
      var p = BP.getProduct(startProduct) || BP.getProduct("warmup-jacket");
      setMethod(p.methods[0], true);
      selectProduct(p.id, params.get("color"));
    }
    renderUploads();
    renderNames();
    updateBottomBar();
    if (window.innerWidth > 900) openPanel("product");
    if (isEmb()) setTimeout(function () { maybeShowTips(); }, 400);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { Object.keys(canvases).forEach(function (k) { refreshFonts(canvases[k]); }); });
    window.BPStudio = {
      state: state, computePrice: computePrice, buildPackage: buildPackage, addText: addText, addArt: function (id) { addArt(CLIPART.filter(function (a) { return a.id === id; })[0]); },
      setView: setView, canvas: function (id) { return canvases[id || state.viewId]; }, applyPreset: function (i) { applyPreset(view().presets[i]); }
    };
  });
})();
