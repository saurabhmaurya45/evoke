/**
 * Brand assets — change the favicon path here only.
 * Applied site-wide from this file.
 */
(function () {
  'use strict';

  var ICON_URL = 'assets/images/my_beloved_icon.png';

  window.BrandAssets = { iconUrl: ICON_URL };

  function applyBrandFavicon() {
    var links = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
    if (!links.length) {
      var created = document.createElement('link');
      created.rel = 'icon';
      created.type = 'image/png';
      created.href = ICON_URL;
      (document.head || document.documentElement).appendChild(created);
      return;
    }
    Array.prototype.forEach.call(links, function (link) {
      link.type = 'image/png';
      link.href = ICON_URL;
    });
  }

  window.applyBrandFavicon = applyBrandFavicon;
  applyBrandFavicon();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBrandFavicon);
  }
})();
