# EFM3 MCQ Bank: notes for Claude

A practice site for past EFM3 exam questions (third-year medicine, semester 5, 2025–2026), built for Abi and her class.
One static page: all questions, notes and code are inlined into `index.html`; figures live in `img/`.

## Where it lives

- The repo is `felixvanastrea/Labubus-Den` (renamed from EFM3-MCQ-BANK; the old name redirects).
- **GitHub Pages** serves the repo root of `main`: https://felixvanastrea.github.io/Labubus-Den/
  Pushing to `main` redeploys it in about a minute. There is no CI; the built `index.html` is committed.
- **claude.ai artifact** (older share link, keep in sync when asked): https://claude.ai/artifact/HZk3c1yCNdBwmNS8aS6KKr
  Publish `src/out/artifact.html` to it with the Artifact tool, passing that URL (read it first if this conversation hasn't).
  The artifact version must not have its own `<html>/<head>/<body>`, which is why the build writes two files.

## Updating the site

1. Edit the sources in `src/`, never `index.html` (it's generated):
   - `template.html`: markup and all JavaScript (rendering, quiz logic, search, opening animation)
   - `css/base.css` (tokens, transitions, keyframes) and `css/gothic.css` (the look)
   - `bank.json`: questions, answers, notes; `repeats.json`: repeated-question clusters
   - `concepts.py`: topic dictionary and tagger for search; `search_extra.py`: extra search-only aliases
2. `python3 src/build.py` writes `index.html` (full page with meta tags, icon, link preview) and `src/out/artifact.html`.
3. Check it in a browser (see Tests), then commit sources and `index.html` together and push to `main`.

## Design rules (from Abi's feedback)

- One dark "constellation gothic" look: charcoal paper, bone ink, grain, stars. No light mode.
- Type: Instrument Serif italic for display, EB Garamond for anything read, IBM Plex Mono only for small data labels.
- No all-caps text anywhere except the pixel title "EFM3 MCQ BANK". She found caps hard to read.
- Motion should feel smooth (view transitions between screens, spring easing). Always respect `prefers-reduced-motion`.
- Opening animation (`intro` in `template.html`): the camera looks up at the sky, a shooting star falls, the camera follows it down,
  and the star lands on the title as it resolves from pixels. Home page only; a tap, key or scroll skips it;
  the footer has an on/off switch and "replay". It skips itself in automated browsers unless the URL ends in `#intro`.
- A theme switcher (gothic + the original "classic" answer-sheet look) was started and parked at Abi's request.
  The work is in `src/wip_themes/` if she asks for it again.

## Quests

- The current quest is set in `src/quests.json`: a title, the module, the exam date (`due`), the goal (% right),
  and topics. Each topic lists concept ids from `concepts.py` (plus optional `add` / `drop` lists of short ids
  like `"R83"`). The build gathers every question in that module tagged with those concepts, drops word-for-word
  copies, puts the most repeated first, and prints the counts per topic: check them before shipping.
- On the site it's a card on the homepage (countdown, progress, the six topics, two wax seals) and the hero's
  main button until it's done. Done = every question answered and goal% right, retries count.
  "Clean run" = goal% right on the first try (first results are kept in `S.first`).
- After the due date the card shows "Quest ended" and the hero goes back to normal. For the next exam,
  ask Abi for the topics and date, add a quest to `quests.json` and point `current` at it.

## Data notes

- Question fields: `id`, `topic`, `source` (exam set), `n`, `stem`, `options` (HTML), `answer` (option indices),
  `key` (official / proposed / claude / none), `qNotes`, `optNotes`, `notes`, `case`, `stemImgs`, `twinOf`, `flag`.
  The build adds `c` (topic concepts), `a` (aspect), `rep` (repeat cluster) and `dupOf`.
- `key: "claude"` answers were suggested by Claude because nothing was highlighted in the source doc; they carry a reason note.
- `src/pipeline/` is how `bank.json` was made from the Word docs (unzipped .docx → `parse_v2.py` → `merge_bank.py`),
  plus repeat detection (`repeats.py` with scikit-learn → `clusters_raw.json` → `repeats_final.py` with hand-checked
  DETACH/JOIN lists → `repeats.json`). These scripts were run from one flat folder: copy them next to the `src/*.json`
  files and `concepts.py` before rerunning. The Word docs themselves are not in the repo; ask Abi for new ones.

## Tests

```
python3 src/build.py && python3 src/tests/mk_test.py     # test copy with local fonts
cd src/tests && npm install && python3 -m http.server 8765 &
node search_repeats.js; node search_quiz_flow.js; node reset.js; node no_view_transitions.js
node intro_controls.js; node intro_frames.js; node quest.js; node screenshots.js   # screenshots land in src/tests/shots/
```
Playwright and Chromium are expected to be preinstalled; the tests only need the fonts from `npm install`.
