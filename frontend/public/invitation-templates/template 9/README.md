# Château — Classic Wedding (template 9)

- `js/app.js` — React + framer-motion invitation bundle (Turbopack runtime), loaded as a classic script.
- `css/app.css` — compiled Tailwind CSS for the page; fonts live in `static/fonts/fonts.css`
  (self-hosted Google Fonts, one file per family — Cormorant Garamond and Inter are variable fonts).
- `static/` — images, background music and paper textures; everything is served locally.
- `evoke-bridge.js` — maps section-keyed editor data (merged over `defaults.json`) onto the invite's
  `customData` object and re-renders the root on every `evoke:preview-update`.
