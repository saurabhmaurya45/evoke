/**
 * Brand assets — change tokens/URLs here only.
 * Favicon and other shared brand media are applied site-wide from this file.
 */
(function () {
  'use strict';

  var STORAGE_BASE =
    'https://firebasestorage.googleapis.com/v0/b/my-bel0ved.firebasestorage.app/o/';

  /** Favicon / tab icon (templates/shared/images/my_beloved_icon.png) */
  var ICON_PATH = 'templates%2Fshared%2Fimages%2Fmy_beloved_icon.png';
  var ICON_TOKEN = '0ce8a84b-4fce-44c5-a0a1-80841b152870';

  window.BrandAssets = {
    storageBaseUrl: STORAGE_BASE,
    iconPath: '/' + ICON_PATH,
    iconToken: ICON_TOKEN,
    iconUrl: STORAGE_BASE + ICON_PATH + '?alt=media&token=' + ICON_TOKEN
  };

  function isBrandIconLink(link) {
    if (!link) return false;
    if (link.hasAttribute('data-brand-icon')) return true;
    var href = link.getAttribute('href') || '';
    var path = link.getAttribute('data-storage-path') || '';
    if (href.indexOf('my_beloved_icon.png') !== -1) return true;
    if (path.indexOf('my_beloved_icon.png') !== -1) return true;
    return false;
  }

  function applyBrandFavicon() {
    var url = window.BrandAssets.iconUrl;
    if (!url) return;

    var links = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
    if (!links.length) {
      var created = document.createElement('link');
      created.rel = 'icon';
      created.type = 'image/png';
      created.setAttribute('data-brand-icon', 'true');
      created.href = url;
      (document.head || document.documentElement).appendChild(created);
      return;
    }

    var brandLinks = [];
    Array.prototype.forEach.call(links, function (link) {
      if (isBrandIconLink(link)) brandLinks.push(link);
    });

    /* Most pages have a single favicon — treat it as the brand icon. */
    if (!brandLinks.length && links.length === 1) {
      brandLinks.push(links[0]);
    }

    brandLinks.forEach(function (link) {
      link.type = 'image/png';
      link.href = url;
      link.setAttribute('data-brand-icon', 'true');
      link.setAttribute('data-storage-path', window.BrandAssets.iconPath);
      link.setAttribute('data-token', window.BrandAssets.iconToken);
    });
  }

  window.applyBrandFavicon = applyBrandFavicon;
  applyBrandFavicon();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBrandFavicon);
  }
})();
