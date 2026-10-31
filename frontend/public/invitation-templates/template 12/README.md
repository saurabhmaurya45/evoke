# Template 12 — Lace — Classic Wedding (`tpl-lace-classic`)

An ivory and burgundy lace wedding invitation. Used with permission from its original author, as reported by the site owner, who holds that permission.

## How it was imported

The source was a single-file build of a compiled React app, with its assets embedded as base64. It was split into `js/app.js`, `css/app.css` and media files, then patched:

- Every piece of invitation text and every link now reads from `TemplateData` through `__t()` and `__url()`, provided by `evoke-bridge.js`. React escapes what it renders, and links are checked first.
- The event icons were chosen by comparing the event's label, so they are now chosen by position, and renaming an event keeps its art.
- The original author's credit, the embed lock, the admin pages and the backend connection were removed.
- The demo couple's monogram was removed from the wax seal, in both the opening video and its poster, by tracking the seal through each frame. The seal is now blank for every couple.

## Editing model

The editor posts `evoke:preview-update`, and the bridge re-renders the app in place, so the page keeps its scroll position. All default content lives in `defaults.json`.

The original RSVP section was replaced by a photo gallery. The sample gallery uses the template's own illustrations, and a gallery with no photos is left out. The rest of the art and the videos are fixed.

## Media

Images and videos are served from the public media bucket (`asset/invitation-templates/template 12/…`) and are not kept in the repo. Fonts and the venue SVG stay on the site.
