# Labubu’s Den: notes for Claude

Labubu’s Den (first called EFM3 MCQ Bank) is a practice site for past EFM3 exam questions (third-year medicine, semester 5, 2025–2026), built for Abi and her class.
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
   - `corrections.json`: doc mistakes Abi confirmed; `feedback.json`: the Google Form behind the feedback buttons
   - `explanations.json`: why each proposition is right or wrong, from Abi's lecture summaries
   - `constellations.py`: finds copies of a question with the same propositions (used by the quest)
2. `python3 src/build.py` writes `index.html` (full page with meta tags, icon, link preview) and `src/out/artifact.html`.
3. Check it in a browser (see Tests), then commit sources and `index.html` together and push to `main`.

## Design rules (from Abi's feedback)

- One dark "constellation gothic" look: charcoal paper, bone ink, grain, stars. No light mode.
- Type: Instrument Serif italic for display, EB Garamond for anything read, IBM Plex Mono only for small data labels.
- No all-caps text anywhere except the pixel title "LABUBU’S DEN". She found caps hard to read.
- The Labubu head (`src/labubu.svg`, Abi's artwork) is the logo: bone face, charcoal lines. The build makes
  `favicon.svg` from it and a `<symbol id="labubu">` for the top bar. `favicon-32.png` and `icon-180.png` were
  rendered once from `favicon.svg` (redo them if the art changes); `og.jpg` is the hero at 1400×735 scaled to 1200×630.
- Motion should feel smooth (view transitions between screens, spring easing). Always respect `prefers-reduced-motion`.
- Opening animation (`intro` in `template.html`): the camera looks up at the sky, a shooting star falls, the camera follows it down,
  and the star lands on the title as it resolves from pixels. Home page only; a tap, key or scroll skips it;
  the footer has an on/off switch and "replay". It skips itself in automated browsers unless the URL ends in `#intro`.
- A theme switcher (gothic + the original "classic" answer-sheet look) was started and parked at Abi's request.
  The work is in `src/wip_themes/` if she asks for it again.

## Mistakes in the docs: flag, show, wait for Abi

- Never quietly work around a mistake in the source docs (a typo that changes the topic, a wrong answer key,
  two docs disagreeing on the same question, a missing option...), not even through tags or `OVERRIDES`.
  Flag it to Abi: show her the question as the doc has it, what looks wrong and why, and what you'd change.
  Change nothing until she confirms.
- Once she confirms, add the fix to `src/corrections.json`: the short id, the field (`stem`, `option A`–`E`
  or `answer` as letters), the doc's text in `from` (the build checks it still matches), the fix in `to`,
  the date she confirmed, and `why` (for the record). `also` sets other fields, e.g. a Claude-suggested answer
  replaced by the docs' answer becomes `key: proposed` with `twinOf` and no Claude note.
- Nothing about a fix is shown on the question: Abi doesn't want classmates to see notes. Instead the update
  log gets a short "Corrected questions" entry (`kind: "Corrections"`). Saved answers are regraded against
  the current key when the page loads, so old results follow a corrected key.
- Reports from classmates arrive through the feedback form (below). Treat them the same way: check the
  question, show Abi what you found, and wait for her answer.

## Feedback

- Every question has a "Report a mistake" link at the foot of its card; the homepage (under "About this bank"),
  the footer and the update log have "Ask the Labubu". They open Abi's Google Form ("Ask the Labubu") in a new tab,
  with "What is it about?" ticked and, for a mistake, the question filled in (short id, exam set and number,
  case, stem, options, the answer shown). The question is also copied to the clipboard.
- `src/feedback.json` holds the form's pre-filled link (made with "A mistake in a question" ticked and "x" in
  "The question"); the build reads the form address and field ids from it. If Abi edits the form's questions
  or option names, ask her for a new pre-filled link. With no link, the buttons are hidden.
- Responses reach Abi by email and in a linked Google Sheet; Claude can't see them unless she shares them.

## Explanations from the lectures

- Abi sends the summary of a lecture (PDF) as she studies. For every question on that lecture's topics, write
  one short line per proposition saying why it's right or wrong, in `src/explanations.json`: add the lecture
  under `lectures`, then one entry per question (short id, `lecture`, one line per option letter). Ground the
  lines in her summary; keep them short and plain, no capitals for emphasis.
- One entry covers the question's constellation and word-for-word copies: the build copies it over, matching
  options by wording. Write entries for the quest's leads and for every question that isn't in a constellation.
- If the lecture contradicts an answer key, don't explain it: flag it to Abi first (rule above). That's how
  the lobar pneumonia management question was caught (her CAP lecture includes physio and smoking cessation).
- On the site the lines show under "Notes & explanations" once a question is checked, labelled with the lecture.

## Constellations

- `constellations.py` groups the copies of a repeated question (same `repeats.json` cluster) whose stems agree
  and whose propositions pair up one to one: any order, typos, "ATB"/"antibiotic", "insidious"/"progressive"
  onset, hyphens... but never a meaning word (not, acute/chronic, left/right, a number). Keys must agree;
  a disagreement is printed by the build as a conflict to show Abi.
- Only the quest uses them (Abi's choice): a constellation counts once, as its lead (keyed, official first, then
  midterms, mocks, finals...). The lead's card has a "Constellation · N stars" chip; hovering (or tapping) it
  says where the copies come from and offers "Do all N stars", a session of every copy; Back returns to the quest.
  Answering the lead counts only for the lead. Modules, exam sets and Most repeated still show every copy.

## Sounds and haptics

