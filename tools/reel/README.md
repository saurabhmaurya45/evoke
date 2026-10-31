# Reel maker

Turns a filled-in invitation into an Instagram reel (1080x1920, 30fps, MP4). Every template has its own
film, because every design animates differently.

## Setup

```
cd tools/reel
npm install
npx playwright install chromium
```

## Usage

```
# the template's sample content
node make-reel.mjs tpl-ayodhya-royal

# a user's details from a JSON file (same shape the editor saves)
node make-reel.mjs tpl-ayodhya-royal --data my-wedding.json

# a published invitation, by its slug
node make-reel.mjs tpl-ayodhya-royal --slug priya-weds-rahul

# your own song (tempo and starting point are detected; override with --bpm / --song-start)
node make-reel.mjs tpl-ayodhya-royal --data my-wedding.json --song song.mp3 --bpm 96 --song-start 45.2
```

The data is used exactly as saved. A section with nothing in it is left out of the video, and sample text
the user saved is shown like any other text. Only with neither `--data` nor `--slug` does it use the
template's sample content.

Videos go to `out/` unless `--out` says otherwise. `--stills 3,8.5,12` writes JPEGs at those film times
instead of a video, for checking a change quickly. A full render takes a few minutes.

## How it works

`make-reel.mjs` opens the film in a headless
browser, captures it one frame at a time and pipes the frames into ffmpeg with the song. Because each frame
is captured on its own, a slow machine makes rendering slower but never drops frames.

The film is choreographed at `meta.bpm`. A song at another tempo plays the film proportionally faster or
slower (at most 25%), so the cuts stay on the beat and the video's length changes to match.

## Adding a template

Create `templates/<template-id>/` with:

- `meta.json`: the template's folder, the film's `bpm`, the film time of its first strong beat (`firstBar`),
  and the default song with its known `bpm` and `firstBeat`.
- `film.html`: the film. It uses `lib/core.js`, reads the data from `window.__DATA`, and sets
  `window.__render(t)` and `window.__ready` (a promise for the film's length in seconds). If it can leave out its opening, it also
  sets `window.__firstBar`.

Put user text on screen only through `text()` (it uses `textContent`), pass user image URLs through
`safeImage()` with the template's own art as the fallback, and give long text a `maxW`.

## Tests

```
node --test lib/song.test.mjs
```

Film checks, and a check of a finished video:

```
node check-film.mjs tpl-ayodhya-royal
node check-film.mjs --video out/tpl-ayodhya-royal-sample.mp4
```

## Making a film for another template

Paste `PROMPT.md` into Claude Code with the template's id.
