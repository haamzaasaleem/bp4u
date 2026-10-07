# Business Printing 4 U — Website

Static HTML/CSS/JS build of the new Business Printing 4 U storefront, a family-owned custom printing and embroidery shop run by Shawn & Kimberly in Madera, CA (serving Madera, Clovis, Fresno, and Central California). The look uses BP4U's own navy & green brand colors and puts the family front and center.

Contact: (559) 474-2808 · scrabb@crabbdigitalmedia.com · 2818 Apple Tree Ct., Madera, CA 93637

No build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Pages

| File | What it is |
|------|------------|
| `index.html` | Homepage: family hero with Shawn & Kimberly, "What we make" grid, banner slider, The Embroiderology Dept. (medical), favorites, business printing, more services (websites, SEO, marketing), how it works, our story, FAQ, CTA |
| `products.html` | Catalog with category filters (`?cat=medical\|polos\|hats\|tees`) and live search |
| `design.html` | Design Studio (full-screen app, see below) |
| `contact.html` | Quote request form; picks up the saved design from the studio (`?from=design`) |

## Design Studio

`design.html` is our own Custom Ink–style designer, built on [Fabric.js](http://fabricjs.com/).

- **Tools:** Product (style, color, embroidery or print), Upload (PNG/JPG/SVG placed on the design; PDF/AI/EPS/DST/PES attached for the artists), Add Text (12 fonts, thread/ink colors, outline, spacing), Add Art (clip art), Names (personalize each piece with name, title, and size; paste from a spreadsheet)
- **Sides:** Front, Back, Left Sleeve, Right Sleeve (hats: Front), each with a real-inch print/stitch area and quick-place presets (left chest, full back…)
- **Live checks:** size readout in inches, text-too-small for embroidery, low-resolution images, art outside the area
- **Undo/redo, keyboard shortcuts, autosave** (browser storage), zoom
- **Get Price → order:** quantities by size (or from the names list), estimate with bulk tiers, then contact details

### What the shop receives

Every order produces a zip production package:

```
work-order.html            printable work order: proof images, sizes, placements in inches, fonts, thread colors
order.json                 the same, machine-readable
print-files/<side>-print-300dpi.png   transparent art at 300 DPI, real size of the area
print-files/<side>.svg                vector version
print-files/names/                    one print file per person (personalized orders)
mockups/<side>.png                    garment previews
originals/                            the customer's uploaded files, untouched
names.csv
```

### Sending orders to the shop

- **GitHub Pages (now):** no server, so the customer downloads the zip and gets a one-click "Email my order file" button.
- **Hostinger / any PHP host:** upload the site, then set `orderEndpoint: "api/order.php"` in `js/config.js`. `api/order.php` saves each zip to `orders-private/` and emails it to the shop (and a confirmation to the customer). Set `FROM_EMAIL` in that file to an address on your domain.

## Code layout

```
css/styles.css     all styles (design tokens at the top in :root)
js/catalog.js      products, colors, studio views/print areas, threads, pricing + garment SVGs
js/main.js         nav, product cards, forms, slider, scroll reveals
js/studio.js       Design Studio
js/config.js       order endpoint + shop contact for the studio
js/vendor/         Fabric.js 5.3.0 and JSZip 3.10.1 (MIT)
css/studio.css     Design Studio layout
api/order.php      order receiver for PHP hosting
assets/img/        logos, favicon, owners photo, Embroiderology logo, banners/
```

## Placeholders to replace before launch

- **Shop hours**: in the footer (currently sample hours)
- **Prices**: `PRODUCTS[].price` and `PRICING` in `js/catalog.js`, plus size upcharges in `js/design.js`
- **Reviews**: no reviews section yet; add one once you have real Google/Facebook reviews
- **More social links**: only Facebook is linked right now
- **Embroiderology wide banner**: save it as `assets/img/banners/embroiderology.jpg` and it appears above the medical section automatically
- **Product photos**: garments are drawn as SVG so every color works without photography. To use a real photo, add `image: "assets/img/products/xyz.jpg"` to a product in `js/catalog.js`
- **Forms**: the quote and newsletter forms only show a success message for now (no backend yet)

## Next steps

- Hook the forms up to email (Formspree, or a WordPress form plugin)
- Convert to a WordPress theme: the shared header and footer map to `header.php` and `footer.php`, each page body to a template, and `catalog.js` data to WooCommerce products
- Real cart/checkout and saving designs server-side
