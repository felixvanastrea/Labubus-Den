# EFM3 MCQ Bank

Every question from past EFM3 exams (midterms, mocks, finals and second sessions) and from the professors' question sets, sorted by module and by exam, with answers, explanations, a topic search and the most repeated questions.

**Live site:** https://felixvanastrea.github.io/Labubus-Den/

Made by the Labubu.

## How it's put together

- `index.html` and `img/` are the site itself. GitHub Pages serves them as they are.
- `src/` holds what the site is built from: the page template, the styles, the question bank (`bank.json`) and the build script.
- `index.html` is generated. Change the files in `src/`, then run `python3 src/build.py` to rebuild it.