- `sfx` in `template.html`: every sound is synthesized in the browser, sample by sample, from a recipe (no audio
  files): `tick` / `untick` (picking an option; each option is a note of a pentatonic scale via `playbackRate`),
  `nav` (moving between questions), `right` (two celesta notes, pitched up with the streak of right answers;
  every 5th in a row adds `sparkle`), `wrong` / `partial` (soft knocks on wood), `seal` (wax thud + stars, timed
  to the stamp animation), `sparkle` (a constellation card opening), `finish` (a session ending at 80%+).
  Levels in `LEVEL`, a little room reverb on the chimes in `WET`.
- On by default (Abi wants it satisfying); quiet; iPhones follow the silent switch (`navigator.audioSession`
  'ambient'). The audio context only starts on a tap. Switches: the speaker in the quiz bar and "Sounds" in the
  footer (`efm3-mcq-sound`); "Vibration" in the footer on touch phones (`efm3-mcq-haptics`). Haptics: Android
  `navigator.vibrate`, iOS the native switch trick (flipping an `<input type=checkbox switch>` plays the system tick).
- Claude can't listen: when changing a sound, check its stats and spectrum offline (render the recipe in Node)
  and ask Abi how it sounds on her phone.

## Quests

- The current quest is set in `src/quests.json`: a title, the module, the exam date (`due`), the goal (% right),
  and topics. Each topic lists concept ids from `concepts.py` (plus optional `add` / `drop` lists of short ids
  like `"R83"`). The build gathers every question in that module tagged with those concepts, keeps one question
  per constellation, puts the most repeated first, and prints the counts per topic: check them before shipping.
- On the site it's a card on the homepage (countdown, progress, the six topics, two wax seals) and the hero's
  main button until it's done. Done = every question answered and goal% right, retries count.
  "Clean run" = goal% right on the first try (first results are kept in `S.first`).
- After the due date the card shows "Quest ended" and the hero goes back to normal. For the next exam,
  ask Abi for the topics and date, add a quest to `quests.json` and point `current` at it.

## Exam mode

- The quest taken as a timed exam, graded the way Abi asked: every quest question with a key, shuffled, one minute
  each (`EXAM_MS_PER_Q`), marked out of 20. Per question: all its right answers ticked = 1 point; at least half of
  them and no wrong tick = 0.5 (three right answers: two ticked 0.5, one ticked 0); any wrong tick, or a blank = 0
  for that question only. Mark = points / questions × 20, two decimals (`examPoints`, `examMark`, `examSummary`).
- While it runs: no verdict, key, explanations, report link or constellation; the strip only shows what's ticked.
  "Hand in" asks first (blanks and time left; Escape or "Keep going" closes it). At zero it hands itself in as it is,
  on any page, and on load if the time ran out while the page was closed. Warnings at 5 and 1 minutes.
- State: `S.exam` (shuffled `qids`, `picks`, `start`, `end`, `handed`, `auto`), kept apart from practice answers,
  and `S.examLog` (the last 20 marks). A handed-in exam is regraded against the current key on load, like
  practice answers. "Reset all answers" clears both; "Reset this quest" doesn't touch them.
- Screens (`S.view = 'exam'`, `S.examScreen`): the rules (an hourglass window that lights up with the best mark),
  the running exam (clock and a running-down line in the bar), the results (mark, full / half / none / blank,
  by topic, past exams) and the review (picks against the key, the point and why, the explanations). The quest card
  has "Exam mode"; while an exam runs it and the hero say "Back to the exam" with the clock.

## Anonymous stats (PostHog)

- Abi's PostHog project, EU cloud (eu.posthog.com), key in `usage` in `template.html`. Only on the GitHub Pages
  site (the claude.ai link can't send data out anyway), and only after the visitor taps Allow in the banner (asked
  once, after the opening animation, never over a question) or turns on "Anonymous stats" in the footer.
  The choice is kept in `efm3-mcq-stats`; switching off opts out and deletes PostHog's cookie and storage.
- No names and no answers: autocapture, heatmaps, session recordings and surveys are off; only `usage.track()`
  events are sent (module and practice opened, questions checked with their module only, searches, exam mode
  opened / started / handed in, review, report a mistake, Ask the Labubu, constellations, seals, update log, sound).
  Never which options were ticked, never marks. Changing that means changing the banner's words first.

## Update log

- `src/updates.json`, newest first: `id`, `date`, `title`, `items` (one short line each), an optional `kind`
  label for entries without questions (default "New on the site"), and for
  question uploads the exam sets they brought (`sets`: set ids, or `types`: exam types) and/or single questions
  (`questions`: short ids). The build counts the questions per entry.
- Every time new MCQs go into `bank.json`, add an entry at the top: today's date, a title naming the exam
  (e.g. "Cardio midterm 2026–2027"), the new set ids, and a line on where they come from. New features get
  an entry too, but only study features (search, quests...) and new questions: Abi doesn't want renames,
  hosting or design changes in it. Returning visitors then see "+N new" on the question count at the top of the homepage until they
  open the log; the log has a button to practise an entry's questions (up to 300).
- First-time visitors start with nothing marked new (`S.seenUpdate` is set to the newest entry).

## Data notes

- Question fields: `id`, `topic`, `source` (exam set), `n`, `stem`, `options` (HTML), `answer` (option indices),
  `key` (official / proposed / claude / none), `qNotes`, `optNotes`, `notes`, `case`, `stemImgs`, `twinOf`, `flag`.
  The build adds `sid` (short id like `R244`), `c` (topic concepts), `a` (aspect), `rep` (repeat cluster) and `dupOf`,
  after applying `corrections.json`.
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
node intro_controls.js; node intro_frames.js; node quest.js; node update_log.js; node feedback.js; node constellation.js
node sound.js; node exam.js; node stats.js
node screenshots.js   # screenshots land in src/tests/shots/
```
Playwright and Chromium are expected to be preinstalled; the tests only need the fonts from `npm install`.
