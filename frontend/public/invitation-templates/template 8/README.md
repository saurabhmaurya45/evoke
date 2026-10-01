# Royal Gate — Sikh Wedding (template 8)

Unbundled from a single-file React build (every module and asset inlined as base64):

- `js/` — the original ES modules, one file each (React, GSAP, Lenis + the page components), loaded natively.
- `static/` — every embedded asset extracted to a real file; Google Fonts self-hosted in `static/fonts/`.
- `js/content.js` — content store. Components read copy/media from `defaults.json` merged with editor data;
  `evoke-bridge.js` feeds it the `evoke:preview-update` message and components re-render.
- All content is sample data: the couple, family, phone numbers and addresses are fictional; event and story
  artwork is the illustrated sample set shared with template 4.
- RSVP opens WhatsApp with the guest's response when `rsvp.whatsapp` is set (the source form was a demo that
  sent nothing).
