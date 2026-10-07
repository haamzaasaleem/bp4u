/* ==========================================================================
   Real product photos for the Design Studio and product cards.
   --------------------------------------------------------------------------
   1. Open photo-setup.html, load a supplier photo, mark the print area.
   2. Save the downloaded image as  assets/products/<productId>/<color>-<side>.jpg
      e.g. assets/products/warmup-jacket/navy-front.jpg
   3. Paste the settings it gives you into BP_PHOTOS below.

   colors: color keys (from js/catalog.js) that have photos. When a product
           has photos, only these colors are offered.
   views:  for each side (front, back, lsleeve, rsleeve):
           area = print/stitch zone on the square photo, in 0–300 units [x, y, w, h]
           inW  = real width of that zone in inches
   Sides without an entry are hidden for that product.
   ========================================================================== */
window.BP_PHOTOS = {
  // "warmup-jacket": {
  //   colors: ["navy", "black"],
  //   views: {
  //     front: { area: [84, 60, 132, 176], inW: 14 },
  //     back:  { area: [86, 56, 128, 150], inW: 12 }
  //   }
  // }
};
