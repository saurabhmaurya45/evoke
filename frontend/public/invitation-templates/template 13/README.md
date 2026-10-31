# Template 13 — Embroidered Garden (`tpl-embroidered-garden`)

A floral, embroidered wedding invitation. Used with permission from its original author, as reported by the site owner, who holds that permission.

## How it was imported

The source was a single-file build of a compiled React app, with its assets embedded as base64. It was split into `js/app.js`, `css/app.css` and media files, then patched:

- Every piece of invitation text now reads from `TemplateData` through `__t()`, provided by `evoke-bridge.js`. React escapes what it renders.
- The hidden RSVP code, the backend settings and the builder's leftover code were removed.
- The source used Adobe Fonts, which may not be self-hosted. They were replaced with Libre Caslon Text and Playfair Display (Google Fonts, SIL Open Font License), kept in `static/fonts`.
- The demo couple's monogram was removed from the door plaque, in both the opening video and its poster, by tracking the plaque through each frame. The plaque is now blank for every couple. The video's unused audio was dropped.
- A photo gallery was added before the footer. Its sample photos are shared with template 10, and a gallery with no photos is left out.

## Editing model

The editor posts `evoke:preview-update`, and the bridge re-renders the app in place, so the page keeps its scroll position. All default content lives in `defaults.json`. Dates in the running text are plain fields, while the countdown, footer and calendar links follow `countdown.date`.

The illustrations are fixed art. This template has no background music.

## Media

Images and video are served from the public media bucket (`asset/invitation-templates/template 13/…`) and are not kept in the repo. Fonts stay on the site.
