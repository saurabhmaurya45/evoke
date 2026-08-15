# Wedding 10 — optimized package

This package keeps the actual wedding page behavior unchanged.

Changes:
- Removed the HTTrack-generated `index.html` wrapper.
- Removed the unused `backblue.gif` and `fade.gif` assets that belonged only to the HTTrack wrapper.
- There were no local JavaScript files in the supplied ZIP to remove.
- The wedding page's inline JavaScript was kept intact.
- The external `canvas-confetti` library was kept because the page actively uses it.
- External fonts, video, audio, images, RSVP API, and Google Maps references were kept unchanged.
