"""
把 DSH 娘立绘转成 ASCII 位图（src/client/field/chan-art.ts）。

素材：references/maid_whale_chan.png（社区鲸鱼娘形象，用于本地开发参考）。
栅格尺寸按渲染端 13px 字格反推，保证 1 格位图 ≈ 1 个字格，不丢细节也不重复采样。

用法：python3 tools/chan-art.py <源图> [宽]
"""
import sys
from collections import deque
from PIL import Image

src = sys.argv[1] if len(sys.argv) > 1 else "/root/projects/dsh-live-mode/references/deepseek_chan/maid_whale_chan.png"
W = int(sys.argv[2]) if len(sys.argv) > 2 else 30

img = Image.open(src).convert("RGBA")
w, h = img.size
px = img.load()


def whiteish(r, g, b):
    return r > 236 and g > 236 and b > 236


# 从四边泛洪，找出真正的外部背景：围裙的白色被礼服轮廓包住，不会被误删
mask = [[False] * w for _ in range(h)]
queue = deque()
for x in range(w):
    for y in (0, h - 1):
        if whiteish(*px[x, y][:3]) and not mask[y][x]:
            mask[y][x] = True
            queue.append((x, y))
for y in range(h):
    for x in (0, w - 1):
        if whiteish(*px[x, y][:3]) and not mask[y][x]:
            mask[y][x] = True
            queue.append((x, y))
while queue:
    x, y = queue.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < w and 0 <= ny < h and not mask[ny][nx] and whiteish(*px[nx, ny][:3]):
            mask[ny][nx] = True
            queue.append((nx, ny))

xs = [x for x in range(w) for y in range(0, h, 4) if not mask[y][x]]
ys = [y for y in range(h) for x in range(0, w, 4) if not mask[y][x]]
x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
H = round(W * (y1 - y0) / (x1 - x0) * 0.98)
cw, ch = (x1 - x0) / W, (y1 - y0) / H
RAMP = "·.-:=+*%▒▚▓█⣿"
rows_g, rows_l, rows_c = [], [], []

for gy in range(H):
    lg, ll, lc = [], [], []
    for gx in range(W):
        ax0, ax1 = int(x0 + gx * cw), int(x0 + (gx + 1) * cw)
        ay0, ay1 = int(y0 + gy * ch), int(y0 + (gy + 1) * ch)
        rs = gs = bs = n = 0
        for y in range(ay0, ay1):
            for x in range(ax0, ax1):
                if mask[y][x]:
                    continue
                r, g, b, _ = px[x, y]
                rs += r
                gs += g
                bs += b
                n += 1
        cover = n / max(1, (ax1 - ax0) * (ay1 - ay0))
        if cover < 0.3:
            lg.append(" ")
            ll.append("0")
            lc.append("0")
            continue
        r, g, b = rs / n, gs / n, bs / n
        lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        lum = min(1.0, (lum ** 0.8) * 1.18) * (0.75 + 0.25 * cover)
        lg.append(RAMP[min(len(RAMP) - 1, int(lum * len(RAMP)))])
        ll.append("0123456789abcdef"[min(15, int(lum * 15.99))])
        if r > 200 and g > 200 and b > 200:
            c = 2
        elif b > r + 16 and lum > 0.36:
            c = 0
        elif b > r + 8:
            c = 1
        elif r > 175 and g > 135 and b > 115:
            c = 3
        else:
            c = 1
        lc.append(str(c))
    rows_g.append("".join(lg))
    rows_l.append("".join(ll))
    rows_c.append("".join(lc))


def arr(name, rows):
    body = ",\n\t".join(repr(r) for r in rows)
    return f"export const {name}: readonly string[] = [\n\t{body},\n]\n"


ts = f"""/**
 * DSH 娘（鲸鱼娘）立绘的 ASCII 位图，由 tools/chan-art.py 生成。
 *
 * 参考社区主流形象：蓝色渐变长发、鲸鳍耳、白色荷叶围裙的深蓝女仆裙、身后鲸尾。
 * 采样为 {W}×{H} 格，每格记录字形、亮度与材质；渲染层把它当作全息投影卡片在
 * 三维空间里旋转，用逐格高度差做出视差。
 *
 * @module dsh-os/field/chan-art
 */

export const CHAN_WIDTH = {W}
export const CHAN_HEIGHT = {H}
""" + arr("CHAN_GLYPHS", rows_g) + "\n" + arr("CHAN_LIGHT", rows_l) + "\n" + arr("CHAN_COLOR", rows_c)
open("src/client/field/chan-art.ts", "w").write(ts)
print(f"{W}x{H} -> src/client/field/chan-art.ts ({len(ts)} bytes)")
