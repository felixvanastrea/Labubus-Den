"""The Golden phase's painting: Klimt's The Kiss (1908, public domain), from the photo Abi sent, with the lovers cut out
of the painting's dark speckled ground so they stand on the light page.

    python3 src/pipeline/klimt_cut.py kiss.png cut.png      # then: cut.png -> img/klimt-kiss.webp (PIL, WEBP q80)

The ground is flooded in from the left, right and top edges through dark or red-orange speckle pixels (never gold or
skin); in the meadow only the darkest ground goes; small islands are dropped, the edge eroded and feathered, and the
meadow fades out at the bottom. cut_prev.jpg shows it on the page's ivory.
"""
import numpy as np, cv2, sys
src = cv2.imread(sys.argv[1])
h0, w0 = src.shape[:2]; H = 1500; W = round(w0 * H / h0)
im = cv2.resize(src, (W, H), interpolation=cv2.INTER_AREA)
f = im.astype(np.float32) / 255; b, g, r = f[..., 0], f[..., 1], f[..., 2]
lum = .299 * r + .587 * g + .114 * b
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); hue = hsv[..., 0].astype(np.int32) * 2; sat = hsv[..., 1] / 255
speck = (hue < 28) & (sat > .45) & (g < r * .62)            # the red-orange spatter
ground = (lum < .3) | speck
low = np.zeros_like(ground); low[int(H * .74):, :] = True
ground = np.where(low, ((lum < .13) | speck) & (np.linspace(0, 1, H)[:, None] < .9), ground)   # in the meadow, only the darkest ground goes
ground = cv2.morphologyEx(ground.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
# keep only the ground connected to the left, right and top edges
n, lab = cv2.connectedComponents(ground, connectivity=4)
edge = set(np.unique(np.concatenate([lab[0, :], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(edge))
bg = cv2.morphologyEx(bg.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
# fill small holes of figure inside the ground (stray speckles), then a soft edge
fig = 1 - bg
nf, lf, st, _ = cv2.connectedComponentsWithStats(fig, connectivity=4)
for i in range(1, nf):
    if st[i, cv2.CC_STAT_AREA] < 400: fig[lf == i] = 0
fig = cv2.erode(fig, np.ones((3, 3), np.uint8))
alpha = cv2.GaussianBlur(fig.astype(np.float32), (0, 0), 1.6)
# the meadow fades out toward the bottom
yy = np.linspace(0, 1, H)[:, None]; alpha *= np.clip((.97 - yy) / .17, 0, 1) ** 1.5
rgba = np.dstack([im, (alpha * 255).astype(np.uint8)])
out = sys.argv[2]
cv2.imwrite(out, rgba)
# a preview on the page's ivory
bgc = np.array([210, 233, 243], np.float32)  # BGR of #f3e9d2
prev = im.astype(np.float32) * alpha[..., None] + bgc * (1 - alpha[..., None])
cv2.imwrite(out.replace('.png', '_prev.jpg'), cv2.resize(prev.astype(np.uint8), (W // 2, H // 2)))
print(W, H, 'kept', round(float(alpha.mean()), 3))
