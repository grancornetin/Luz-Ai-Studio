"""Utilidades de imagen para el spike de fidelidad (solo PIL + numpy; sin instalar nada).
Uso: python -I imgtools.py <cmd> ...
  cutout <foto> <salida_png>                  recorta el producto (fondo claro uniforme -> transparente)
  compose <cutout.png> <fondo> <salida> [esc] compone producto sobre fondo (pixeles originales del producto)
  crop <foto> <salida> <cx> <cy> <frac>       recorte macro determinista (zoom) de la foto original
  thumb <in> <out> [ancho]                    miniatura jpg
  sheet <salida> <orig> <img1> [img2...]      hoja de contacto con etiquetas (nombre de archivo)
  distort <in> <out> <modo>                   alteracion adrede para calibrar el verificador
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageOps, ImageEnhance

def cutout(src, dst, mode='dist'):
    im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(float)
    h, w, _ = a.shape
    b = 12
    border = np.concatenate([a[:b].reshape(-1,3), a[-b:].reshape(-1,3), a[:,:b].reshape(-1,3), a[:,-b:].reshape(-1,3)])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((a - bg) ** 2).sum(axis=2))
    # fondo gris/blanco: tambien usa saturacion (oro/piedras son saturados u oscuros)
    mx, mn = a.max(axis=2), a.min(axis=2)
    sat = (mx - mn)
    if mode == 'dist':
        mask = (dist > 38) | (sat > 55)
    else:   # 'sat': fondo con degradado/sombra; usa saturacion + oscuridad, cierre amplio y relleno de huecos
        mask = (sat > 48) | ((a.max(axis=2) < 110))
    m = Image.fromarray((mask * 255).astype('uint8'))
    k = 3 if mode == 'dist' else 9
    m = m.filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.MinFilter(k))   # cierra huecos finos
    if mode == 'sat':
        inv = np.asarray(m) <= 127; vis = np.zeros(inv.shape, bool)
        from collections import deque
        q = deque([(y, x) for y in (0, h-1) for x in range(w)] + [(y, x) for x in (0, w-1) for y in range(h)])
        for y, x in q: vis[y, x] = inv[y, x]
        q = deque([(y, x) for y, x in q if inv[y, x]])
        while q:
            cy, cx = q.popleft()
            for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                ny, nx = cy+dy, cx+dx
                if 0 <= ny < h and 0 <= nx < w and inv[ny, nx] and not vis[ny, nx]:
                    vis[ny, nx] = True; q.append((ny, nx))
        m = Image.fromarray((~vis * 255).astype('uint8'))   # todo lo no alcanzable desde el borde = producto (rellena huecos)
    # elimina motas: conserva componentes grandes
    arr = np.asarray(m) > 127
    from collections import deque
    lab = np.zeros(arr.shape, int); cur = 0; sizes = {}
    for y in range(0, h):
        for x in range(0, w):
            if arr[y, x] and not lab[y, x]:
                cur += 1; q = deque([(y, x)]); lab[y, x] = cur; n = 0
                while q:
                    cy, cx = q.popleft(); n += 1
                    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                        ny, nx = cy+dy, cx+dx
                        if 0 <= ny < h and 0 <= nx < w and arr[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = cur; q.append((ny, nx))
                sizes[cur] = n
    keep = [k for k, n in sizes.items() if n > 0.002 * h * w]
    final = np.isin(lab, keep)
    alpha = Image.fromarray((final * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert('RGBA'); out.putalpha(alpha)
    bbox = alpha.point(lambda v: 255 if v > 20 else 0).getbbox()
    out = out.crop(bbox); out.save(dst)
    print('cutout', dst, out.size, 'bg', bg.astype(int).tolist())

def compose(cut, bgp, dst, scale=0.62):
    W, H = 1080, 1350
    bg = ImageOps.fit(Image.open(bgp).convert('RGB'), (W, H), Image.LANCZOS)
    c = Image.open(cut).convert('RGBA')
    tw = int(W * scale); th = int(c.height * tw / c.width)
    if th > H * 0.6: th = int(H * 0.6); tw = int(c.width * th / c.height)
    c = c.resize((tw, th), Image.LANCZOS)
    x, y = (W - tw) // 2, int(H * 0.5 - th / 2)
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    a = c.split()[3].point(lambda v: int(v * 0.35))
    blk = Image.new('RGBA', c.size, (20, 15, 10, 255)); blk.putalpha(a)
    sh.paste(blk, (x + 10, y + 22), blk)
    sh = sh.filter(ImageFilter.GaussianBlur(14))
    base = bg.convert('RGBA'); base.alpha_composite(sh); base.alpha_composite(c, (x, y))
    base.convert('RGB').save(dst, quality=92)
    print('compose', dst)

def crop(src, dst, cx, cy, frac):
    im = Image.open(src).convert('RGB'); w, h = im.size
    cw, ch = int(w * frac), int(h * frac * 1.25)
    cw = min(cw, w); ch = min(ch, h)
    x0 = max(0, min(w - cw, int(cx * w - cw / 2))); y0 = max(0, min(h - ch, int(cy * h - ch / 2)))
    im.crop((x0, y0, x0 + cw, y0 + ch)).resize((1080, int(1080 * ch / cw)), Image.LANCZOS).save(dst, quality=92)
    print('crop', dst)

def thumb(src, dst, w=480):
    im = Image.open(src).convert('RGB'); h = int(im.height * w / im.width)
    im.resize((w, h), Image.LANCZOS).save(dst, quality=80)

def sheet(dst, files, cell=360):
    ims = [ImageOps.contain(Image.open(f).convert('RGB'), (cell, int(cell * 1.25))) for f in files]
    H = int(cell * 1.25) + 22
    S = Image.new('RGB', (cell * len(ims), H), 'white'); d = ImageDraw.Draw(S)
    for i, (f, im) in enumerate(zip(files, ims)):
        S.paste(im, (i * cell, 22)); d.text((i * cell + 4, 4), os.path.basename(f)[:48], fill='black')
    S.save(dst, quality=85); print('sheet', dst, S.size)

def distort(src, dst, mode):
    im = Image.open(src).convert('RGB')
    if mode == 'hue':   # cambia color (oro -> rosado/verdoso) y estira proporcion
        hsv = np.asarray(im.convert('HSV')).copy(); hsv[..., 0] = (hsv[..., 0].astype(int) + 70) % 256
        im = Image.fromarray(hsv, 'HSV').convert('RGB'); im = im.resize((int(im.width * 1.35), im.height))
    elif mode == 'erase':  # borra 3 piedras (esmeralda, peridoto, citrino) tapandolas con textura de oro copiada de la placa (alteracion sutil y realista)
        w, h = im.size
        patch = im.crop((470, 395, 560, 470)).resize((130, 130))
        mask = Image.new('L', (130, 130), 0); ImageDraw.Draw(mask).ellipse((8, 8, 122, 122), fill=255); mask = mask.filter(ImageFilter.GaussianBlur(6))
        for (x, y) in [(388, 545), (470, 605), (578, 665)]:
            im.paste(patch, (x - 65, y - 65), mask)
    im.save(dst, quality=92)

if __name__ == '__main__':
    c = sys.argv[1]; a = sys.argv[2:]
    if c == 'cutout': cutout(*a)  # cutout <foto> <salida> [dist|sat]
    elif c == 'compose': compose(a[0], a[1], a[2], float(a[3]) if len(a) > 3 else 0.62)
    elif c == 'crop': crop(a[0], a[1], float(a[2]), float(a[3]), float(a[4]))
    elif c == 'thumb': thumb(a[0], a[1], int(a[2]) if len(a) > 2 else 480)
    elif c == 'sheet': sheet(a[0], a[1:])
    elif c == 'distort': distort(*a)
