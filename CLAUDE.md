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
   - `lectures.json`: each module's lectures in course order and which questions belong to each (see Lectures)
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
- Opening animation (`intro` in `template.html`): the camera looks up at the sky, where the years hang as constellations
  (`YEARS`: EFM3 open; EFM2 and EFM4 "in progress", unlit and locked). Picking EFM3 zooms into it: its semesters are
  two of its stars (S5 open, S6 in progress). The picked star becomes the shooting star: the camera follows it down
  and it lands on the title as it resolves from pixels. To open a year or semester later, set `open: true` (and give
  a year its `sems`). While picking, only Escape, a real scroll or swipe, or "Skip the intro" skip it; once the star
  falls, any tap or key. Home page only; the footer has an on/off switch and "replay". It skips itself in automated
  browsers unless the URL ends in `#intro`. If the picker fails to build, the classic star falls from the corner.
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
- The quest uses them (Abi's choice), and so does a module's lecture list, so its counts match the quest's: a
  constellation counts once, as its lead (keyed, official first, then midterms, mocks, finals...), and word-for-word
  copies are left out (`lectureQs`). The lead's card has a "Constellation · N stars" chip; hovering (or tapping) it
  says where the copies come from and offers "Do all N stars", a session of every copy; Back returns to the quest
  or the lecture. Answering the lead counts only for the lead. Modules, exam sets and Most repeated still show every copy.

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

- A timed exam graded the way Abi asked: one minute per question (`EXAM_MS_PER_Q`), marked out of 20. Per question:
  all its right answers ticked = 1 point; at least half of them and no wrong tick = 0.5 (three right answers: two
  ticked 0.5, one ticked 0); any wrong tick, or a blank = 0 for that question only. Mark = points / questions × 20,
  two decimals (`examPoints`, `examMark`, `examSummary`).
- Four scopes (`scopeInfo`, `S.examScope` = `{kind, id}`): the quest (its questions, shuffled; "Exam mode" on the quest
  card); a past exam set (all its questions in their own order; the hourglass button on each set row of a module page,
  which then shows the best mark); a module (a random mock of 20, 25 or 50 questions, the sizes of a midterm, a mock
  and the finals, one per repeated question; "Exam mode" in the module header); a lecture (scope kind `topic`, up to 20
  of its questions; from its diagnostic page). Back from the rules and results returns where the exam was opened
  (`S.examBack`). A running exam always comes first: any exam button brings it back.
- While it runs: no verdict, key, explanations, report link or constellation; the strip only shows what's ticked.
  "Hand in" asks first (blanks and time left; Escape or "Keep going" closes it). At zero it hands itself in as it is,
  on any page, and on load if the time ran out while the page was closed. Warnings at 5 and 1 minutes.
- State: `S.exam` (`scope`, `qids`, `picks`, `start`, `end`, `handed`, `auto`, `unlocked`), kept apart from practice
  answers, and `S.examLog` (the last 40 marks, each with its scope key). A handed-in exam is regraded against the
  current key on load. Every answered exam question is a clean try for the weak spots. "Reset all answers" clears it all.
- Screens (`S.view = 'exam'`, `S.examScreen`): the rules (an hourglass window that lights up with the best mark),
  the running exam (clock and a running-down line in the bar), the results (mark, full / half / none / blank, by
  the quest's topics or else by lecture, the diagnostics it unlocked, past marks) and the review.

## Lectures

- Abi's Drive folder "S5 | 2025-2026 Lectures" (id `1J7CQn7OQdBKNY8H5NYLkqkdQY75QPLmB`) has every lecture of the
  semester by module. Read them with the Google Drive tools; big .pptx decks often come back empty, and a PDF copy
  in her Drive may work instead. `lectures.json` gives each lecture's Drive file id.
- `lectures.json` lists each module's lectures in course order, as the topics the site uses (`bank.diag`): the module
  page's "By lecture" list, the weak spots and the exam results. A topic is one lecture; a lecture with under 3 past
  questions shares a topic with the closest one (COPD and cor pulmonale, the four cardiomyopathy lectures...), and
  the site then names its lectures (`l`). `take` lists concept ids: a question goes to the topic of its first concept
  a topic takes (`concept@T` only with that aspect); `q` moves single questions by short id, and their word-for-word
  copies and constellation stars follow. `unasked` lists lectures no past question comes from yet.
- The build prints every topic's size and fails on a question no topic takes: when new MCQs come in, check where
  they land and add a rule or a `q` entry. Questions were assigned by reading their stems against the lectures'
  outlines (October 2026), not by concept alone: keep that care.
- Some exam topics have no lecture in the folder: pleural effusion, pneumothorax, chest trauma, mediastinal tumours,
  chronic coronary syndrome, cardiac semiology (kept as topics, `note` in the file). Dr Bencheqroun's three thoracic
  surgery decks and the skin cancers .ppt couldn't be read (too big or old format); a PDF export from Abi would do.
- On the site: a module page lists its questions by exam set (default) or by lecture (`S.topicBy`); a lecture row
  practises its questions once each, like the quest (Constellations below; with the exam-type filter; `startLecture`,
  `S.session.lec`), and the button on its right opens its diagnostic, whose Back then returns to the module
  (`S.diagFrom`). The midterm's lectures and the quest's topics hold the same questions: lectures.js checks it.

## Weak spots (the diagnostic)

- One per lecture (Lectures above). Sizes count a question once with its word-for-word copies and constellation stars.
- Evidence (`S.clean`): each question's latest clean try: the first try in practice, every exam answer, or a drill
  at least 20 hours after the last try (`DRILL_GAP`); never a retry right after the answer was shown. Answers from
  before the diagnostic existed were backfilled (picks where known, right or wrong otherwise).
- A lecture's diagnostic opens after `DIAG_MIN` (8) tries, or all its questions if it has fewer. The progress shows as
  stars, one per question needed, lit as they're tried (`xpHTML`): on the weak spots page, the home card, and under
  the verdict after each clean try ("Diagnostic unlocked" with a sparkle when it opens).
- The diagnostic: the mark on the lecture with the exam's rule, Solid (15+) / Shaky (10+) / Weak spot, what wrong ticks
  cost (and the mark without them), every proposition got wrong (ticked but false first, then missed) with the
  lecture's why, and actions: drill the missed ones, practise the ones not tried, an exam on the lecture.

## Accounts (Firebase)

- Exam mode, weak spots and quests need an account (Abi's choice, October 2026); practising questions, search, lectures
  and the update log stay open to guests. `acct.gate(reason, then)` at the top of `openExam`, `openWeak`, `openDiag`,
  `untriedTopic`, `drillTopic`, `startQuest`, `questGo`: a guest gets the sheet with the reason, and once signed in and
  named, what they clicked. Padlocks (`ICON.lock`, `lockMark()`) replace the icons on those buttons for guests; `render`
  sends a guest away from those screens (`lockedView`). Only on GitHub Pages: elsewhere (claude.ai, the tests) nothing
  is locked (`acct.member()` is true). `window.__acctTest` turns accounts on in account.js.
- Sign in with Google, or email + password (Abi switched on those two, not email links): sign in, create an account,
  forgot password. Abi's Firebase project `labubu-s-den` (free Spark plan); SDK 12.19.0 from gstatic with `import()`, only
  when the sheet opens or on load for someone signed in on this device (`efm3-acct`; `efm3-acct-name` for the label).
- Names: one per person. After signing in, someone without a name picks one (Google's first name suggested; the sign-up
  form's name is tried first). `canon`: capitals, accents, spaces, dots, dashes, apostrophes and doubled letters don't
  count, so "a.bii-M" = "Abi M."; letters only, 2 to 24. Firestore `names/{key}` = `{uid, name}`; claiming is one batch
  (new name doc, old one deleted, `users/{uid}` name + key). Changeable in the sheet ("Change it").
- Firestore `users/{uid}`: `name`, `key`, `email`, `answered` (checked answers, for Abi to see who's active), `t`, and `s`
  = JSON of the synced entries (`SYNCED`: answers, first, clean, seals, examLog) with `stamps`. Abi sees everyone in
  the Firebase console: Authentication > Users, and Firestore > Data (`users`, `names`).
- Sync: `save()` stamps every changed or deleted entry (`S.stamps`, `stamp`/`flatSync`). Between devices, per entry
  the newest change wins, deletions included (a reset or Try again isn't undone by another device); entries without
  times on either side add up (`take`). Pushing is a transaction (read, merge, write) 15 s after a change, at least every
  90 s while busy, and when the page hides; `onSnapshot` brings other devices' changes in live (re-render unless in an
  exam or typing).
- Rules Abi pasted in Firestore: a user reads/writes/deletes only their own `users` doc (`s` a string under 900 kB; if
  it has a `key`, `names/{key}` must be theirs); `names` docs: any signed-in user can read one, create one for
  themselves only if it doesn't exist (key `[a-z]{2,24}`), update or delete only their own.
- Comets need an account too (`startComets`); sure / not sure and the moon are open to guests. The game parts sync
  like the rest (`sure`, `comets`, `moon` in `SYNCED`).
- Signed in: Sign out, Delete my data (the doc and the name, then the account; if Firebase wants a fresh sign-in, the
  data goes and they're told to sign in and delete again). Top bar: the word on wide screens, a 34 px square on phones.

## Tonight: sure / not sure, comets and the moon

- Three study habits, explained in the comment block "tonight" in `template.html`. Sure / not sure: an optional pick
  before checking (first tries and comet catches go to `S.sure`), for the "Your instinct" line on the weak spots page.
- Comets: a question missed (practice or exam) comes back the next day, then after 3, 7 and 14 days (`COMET_STEPS`) until
  it sticks; missed again, it starts over. `S.comets` = {canon id: {l, d}}; at most `COMET_MAX` (20) a night. Catching
  one is a clean try for the diagnostic: "Catch its N comets" replaced the drill on the diagnostic page.
- The moon: a night counts once `MOON_DAY` (5) different questions are checked that day; it grows to full at
  `MOON_FULL` (14) nights, and a night off only pauses it (`S.moon`). The "Tonight" card on the homepage (after the
  quest) shows the moon and tonight's comets. Tests: tonight.js, weak.js.

## Themes (cosmetics, "looks" in the code)

- Earned with real study milestones (Abi's choice), never by volume: Codex = one lecture at Solid (15/20 or more on its
  diagnostic, `SOLID`, `bestDiag`); Blood moon = a first full moon (`S.moon.full`). `themeGoal(id)` gives done,
  progress, the requirement and where you are. Wearing needs an account (`canWear`: signed in, or not on GitHub
  Pages); the account named Labubu (`LOOKS_FOR`, Abi's) has every theme. A theme not earned is never worn, even if
  saved on the device.
- The homepage's "Themes" section (`themesSectionHTML`, after the weak spots card) and the account sheet
  (`themeListHTML(true)`) list them: worn, Wear it, or locked with its requirement, progress line and bar. Tapping a
  locked theme previews it for 6 s (`preview`), guests too; guests get a Sign in button. A newly earned theme is
  announced once per device by a toast on the homepage (`noticeUnlocks`, `S.themesSeen`).
- To add a theme: its tokens and pieces like the two below, an entry in `THEMES` and `LOOK_NIGHT`, and a case in
  `themeGoal`.
- The pick is kept in `efm3-look` and in her account (`look` on `users/{uid}`); `<html data-look="blood">` switches it.
- Each theme changes everything, not just colours: its own typefaces (`LOOK_FONTS`, loaded from Google Fonts the first
  time it's worn; the test copy has them locally from @fontsource), its own title (`TITLE_LOOKS`, `shadeTitle`: the
  pixel title in the theme's face, coloured pixel by pixel), cards, buttons, answer feedback, sounds (`THEME_SOUND`).
- Blood moon (`:root[data-look="blood"]` in gothic.css), a vampire's library at the eclipse: Grenze Gotisch (blackletter)
  headings and Crimson Pro for reading; the title in blackletter, bone turning to blood, with pixel drips; black velvet
  cards with a crimson rule and gothic corner brackets; an eclipse glow behind the stars; bat marks on the labels;
  a blackletter initial on each question; a wrong pick bleeds (two drips), right ones glow candle-gold (right is gold,
  wrong scarlet, half lilac, so red never means right); a right answer plays a pipe organ chord (`organ`). On the
  homepage: the moon (`bloodMoon()`, `.bm`) in the astrolabe, castles and trees with flickering windows
  (`bloodLandHTML`), bats every 32 s (`batsHTML`; none with reduced motion). In the intro: the moon big behind the
  picker, shrinking into the homepage's (`MS` → `ME`), nine bats after the falling star (`drawBat`), the `bats` sound.
- Codex (`:root[data-look="codex"]`), an illuminated manuscript on a candlelit desk: IM Fell English for headings,
  EB Garamond (italic for labels), UnifrakturMaguntia for the motto's initial. The homepage is a folio: parchment
  ruled in gold and vermilion with quatrefoils in the corners, the title in gold leaf outlined in ink with a vermilion
  shadow, the astrolabe in brown ink over the gilded halo (`goldHalo()`), and at its foot the motto "Hic locus est ubi
  mors gaudet succurrere vitae" with a lapis initial, a snail crawling the rule (a manuscript drollery), Florence in
  ink (`codexStripHTML`). Every `.plate` is a parchment leaf (`--parchment`) written in iron-gall ink (the plate scope
  redefines the colour tokens), with a deckled edge (`clip-path: var(--deckle)`, made once by `deckle()`; not on the
  question card or the account sheet). First letters of headings are rubricated, the intro has an illuminated initial
  (gold Fell on lapis), question stems a vermilion initial, answer letters in red. Sounds: a handbell for a right
  answer, a page turned for the next question; a church bell in the intro, where the halo plays the moon's part.
  No real paintings yet (the art hosts are blocked from Claude's workspace); Abi can send public-domain ones.
- `src/tests/review_looks.js [blood|codex]` takes screenshots of each theme (home, cards, a module, a wrong answer,
  a phone) for a design review.
- Each look's disc is painted once (`discURL`, `discPaint`); `LOOK_NIGHT` lists the looks and their theme colour.
  Test: looks.js.

## The class (social)

- How the class did: every member's first tries (`S.first`) are counted once per question and person (`S.statSent`,
  synced) into Firestore `stats/{module}` = {canon id: {n, r}} with `increment`, sent at most every 5 minutes and when
  the page hides (`classSync`). After checking a question, a line under the verdict says "N% of the class got this right
  on their first try" once there are `CLASS_MIN` (10) answers (`classLine`; the module's doc is read when a quiz opens,
  at most every 10 minutes). Only for members on GitHub Pages.
- For the Labubu account only, the sheet's "Class stats" lists the questions under 40% right (10+ answers), worst first,
  and "Go through these" opens them: often a wrong key, to check with Abi's rules for mistakes.
- Also for her only: "Most questions done" (`loadTop`), the 10 accounts with the most checked answers (Firestore query on
  `users` ordered by `answered`), each with its last 7 days (summed from `days` in its `s`) and when it last synced (`t`).
  Rules: only the owner of `names/labubu` may list `users` (limit 50 or under), and `names/labubu` can never be deleted,
  so the name (and this access) can't pass to anyone else; the site never deletes it on a rename or Delete my data.
- The class sky (homepage, after Tonight; `skyHTML`), Abi's design: everyone who checked `SKY_MIN` (10) questions today
  (`S.days`, counted in `moonTick`, synced, kept 21 days; `S.dayT` = when they reached 10) rises into today's sky,
  Firestore `sky/d{day}` = {uid: {nm, c: today's count in steps (`SKY_TIERS`), t: when they rose}}, one read per homepage
  visit (at most every 3 minutes), a few writes a day per person (`classSync`). It starts empty every day. In order of
  arrival, the stars fill real constellations (`SKY_CONS`: the Little Bear, whose tail ends at the North Star, then the
  Great Bear, Cassiopeia, Orion, the Lyre, the Swan, the Lion, the Twins, the Scorpion; 65 places, then loose stars):
  dashed lines while one forms, with its empty places faint (`ghost`), drawn and named once complete. Bigger and
  sparkling with more questions; your own has a dashed ring. The North Star is the Labubu's: gold, her Labubu beside it,
  always there whether she studied or not (`northStar`). Hover, focus or tap a star, or hover a name under "Today", for
  the tooltip (`skyTip`). "Hide my star" (`skyHide` on the account, `efm3-sky-hide`). Names and counts only, never marks.
  Phones get a taller sky with bigger stars (`K`). Guests see the North Star and a sign-in button.
- Rules (pasted by Abi; always give her the whole rules file to paste, never a part to replace): `stats` docs readable and
  writable by any signed-in user (under 3000 fields); `sky` docs readable
  by signed-in users, and each user may only write their own star (count 10 to 5000), under their registered name.
- Test: class.js (it extends account.js's fake Firestore with `increment`, `deleteField`, `setDoc`).

## Anonymous stats (PostHog)

- Abi's PostHog project, EU cloud (eu.posthog.com), key in `usage` in `template.html`. Only on the GitHub Pages
  site (the claude.ai link can't send data out anyway). On by default with a cookie, no banner (Abi's choice);
  "Anonymous stats: on/off" in the footer turns it off, kept in `efm3-mcq-stats`, and switching off opts out and
  deletes PostHog's cookie and storage. All of it is wrapped so PostHog failing can never break the site.
- No names and no answers: autocapture, heatmaps, session recordings and surveys are off; only `usage.track()`
  events are sent (module and practice opened, a module listed by lecture, questions checked with their module only,
  searches, exam mode opened / started / handed in, review, sign-in sheet, locked feature clicked, sign in / sign up, report a mistake, Ask the Labubu, constellations, seals,
  update log, sound).
  Never which options were ticked, never marks. The footer switch's tooltip says so; keep it true.

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
node intro_controls.js; node intro_frames.js; node intro_pick.js; node quest.js; node update_log.js; node feedback.js; node constellation.js
node sound.js; node exam.js; node stats.js; node scopes.js; node weak.js; node lectures.js; node account.js; node tonight.js; node looks.js; node class.js
node screenshots.js   # screenshots land in src/tests/shots/
```
Playwright and Chromium are expected to be preinstalled; the tests only need the fonts from `npm install`.
