/* ==========================================================================
   Catalog + garment illustrations
   --------------------------------------------------------------------------
   Garments are drawn as recolorable inline SVG so we can show every product
   in every color without product photography. When real photos are ready,
   add an `image` field to a product and the cards can switch to <img>.
   Prices are PLACEHOLDERS — update before launch.
   ========================================================================== */

(function (global) {
  "use strict";

  /* ---------- color helpers ---------- */
  function hexToRgb(hex) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(rgb) {
    return "#" + rgb.map(function (v) {
      v = Math.max(0, Math.min(255, Math.round(v)));
      return (v < 16 ? "0" : "") + v.toString(16);
    }).join("");
  }
  /* amt < 0 darkens, amt > 0 lightens (range -1..1) */
  function shade(hex, amt) {
    var rgb = hexToRgb(hex);
    return rgbToHex(rgb.map(function (v) {
      return amt < 0 ? v * (1 + amt) : v + (255 - v) * amt;
    }));
  }
  function isLight(hex) {
    var rgb = hexToRgb(hex);
    return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 > 150;
  }

  /* ---------- garment drawings (viewBox 0 0 300 300) ---------- */
  function palette(color) {
    var light = isLight(color);
    return {
      fill: color,
      line: light ? shade(color, -0.22) : shade(color, -0.45),
      detail: light ? shade(color, -0.08) : shade(color, 0.1),
      deep: shade(color, light ? -0.14 : -0.25),
      stitch: light ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.22)"
    };
  }

  var drawings = {
    tee: function (p, view) {
      var collar = view === "back"
        ? '<path d="M108 34 C122 42 178 42 192 34 L196 37 C182 48 118 48 104 37 Z" fill="' + p.deep + '"/>'
        : '<path d="M108 34 C122 46 178 46 192 34 L198 37 C184 66 116 66 102 37 Z" fill="' + p.deep + '"/>';
      return '' +
        '<path d="M108 34 C122 46 178 46 192 34 L248 58 C256 62 262 70 266 80 L276 112 L236 128 L224 104 L224 270 C190 276 110 276 76 270 L76 104 L64 128 L24 112 L34 80 C38 70 44 62 52 58 Z" fill="' + p.fill + '" stroke="' + p.line + '" stroke-width="2" stroke-linejoin="round"/>' +
        collar +
        '<path d="M76 104 C74 88 70 72 60 60 M224 104 C226 88 230 72 240 60" fill="none" stroke="' + p.line + '" stroke-width="1.5" opacity=".6"/>' +
        '<path d="M30 102 L70 118 M270 102 L230 118 M78 262 C110 268 190 268 222 262" fill="none" stroke="' + p.stitch + '" stroke-width="1.5" stroke-dasharray="3 3"/>';
    },

    polo: function (p, view) {
      var front = view === "back" ? '' :
        '<rect x="143" y="44" width="14" height="60" rx="2" fill="' + p.detail + '" stroke="' + p.line + '" stroke-width="1.5"/>' +
        '<circle cx="150" cy="62" r="2.8" fill="' + p.line + '"/><circle cx="150" cy="78" r="2.8" fill="' + p.line + '"/><circle cx="150" cy="94" r="2.8" fill="' + p.line + '"/>';
      var collar = view === "back"
        ? '<path d="M110 34 C124 24 176 24 190 34 L192 46 C176 40 124 40 108 46 Z" fill="' + p.detail + '" stroke="' + p.line + '" stroke-width="1.5" stroke-linejoin="round"/>'
        : '<path d="M110 34 C124 26 176 26 190 34 L150 46 Z" fill="' + p.deep + '"/>' +
          '<path d="M110 34 L150 46 L140 80 L102 56 Z" fill="' + p.detail + '" stroke="' + p.line + '" stroke-width="1.5" stroke-linejoin="round"/>' +
          '<path d="M190 34 L150 46 L160 80 L198 56 Z" fill="' + p.detail + '" stroke="' + p.line + '" stroke-width="1.5" stroke-linejoin="round"/>';
      return '' +
        '<path d="M110 34 C124 42 176 42 190 34 L244 56 C252 60 258 68 261 78 L270 108 L232 122 L222 102 L222 270 C190 276 110 276 78 270 L78 102 L68 122 L30 108 L39 78 C42 68 48 60 56 56 Z" fill="' + p.fill + '" stroke="' + p.line + '" stroke-width="2" stroke-linejoin="round"/>' +
        front + collar +
        '<path d="M78 102 C76 86 72 72 62 60 M222 102 C224 86 228 72 238 60" fill="none" stroke="' + p.line + '" stroke-width="1.5" opacity=".6"/>' +
        '<path d="M33 98 L71 112 M267 98 L229 112" fill="none" stroke="' + p.line + '" stroke-width="5" opacity=".25"/>' +
        '<path d="M80 262 C110 268 190 268 220 262" fill="none" stroke="' + p.stitch + '" stroke-width="1.5" stroke-dasharray="3 3"/>';
    },

    hat: function (p) {
      return '' +
        '<path d="M58 178 C56 128 96 92 150 90 C204 92 244 128 242 178 Z" fill="' + p.fill + '" stroke="' + p.line + '" stroke-width="2" stroke-linejoin="round"/>' +
        '<path d="M150 92 C130 116 124 150 126 176 M150 92 C170 116 176 150 174 176" fill="none" stroke="' + p.line + '" stroke-width="1.5" opacity=".55"/>' +
        '<path d="M150 92 C110 108 90 140 84 176 M150 92 C190 108 210 140 216 176" fill="none" stroke="' + p.stitch + '" stroke-width="1.2" stroke-dasharray="3 3"/>' +
        '<circle cx="98" cy="128" r="3" fill="' + p.line + '" opacity=".6"/><circle cx="202" cy="128" r="3" fill="' + p.line + '" opacity=".6"/>' +
        '<ellipse cx="150" cy="92" rx="8" ry="4" fill="' + p.detail + '" stroke="' + p.line + '" stroke-width="1.5"/>' +
        '<path d="M58 176 C100 168 200 168 242 176" fill="none" stroke="' + p.line + '" stroke-width="3" opacity=".5"/>' +
        '<path d="M60 178 C104 172 196 172 240 178 C258 186 268 200 262 214 C250 232 206 244 150 244 C94 244 50 232 38 214 C32 200 42 186 60 178 Z" fill="' + p.deep + '" stroke="' + p.line + '" stroke-width="2" stroke-linejoin="round"/>' +
        '<path d="M62 186 C104 180 196 180 238 186 C252 192 258 202 254 212 C242 226 204 236 150 236 C96 236 58 226 46 212 C42 202 48 192 62 186 Z" fill="none" stroke="' + p.stitch + '" stroke-width="1.2" stroke-dasharray="3 3"/>' +
        '<path d="M70 184 C110 178 190 178 230 184" fill="none" stroke="#fff" stroke-width="3" opacity=".12"/>';
    },

    jacket: function (p, view) {
      var front = view === "back"
        ? '<path d="M112 30 L188 30 L190 44 C170 50 130 50 110 44 Z" fill="' + p.deep + '" stroke="' + p.line + '" stroke-width="1.5" stroke-linejoin="round"/>'
        : '<path d="M112 30 L188 30 L190 44 C178 48 166 50 160 50 L150 62 L140 50 C134 50 122 48 110 44 Z" fill="' + p.deep + '" stroke="' + p.line + '" stroke-width="1.5" stroke-linejoin="round"/>' +
          '<path d="M150 62 L150 258" stroke="' + p.line + '" stroke-width="3"/>' +
          '<path d="M150 62 L150 258" stroke="' + p.stitch + '" stroke-width="7" stroke-dasharray="1.5 2" opacity=".8"/>' +
          '<rect x="146" y="64" width="8" height="16" rx="2" fill="#c8c8c8" stroke="#8a8a8a"/>' +
          '<path d="M86 204 L118 194 M214 204 L182 194" stroke="' + p.line + '" stroke-width="3" stroke-linecap="round" opacity=".7"/>';
      return '' +
        '<path d="M112 30 L188 30 L240 52 C252 58 258 68 260 80 L280 236 L246 244 L226 128 L226 272 L74 272 L74 128 L54 244 L20 236 L40 80 C42 68 48 58 60 52 Z" fill="' + p.fill + '" stroke="' + p.line + '" stroke-width="2" stroke-linejoin="round"/>' +
        '<path d="M66 50 C80 80 80 104 74 128 M234 50 C220 80 220 104 226 128" fill="none" stroke="' + p.line + '" stroke-width="1.5" opacity=".6"/>' +
        '<path d="M20 236 L54 244 L52 258 L18 250 Z M280 236 L246 244 L248 258 L282 250 Z" fill="' + p.deep + '" stroke="' + p.line + '" stroke-width="1.5" stroke-linejoin="round"/>' +
        '<rect x="74" y="256" width="152" height="16" fill="' + p.deep + '" stroke="' + p.line + '" stroke-width="1.5"/>' +
        front;
    }
  };

  function garmentSVG(type, color, opts) {
    opts = opts || {};
    var p = palette(color);
    var label = opts.label ? ' role="img" aria-label="' + opts.label + '"' : ' aria-hidden="true"';
    var cls = opts.className ? ' class="' + opts.className + '"' : '';
    return '<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg"' + cls + label + '>' +
      drawings[type](p, opts.view || "front") + '</svg>';
  }

  /* ---------- color library ---------- */
  var COLORS = {
    white: { name: "White", hex: "#fbfbf9" },
    black: { name: "Black", hex: "#1d1d1f" },
    navy: { name: "Navy", hex: "#1f2a44" },
    royal: { name: "Royal Blue", hex: "#2d5bb7" },
    ceil: { name: "Ceil Blue", hex: "#8fb2d6" },
    teal: { name: "Teal", hex: "#1f7a7a" },
    wine: { name: "Wine", hex: "#6d1f2f" },
    red: { name: "Red", hex: "#c0282d" },
    gray: { name: "Heather Gray", hex: "#a9abad" },
    charcoal: { name: "Charcoal", hex: "#3b3d40" },
    forest: { name: "Forest", hex: "#24533b" },
    khaki: { name: "Khaki", hex: "#c7b48b" },
    gold: { name: "Gold", hex: "#e3b23c" },
    pink: { name: "Pink", hex: "#e9a3b8" },
    orange: { name: "Orange", hex: "#e36c2c" }
  };

  /* ---------- category info ---------- */
  var CATEGORIES = {
    medical: { name: "Medical Jackets", short: "Medical", garment: "jacket" },
    polos: { name: "Polos", short: "Polos", garment: "polo" },
    hats: { name: "Hats", short: "Hats", garment: "hat" },
    tees: { name: "T-Shirts", short: "T-Shirts", garment: "tee" }
  };

  /* ---------- products (placeholder prices) ---------- */
  var PRODUCTS = [
    { id: "warmup-jacket", cat: "medical", garment: "jacket", name: "Medical Warm-Up Jacket", desc: "Snap-front scrub jacket with embroidered name & credentials.", price: 34, colors: ["navy", "ceil", "black", "wine", "royal", "teal", "charcoal"], methods: ["embroidery"], badge: "Best Seller" },
    { id: "softshell-jacket", cat: "medical", garment: "jacket", name: "Soft Shell Clinic Jacket", desc: "Water-resistant, lightweight — great for front desk teams.", price: 42, colors: ["black", "navy", "charcoal", "gray"], methods: ["embroidery"] },
    { id: "fleece-jacket", cat: "medical", garment: "jacket", name: "Full-Zip Fleece Jacket", desc: "Cozy microfleece that holds detailed embroidery.", price: 38, colors: ["navy", "black", "charcoal", "forest", "wine"], methods: ["embroidery"] },
    { id: "performance-polo", cat: "polos", garment: "polo", name: "Performance Polo", desc: "Moisture-wicking, snag-resistant. Our most popular uniform polo.", price: 24, colors: ["navy", "black", "white", "royal", "red", "gray", "forest"], methods: ["embroidery", "print"], badge: "Popular" },
    { id: "pique-polo", cat: "polos", garment: "polo", name: "Classic Piqué Polo", desc: "Breathable cotton blend with a timeless look.", price: 22, colors: ["white", "navy", "black", "khaki", "wine", "teal"], methods: ["embroidery"] },
    { id: "ladies-polo", cat: "polos", garment: "polo", name: "Ladies' Performance Polo", desc: "Tailored fit with the same easy-care fabric.", price: 24, colors: ["navy", "black", "white", "pink", "ceil", "royal"], methods: ["embroidery", "print"] },
    { id: "structured-cap", cat: "hats", garment: "hat", name: "Structured Baseball Cap", desc: "Six-panel cap with a crisp front for 3D or flat embroidery.", price: 16, colors: ["black", "navy", "charcoal", "khaki", "red", "white"], methods: ["embroidery"], badge: "Best Seller" },
    { id: "trucker-cap", cat: "hats", garment: "hat", name: "Trucker Cap", desc: "Classic mesh-back trucker — a favorite for teams & events.", price: 15, colors: ["charcoal", "black", "navy", "forest", "orange"], methods: ["embroidery"] },
    { id: "dad-hat", cat: "hats", garment: "hat", name: "Unstructured Dad Hat", desc: "Relaxed fit, washed cotton, adjustable strap.", price: 14, colors: ["khaki", "navy", "black", "pink", "gray", "white"], methods: ["embroidery"] },
    { id: "cotton-tee", cat: "tees", garment: "tee", name: "Everyday Cotton Tee", desc: "Heavyweight 100% cotton. Prints bright, washes great.", price: 9, colors: ["white", "black", "gray", "navy", "red", "royal", "gold", "forest", "orange"], methods: ["print", "embroidery"], badge: "Low Minimums" },
    { id: "soft-tee", cat: "tees", garment: "tee", name: "Premium Soft Tee", desc: "Ring-spun, retail-fit tee your team will actually wear.", price: 13, colors: ["charcoal", "white", "black", "navy", "teal", "pink", "gray"], methods: ["print", "embroidery"] },
    { id: "performance-tee", cat: "tees", garment: "tee", name: "Performance Tee", desc: "Lightweight, quick-dry — built for teams and 5Ks.", price: 12, colors: ["royal", "black", "red", "gray", "orange", "forest", "white"], methods: ["print"] }
  ];

  /* Print / embroidery placements per garment, in viewBox units [x, y, w, h] */
  var PLACEMENTS = {
    tee: [
      { id: "front", view: "front", label: "Full Front", box: [104, 82, 92, 120] },
      { id: "chest", view: "front", label: "Left Chest", box: [166, 74, 40, 36] },
      { id: "back", view: "back", label: "Full Back", box: [100, 62, 100, 140] }
    ],
    polo: [
      { id: "chest", view: "front", label: "Left Chest", box: [164, 82, 40, 36] },
      { id: "front", view: "front", label: "Center Front", box: [104, 118, 92, 90] },
      { id: "back", view: "back", label: "Upper Back", box: [100, 60, 100, 70] }
    ],
    jacket: [
      { id: "chest", view: "front", label: "Left Chest", box: [162, 78, 46, 40] },
      { id: "rchest", view: "front", label: "Right Chest", box: [92, 78, 46, 40] },
      { id: "back", view: "back", label: "Upper Back", box: [94, 64, 112, 80] }
    ],
    hat: [
      { id: "front", view: "front", label: "Front Panel", box: [108, 108, 84, 56] }
    ]
  };

  /* Placeholder decoration pricing + volume tiers */
  var PRICING = {
    decoration: { embroidery: 8, print: 5 },
    tiers: [
      { min: 96, off: 0.25 },
      { min: 48, off: 0.2 },
      { min: 24, off: 0.15 },
      { min: 12, off: 0.1 },
      { min: 1, off: 0 }
    ]
  };

  function getProduct(id) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i];
    return null;
  }

  global.BP = {
    shade: shade,
    isLight: isLight,
    garmentSVG: garmentSVG,
    COLORS: COLORS,
    CATEGORIES: CATEGORIES,
    PRODUCTS: PRODUCTS,
    PLACEMENTS: PLACEMENTS,
    PRICING: PRICING,
    getProduct: getProduct
  };
})(window);
