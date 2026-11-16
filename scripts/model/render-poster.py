"""
Genera los pósters estáticos del visor 3D (`public/anatomy/poster-front.webp` y `poster-back.webp`).

Rasteriza en CPU (numpy + Pillow) la geometría volcada por `dump-geometry.mjs`, con la misma cámara
(fov 38°, encuadre vertical) y la misma iluminación y colores que `public/anatomy/viewer.mjs`,
así que el póster se parece al visor sin dibujar ninguna parte resaltada.

    node scripts/model/dump-geometry.mjs public/models/human_muscles.glb /tmp/modelo
    python3 scripts/model/render-poster.py /tmp/modelo public/anatomy

Requiere: numpy y Pillow (con soporte WebP).
"""
import os, sys, numpy as np
from PIL import Image

def load(prefix):
    P = np.fromfile(prefix + ".p", np.float32).reshape(-1, 3).astype(np.float64)
    N = np.fromfile(prefix + ".n", np.float32).reshape(-1, 3).astype(np.float64)
    T = np.fromfile(prefix + ".i", np.uint32).reshape(-1, 3).astype(np.int64)
    G = np.fromfile(prefix + ".g", np.uint8)
    return P, N, T, G

def srgb2lin(c): c = np.asarray(c, float) / 255; return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def lin2srgb(l): l = np.clip(l, 0, 1); return np.where(l <= 0.0031308, l * 12.92, 1.055 * l ** (1 / 2.4) - 0.055)
hexrgb = lambda h: [int(h[i:i + 2], 16) for i in (1, 3, 5)]

