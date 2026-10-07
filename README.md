# Business Printing 4 U — Website

Static HTML/CSS/JS build of the new Business Printing 4 U storefront: embroidered medical jackets, polos, hats, and printed t-shirts. The layout follows Custom Ink's homepage, with our own branding and a family-owned feel.

No build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Pages

| File | What it is |
|------|------------|
| `index.html` | Homepage: promo hero, trust icons, category tiles, medical-jacket banner, customer favorites, how it works, our story, reviews, FAQ, CTA |
| `products.html` | Catalog with category filters (`?cat=medical\|polos\|hats\|tees`) and search (`?q=`) |
| `design.html` | Design Studio: pick product, color, embroidery/print, placement; upload a logo, add text, drag to position, enter sizes, get a live price estimate |
| `contact.html` | Quote request form; picks up the saved design from the studio (`?from=design`) |

## Code layout

```
css/styles.css     all styles (design tokens at the top in :root)
js/catalog.js      products, colors, placements, pricing + recolorable garment SVGs
js/main.js         nav, search, product cards, reviews, forms, scroll reveals
js/design.js       Design Studio logic
assets/img/        logo (original, dark, light), favicon
```

## Placeholders to replace before launch

- **Phone / email / address / hours**: in the header and footer of every page (`(555) 123-4567`, `hello@businessprinting4u.com`, "Your City, ST")
- **Prices**: `PRODUCTS[].price` and `PRICING` in `js/catalog.js`, plus size upcharges in `js/design.js`
- **Reviews**: the homepage reviews are samples; swap in real customer reviews
- **Social links**: `href="#"` in the footer
- **Product photos**: garments are drawn as SVG so every color works without photography. To use a real photo, add `image: "assets/img/products/xyz.jpg"` to a product in `js/catalog.js`
- **Forms**: the quote and newsletter forms only show a success message for now (no backend yet)

## Next steps

- Hook the forms up to email (Formspree, or a WordPress form plugin)
- Convert to a WordPress theme: the shared header and footer map to `header.php` and `footer.php`, each page body to a template, and `catalog.js` data to WooCommerce products
- Real cart/checkout and saving designs server-side
