# Temple Bells — Traditional Wedding (template 10)

- `js/app.js` — React + framer-motion invitation bundle (Turbopack runtime), loaded as a classic script.
- `css/app.css` — compiled Tailwind CSS for the page; fonts live in `static/fonts/fonts.css`
  (self-hosted Google Fonts, one file per family/style — variable fonts where available).
- `static/` — videos, illustrations and decorative artwork; everything is served locally.
- `evoke-bridge.js` — fills the invite's shared content object (`globalThis.__evInvitation`) from
  `defaults.json` merged with editor data, then re-renders on every `evoke:preview-update`.