def render(prefix, view, W=600, H=800, ss=2, zoom=1.0, center_shift=(0, 0)):
    P, N, T, G = load(prefix)
    lo, hi = P.min(0), P.max(0); s = 2 / (hi[1] - lo[1]); ctr = (lo + hi) / 2
    P = (P - ctr) * s
    r = np.linalg.norm((hi - lo) * s) / 2
    fov = np.radians(38); d = r / np.sin(fov / 2) * 1.08 / zoom
    sign = 1 if view == "front" else -1
    tgt = np.array([center_shift[0], center_shift[1], 0.0]); C = tgt + np.array([0, d * 0.04, sign * d])
    f = (tgt - C); f /= np.linalg.norm(f); rt = np.cross(f, [0, 1, 0]); rt /= np.linalg.norm(rt); up = np.cross(rt, f)
    Q = P - C; x, y, z = Q @ rt, Q @ up, Q @ f
    w, h = W * ss, H * ss; th = np.tan(fov / 2)
    sx = (x / (z * th * (W / H)) * 0.5 + 0.5) * w; sy = (1 - (y / (z * th) * 0.5 + 0.5)) * h
    x0, x1, x2 = sx[T[:, 0]], sx[T[:, 1]], sx[T[:, 2]]; y0, y1, y2 = sy[T[:, 0]], sy[T[:, 1]], sy[T[:, 2]]
    area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
    keep = area < 0
    print(view, "triángulos orientados al frente:", keep.sum(), "de", len(T))
    tri_ids = np.nonzero(keep)[0]
    X0, X1, X2, Y0, Y1, Y2, A = x0[keep], x1[keep], x2[keep], y0[keep], y1[keep], y2[keep], area[keep]
    Z = np.stack([z[T[keep, 0]], z[T[keep, 1]], z[T[keep, 2]]], 1)
    minx = np.floor(np.minimum(np.minimum(X0, X1), X2)).astype(int); maxx = np.ceil(np.maximum(np.maximum(X0, X1), X2)).astype(int)
    miny = np.floor(np.minimum(np.minimum(Y0, Y1), Y2)).astype(int); maxy = np.ceil(np.maximum(np.maximum(Y0, Y1), Y2)).astype(int)
    minx, miny = np.clip(minx, 0, w - 1), np.clip(miny, 0, h - 1); maxx, maxy = np.clip(maxx, 0, w - 1), np.clip(maxy, 0, h - 1)
    onscreen = (maxx >= minx) & (maxy >= miny)
    bw, bh = maxx - minx + 1, maxy - miny + 1
    zbuf = np.full(w * h, np.inf, np.float32); tbuf = np.full(w * h, -1, np.int64); b0buf = np.zeros(w * h, np.float32); b1buf = np.zeros(w * h, np.float32)

    def put(key, depth, tri, b0, b1):
        m = depth < zbuf[key]
        key, depth, tri, b0, b1 = key[m], depth[m], tri[m], b0[m], b1[m]
        o = np.argsort(-depth, kind="stable")
        key, depth, tri, b0, b1 = key[o], depth[o], tri[o], b0[o], b1[o]
        zbuf[key] = depth; tbuf[key] = tri; b0buf[key] = b0; b1buf[key] = b1

    def cover(idx, px, py):
        # idx: índices en arrays filtrados, px/py: píxeles candidatos (mismo tamaño)
        pxc, pyc = px + 0.5, py + 0.5
        a = A[idx]
        b0 = ((X1[idx] - pxc) * (Y2[idx] - pyc) - (X2[idx] - pxc) * (Y1[idx] - pyc)) / a
        b1 = ((X2[idx] - pxc) * (Y0[idx] - pyc) - (X0[idx] - pxc) * (Y2[idx] - pyc)) / a
        b2 = 1 - b0 - b1
        ok = (b0 >= -1e-4) & (b1 >= -1e-4) & (b2 >= -1e-4)
        idx, px, py, b0, b1, b2 = idx[ok], px[ok], py[ok], b0[ok], b1[ok], b2[ok]
        depth = (b0 * Z[idx, 0] + b1 * Z[idx, 1] + b2 * Z[idx, 2]).astype(np.float32)
        put((py * w + px).astype(np.int64), depth, idx, b0.astype(np.float32), b1.astype(np.float32))

    K = 8
    small = np.nonzero(onscreen & (bw <= K) & (bh <= K))[0]; big = np.nonzero(onscreen & ((bw > K) | (bh > K)))[0]
    print("pequeños:", len(small), "grandes:", len(big))
    for dx in range(K):
        for dy in range(K):
            m = (dx < bw[small]) & (dy < bh[small]); idx = small[m]
            if len(idx): cover(idx, minx[idx] + dx, miny[idx] + dy)
    for i in big:
        gx, gy = np.meshgrid(np.arange(minx[i], maxx[i] + 1), np.arange(miny[i], maxy[i] + 1))
        cover(np.full(gx.size, i), gx.ravel(), gy.ravel())

    # sombreado (three.js r180, luces sin escalado heredado: radiancia = color/π · irradiancia)
    pix = np.nonzero(tbuf >= 0)[0]; t = tbuf[pix]; b0 = b0buf[pix][:, None]; b1 = b1buf[pix][:, None]; b2 = 1 - b0 - b1
    g_t = tri_ids[t]; v0, v1, v2 = T[g_t, 0], T[g_t, 1], T[g_t, 2]
    n = b0 * N[v0] + b1 * N[v1] + b2 * N[v2]; n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    muscle = (G[v0] == 1)[:, None]
    base = np.where(muscle, srgb2lin(hexrgb("#27272a")), srgb2lin(hexrgb("#19191c")))
    hemi = (srgb2lin(hexrgb("#333344"))[None] * (1 - (0.5 * n[:, 1:2] + 0.5)) + srgb2lin(hexrgb("#ffffff"))[None] * (0.5 * n[:, 1:2] + 0.5)) * 2.5
    def lamb(dirv, col, k):
        dv = np.array(dirv, float); dv /= np.linalg.norm(dv); return np.clip(n @ dv, 0, None)[:, None] * srgb2lin(hexrgb(col))[None] * k
    irr = hemi + lamb((3, 4, 5), "#ffffff", 3) + lamb((-3, 1, -4), "#b9b9d0", 2)
    rgb = lin2srgb(base / np.pi * irr + 0.01)
    img = np.empty((w * h, 3)); img[:] = np.array(hexrgb("#09090b")) / 255
    img[pix] = rgb
    im = Image.fromarray((img.reshape(h, w, 3) * 255 + 0.5).astype(np.uint8))
    return im.resize((W, H), Image.LANCZOS) if ss > 1 else im

if __name__ == "__main__":
    prefix, out_dir = sys.argv[1:3]
    for view in ("front", "back"):
        path = os.path.join(out_dir, f"poster-{view}.webp")
        render(prefix, view, 600, 800).save(path, "WEBP", quality=85, method=6)
        print(path, os.path.getsize(path), "bytes")
