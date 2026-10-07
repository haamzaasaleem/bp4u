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
| `design.html` | Design Studio: pick product, color, embroidery/print, placement; upload a logo, add text, drag to position, enter sizes, get a live price estimate |
| `contact.html` | Quote request form; picks up the saved design from the studio (`?from=design`) |

## Code layout

```
css/styles.css     all styles (design tokens at the top in :root)
js/catalog.js      products, colors, placements, pricing + recolorable garment SVGs
js/main.js         nav, search, product cards, reviews, forms, scroll reveals
js/design.js       Design Studio logic
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
