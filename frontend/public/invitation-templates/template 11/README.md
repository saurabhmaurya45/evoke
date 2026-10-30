# Template 11 — Ayodhya — Royal Wedding (`tpl-ayodhya-royal`)

A Ram Mandir-inspired wedding invitation, imported from a Framer export (`Ayodhya-Wedding-Invitation.html`).

## How it was imported

- The export was a single 50 MB HTML file with every asset embedded as base64. The assets were
  extracted into `static/fonts` (woff2), `static/images` (png/jpg) and `static/media` (mp3), and the
  page now references them as files. The loader script that injected them at runtime was removed.
- A `<meta charset="utf-8">` was added (the export had none, so Devanagari rendered as mojibake).
- Every editable node now carries a `data-ev*` attribute naming the `TemplateData` path it shows
  (see the header of `evoke-bridge.js`). Framer renders each text three times — desktop, tablet and
  mobile variants — so one path usually matches three nodes.
- `defaults.json` is generated from the page's own text (event dates/venue were made realistic);
  `schema.json` lists exactly the same keys. The editor validates this at load time.

## Editing model

`evoke-bridge.js` merges `defaults.json` with the live `TemplateData` the editor posts
(`evoke:preview-update`) and writes it into the `data-ev*` nodes with `textContent` only. Every URL
is checked (`http(s)`, or `data:image|audio` for uploads) before it is applied. The countdown is a
live `DD:HH:MM:SS` clock driven by `countdown.date`; the RSVP pop-up gets a WhatsApp button when
`rsvp.whatsapp` is set.

## Media

Images, the two card videos, posters and the music track are served from the public media bucket
like every other template (`asset/invitation-templates/template 11/…`); they are not kept in the repo.
Fonts stay on the site.

## Watermark removal

The export carried the original author's branding. It was removed: the 9 "Watermark" overlay layers, the vendor comments/meta description, and the logo / "Get your wedding invite" caption that were baked into 8 illustrations (cleaned by inpainting, so a faint smudge can remain where a mark sat on busy art). Unused fonts were also dropped (8 files kept). Re-clean the images, rather than the page, if a mark shows up again.
