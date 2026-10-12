"""The Den's recorded sounds (paper, cards, swishes, clicks): CC0 recordings, trimmed, faded and loudness-matched into
small mono MP3s in snd/. The keys and the pencil are synthesized in template.html instead (sfx recipes).

The sources come from github.com/lavenderdotpet/CC0-Public-Domain-Sounds (a collection of CC0 packs; each pack's own
licence file says CC0 too). Clone it somewhere and pass its folder:

    git clone --depth 1 https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds /tmp/cc0
    python3 src/pipeline/sounds.py /tmp/cc0

Each sound is cut from where it starts (5% of its peak) to at most `max` seconds, faded in over 1.5 ms and out over
the last 30%, and brought to the same loudness as heard (its loudest 30 ms, A-weighted, at -22 dB; peaks under -1 dBFS),
so the takes of a sound match; the site's LEVEL table sets how loud each sound plays. snd/CREDITS.md lists what came from where.
"""
import os
import subprocess
import sys

import numpy as np

SR = 32000
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'snd')

KC = 'kenney_casinoaudio/Audio/'
KR = 'kenney_rpgaudio/Audio/'
BB_R = 'BB_Retail Therapy Sample Pack/'
BB_W = 'Micro Pack - Organic Wooshes/'
BB_M = 'bb - Smol Mechanisms (May 2021)/'
C100 = '100-CC0-SFX/'
# name: [(source, max seconds)], played at random so a sound never repeats exactly
SOUNDS = {
    'nav': [(KC + f'cardSlide{i}.ogg', .26) for i in (1, 2, 4, 5, 6, 8)],      # the next question: a card slid across
    'flip': [(KR + f'bookFlip{i}.ogg', .42) for i in (1, 2, 3)],              # a new page: a book's page turned
    'back': [(BB_W + f'Swish {i}.wav', .32) for i in (1, 2, 5)],              # back: a soft swish
    'sheet': [(KC + 'cardFan1.ogg', .55), (KC + 'cardTakeOutPackage2.ogg', .45)],  # a sheet opens: paper fanned out
    'shut': [(KC + f'cardPlace{i}.ogg', .28) for i in (2, 4)],                # it closes: laid down
    'crumple': [(C100 + f'paper_0{i}.ogg', .5) for i in (1, 2, 3, 4)],        # try again: the wrong try crumpled
    'stack': [(BB_R + 'Shoofing Papers 1.wav', .75)],                         # an exam handed in: the papers squared
    'mark': [(KC + f'cardPlace{i}.ogg', .26) for i in (1, 3)],                # marked: a card slipped in
    'unmark': [(KC + 'cardSlide7.ogg', .24)],                                 # unmarked: slid out
    'toggle': [(BB_M + f'Click Button {i}.wav', .2) for i in (1, 2, 3)],      # a switch
}
# a bigger crumple for Erase: two crumples, the second while the first is still going
ERASE = [(C100 + 'paper_02.ogg', 0), (C100 + 'paper_04.ogg', .16)]

CREDITS = """# Sounds

The recorded sounds in this folder are public domain (CC0 1.0), from the packs below, gathered in
https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds. They were trimmed, faded and levelled by
`src/pipeline/sounds.py`. The keyboard keys and the pencil are synthesized in the page itself.

- Casino Audio and RPG Audio, by Kenney (kenney.nl), CC0: nav (card slides), sheet, shut, mark, unmark, flip (book pages)
- Retail Therapy Sample Pack, Micro Pack: Organic Wooshes, and Smol Mechanisms, by Ben Burnes (abstractionmusic.com), CC0:
  stack (shoofing papers), back (swishes), toggle (click buttons)
- 100 CC0 SFX (OpenGameArt), CC0: crumple, erase (paper)
"""


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def cut(x, most):
    pk = np.abs(x).max() or 1e-9
    on = max(0, int(np.argmax(np.abs(x) > pk * .05)) - int(.002 * SR))
    y = x[on:on + int(most * SR)].copy()
    fi, fo = int(.0015 * SR), max(int(len(y) * .3), int(.01 * SR))
    y[:fi] *= np.linspace(0, 1, fi)
    y[-fo:] *= .5 + .5 * np.cos(np.linspace(0, np.pi, fo))
    return y


def heard(y):
    """How loud it sounds: the loudest 30 ms after A-weighting (the ear's curve), in dB."""
    f = np.maximum(np.fft.rfftfreq(len(y), 1 / SR), 1e-3); f2 = f * f
    a = (12194 ** 2 * f2 ** 2) / ((f2 + 20.6 ** 2) * np.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2))
    w = np.fft.irfft(np.fft.rfft(y) * a * 10 ** (2 / 20), n=len(y)) ** 2
    n = int(.03 * SR)
    run = np.convolve(w, np.ones(n) / n, mode='valid') if len(w) > n else [w.mean()]
    return 10 * np.log10(max(np.max(run), 1e-12))


def level(y):
    y = y * 10 ** ((-22 - heard(y)) / 20)
    pk = np.abs(y).max()
    return y * min(1, 10 ** (-1 / 20) / pk)


def write(name, y):
    path = os.path.join(OUT, name + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'quiet', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-c:a', 'libmp3lame', '-b:a', '64k', path], input=y.astype(np.float32).tobytes(), check=True)
    return os.path.getsize(path)


def main(src):
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name, files in SOUNDS.items():
        for i, (f, most) in enumerate(files, 1):
            total += write(f'{name}{i}', level(cut(load(os.path.join(src, f)), most)))
    parts = [(cut(load(os.path.join(src, f)), .5), t) for f, t in ERASE]
    y = np.zeros(int((max(t for _, t in parts) + .5) * SR))
    for p, t in parts:
        n0 = int(t * SR); y[n0:n0 + len(p)] += p
    total += write('erase1', level(y))
    open(os.path.join(OUT, 'CREDITS.md'), 'w').write(CREDITS)
    print('sounds:', sum(len(v) for v in SOUNDS.values()) + 1, 'files,', total // 1024, 'kB')


if __name__ == '__main__':
    main(sys.argv[1])
