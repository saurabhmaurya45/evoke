# Wedding Template T2 — fixed static package

- `index.html` is the wedding template entry point.
- CSS and JavaScript are flattened into `css/` and `js/`.
- All media is now bundled locally and served from `assets/`:
  - `assets/images/` — hero, floral, ring, bismillah, favicon, and the four
    countdown polaroid images.
  - `assets/audio/` — background music (`eid_song.mp3` for the Muslim style,
    `wedding-t1-song.mp3` for the General style).
- The template is fully self-contained and works offline. The Firebase SDK and
  all Firebase Storage lookups have been removed, since every asset is local.
