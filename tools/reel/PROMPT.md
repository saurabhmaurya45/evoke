# Prompt: make a reel film for one template

Copy everything below the line into Claude Code, replacing `<TEMPLATE_ID>` (a slug from
`frontend/public/invitation-templates/templates.index.json`, such as `tpl-royal-gate`).

---

Create the Instagram reel film for the invitation template `<TEMPLATE_ID>`, test it, and render a video.

Read `tools/reel/README.md`, then `tools/reel/templates/tpl-ayodhya-royal/film.html` with its `meta.json` and `checks.json`, which are the reference for quality and structure, and `tools/reel/lib/core.js`. Work only inside `tools/reel/templates/<TEMPLATE_ID>/`, plus `lib/` if a helper is truly general. Do not change the template itself. Do not commit or push unless I ask.

## What the film must be

A short motion-graphics film made from this template's own art, about 25 to 35 seconds with every section filled. It must feel designed for this template specifically. Do not reskin the Ayodhya film, and do not record or scroll the page: a page recording was rejected as far too simple.

- Every scene has real animation: parallax between layers, a moving camera, letter-by-letter text, particles suited to the theme.
- Every cut has a real transition, and they vary. Take them from the design itself: if the template opens through a gate, the film opens through that gate.
- Cuts land on the beat, and each section lasts a whole number of bars.
- End with the same closing as the other films: "Apni shaadi ka aisa invitation banaiye" and a theinvitely.in logo reveal.

## Steps

1. **Study the template.** Read its `schema.json`, `defaults.json`, `index.html` and JS. Open it at phone size and capture screenshots of the whole page, so you see the design as a guest does. Media is not in the repo: its URLs in the template's files point to the public bucket. Download the images to your scratch folder and view a labelled contact sheet of them, noting which have transparency and can be used as layers. If a template has no `schema.json` (template 1), work out its data from its code and tell me what you found.
2. **Find the music.** Use the template's default track. Run `findBeat` from `lib/song.mjs` and inspect the result: find where the song gets strong and measure the beat grid from its onsets, because the detector can be about 1% off on real music. Put the measured values in `meta.json` as `song.bpm` and `song.firstBeat`. If the template has no music, stop and ask me which song to use.
3. **Write the storyboard** as a table of time, scene, schema fields used, animation and transition. Show it to me in one message, then continue without waiting.
4. **Write `film.html` and `meta.json`.** Set `required` to the fields without which there is no film (normally the two names).
5. **Write `checks.json`** covering the cases listed under Testing.
6. **Test, fix and render** as described under Testing.

## Rules from the first film

Data:

- Use the data exactly as saved, with no merging over defaults. Sample text the user saved is shown like any other text.
- **A section with no data does not appear in the video at all**, and the film gets shorter. Treat strings of only spaces as empty. A list shows only items that have their main field filled.
- Build the timeline so any optional section can be skipped: sections are whole bars on a fixed main timeline, each with a flash or similar on its first beat, so any can follow any. If the opening can be skipped, set `window.__firstBar`, and make sure the video's first frame is the scene and not a flash, since it may become the thumbnail.
- A countdown with a missing, invalid or past date is left out. Accept both `YYYY-MM-DD` and a full date-time.
- Schemas differ, so use this template's real field paths. Use every field that adds to the story, and tell me which you left out.

Safety:

- Put user text on screen only through `text()` or `textContent`, never `innerHTML`. Pass user image URLs through `safeImage()`, with the template's own art as the fallback.
- Read user values through `str()`, so a wrong type shows nothing instead of `[object Object]`.

Layout:

- The stage is 1080x1920. Keep important content between y=250 and y=1500 and away from the right edge, where Instagram puts its buttons.
- Give every piece of user text a `maxW`. Names can be very long or in Hindi: add a Devanagari font to the stack, and use `graphemes()` whenever you split or space out letters.
- Backgrounds must cover the whole stage at every moment of their movement. Compute the sizes, and check the frame edges.
- To fit a photo into a shaped hole, measure the hole from the image's alpha channel rather than by eye. Use `object-fit: cover`, because users upload any shape of photo.
- Do not use `z-index` inside a scene: scenes have no stacking context, so it escapes and covers later scenes. Use DOM order.

Animation:

- The film is a pure function of time: `render(t)` sets everything for that moment. No CSS animations, timers or `Date.now()`; use `window.__NOW` for a countdown. Random values must come from the seeded `rng()`.
- Animate on the time grid set by `meta.bpm`, and test that the film holds together when played faster or slower.

## Testing

Do all of this before telling me it is finished, and fix what you find.

1. **Data cases** in `checks.json`, run with `node check-film.mjs <TEMPLATE_ID>`. At minimum: saved with all the sample text (`"$sample"`); every section filled with new realistic data, rejecting sample text; only the required fields; each optional section removed on its own; blank strings; Hindi text and very long names; wrong data types and HTML in text; lists with one item and with more items than the sample. Add a past date if the template has a countdown.
2. **Stills.** Use `make-reel.mjs --stills` and actually look at the images: each scene, each transition midway, and every cut where a section is skipped. Look for black or blank frames, leftovers from the previous scene, text overlapping art, and edges not covered.
3. **Failures.** Confirm that empty required fields give a clear error, with `--data` pointing at such a file.
4. **Full render** with new realistic mock data: names, dates and a mix of photos. Save the mock data as `tools/reel/out/<TEMPLATE_ID>-mock.json`, then run:
   `node make-reel.mjs <TEMPLATE_ID> --data out/<TEMPLATE_ID>-mock.json`
5. **Video check.** Run `node check-film.mjs --video <file>`. There must be no stalls, apart from a deliberately still end card. View a contact sheet of the finished video.
6. **Short render.** Also render a video with only the required fields.

## What to tell me at the end

- The paths of both videos.
- The storyboard as built, and the transitions used.
- Which fields appear in the video and which do not.
- The bugs you found and fixed, and the test results as actual numbers.
- What you could not check. You cannot hear audio or watch motion, so say plainly that I need to confirm the beat sync and the feel, and never claim otherwise.
