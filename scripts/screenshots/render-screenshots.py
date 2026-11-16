"""Genera las capturas del manifest (public/screenshots/*.png).

OJO: son ilustraciones dibujadas con Pillow con los colores, textos y el póster reales de la app,
no capturas del navegador. Sirven para que el diálogo de instalación de Chrome/Android muestre algo;
cuando quieras, sustitúyelas por capturas reales con los mismos nombres y tamaños (ver docs/mejoras.md).

Uso: python3 scripts/screenshots/render-screenshots.py   (desde la raíz del proyecto; requiere Pillow)
"""
from PIL import Image, ImageDraw, ImageFont

BG, CARD, MUTED, BORDER = (9, 9, 11), (24, 24, 27), (161, 161, 170), (39, 39, 42)
RED, DARK_RED, WHITE, GREEN = (239, 68, 68), (153, 27, 27), (255, 255, 255), (34, 197, 94)
FONT = "/usr/share/fonts/opentype/inter/Inter-Regular.otf"
BOLD = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"


def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)


def rounded(d, box, radius, fill, outline=None):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=2 if outline else 0)


def text(d, xy, value, size, fill=WHITE, bold=False, anchor="la"):
    d.text(xy, value, font=font(size, bold), fill=fill, anchor=anchor)


def poster(view, height):
    img = Image.open(f"public/anatomy/poster-{view}.webp").convert("RGB")
    return img.resize((round(img.width * height / img.height), height), Image.LANCZOS)


def bottom_bar(d, w, h, active):
    top = h - 112
    d.rectangle((0, top, w, h), fill=BG)
    d.line((0, top, w, top), fill=BORDER, width=2)
    items = ["Perfil", "Entrenar", "Recap", "Rankings", "Más"]
    for i, name in enumerate(items):
        cx = round(w * (i + 0.5) / len(items))
        color = RED if name == active else MUTED
        d.ellipse((cx - 14, top + 18, cx + 14, top + 46), outline=color, width=3)
        text(d, (cx, top + 78), name, 20, color, name == active, "mm")


def header(d, w, title):
    d.rectangle((0, 0, w, 96), fill=BG)
    d.line((0, 96, w, 96), fill=BORDER, width=2)
    text(d, (w // 2, 50), title, 30, WHITE, True, "mm")


def field(d, box, label, value):
    rounded(d, box, 24, CARD, BORDER)
    text(d, (box[0] + 28, box[1] + 22), label, 20, MUTED)
    text(d, (box[0] + 28, box[1] + 56), value, 44, WHITE, True)


def entrenar():
    w, h = 720, 1280
    im = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(im)
    header(d, w, "Entrenar")
    rounded(d, (28, 128, w - 28, 232), 28, CARD, BORDER)
    text(d, (60, 152), "Ejercicio", 20, MUTED)
    text(d, (60, 184), "Press de banca", 32, WHITE, True)
    text(d, (w - 60, 180), "Pecho", 22, MUTED, False, "ra")
    rounded(d, (28, 256, w - 28, 640), 28, CARD, BORDER)
    text(d, (60, 284), "Nueva serie · Serie 3", 28, WHITE, True)
    field(d, (60, 340, 350, 450), "Peso (kg)", "82,5")
    field(d, (370, 340, w - 60, 450), "Repeticiones", "8")
    text(d, (60, 480), "Última vez: 80 kg × 8", 22, MUTED)
    rounded(d, (60, 530, w - 60, 610), 24, RED)
    text(d, (w // 2, 570), "+  Guardar serie", 28, WHITE, True, "mm")
    rounded(d, (28, 664, w - 28, 1000), 28, CARD, BORDER)
    text(d, (60, 692), "Series de hoy", 28, WHITE, True)
    for i, (weight, reps) in enumerate([("80 kg", "8"), ("80 kg", "8"), ("82,5 kg", "8")]):
        y = 752 + i * 78
        rounded(d, (60, y, w - 60, y + 64), 18, (39, 39, 42))
        text(d, (88, y + 32), f"Serie {i + 1}", 22, MUTED, False, "lm")
        text(d, (w - 88, y + 32), f"{weight} × {reps}", 26, WHITE, True, "rm")
    bottom_bar(d, w, h, "Entrenar")
    return im


def anatomia():
    w, h = 720, 1280
    im = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(im)
    header(d, w, "Entrenar")
    rounded(d, (28, 128, w - 28, 1140), 28, CARD, BORDER)
    text(d, (60, 156), "Anatomía del ejercicio", 28, WHITE, True)
    p = poster("front", 700)
    im.paste(p, ((w - p.width) // 2, 212))
    text(d, (60, 940), "● Principal", 22, RED)
    text(d, (230, 940), "● Secundario", 22, DARK_RED)
    text(d, (60, 990), "Principales: ", 22, WHITE, True)
    text(d, (214, 990), "Pectoral mayor", 22, MUTED)
    text(d, (60, 1030), "Secundarios: ", 22, WHITE, True)
    text(d, (226, 1030), "Tríceps, Deltoides anterior", 22, MUTED)
    for i, name in enumerate(["Frente", "Espalda", "← Girar", "Girar →"]):
        x = 60 + i * 150
        rounded(d, (x, 1070, x + 136, 1116), 16, CARD, BORDER)
        text(d, (x + 68, 1093), name, 20, WHITE, False, "mm")
    bottom_bar(d, w, h, "Entrenar")
    return im


def recap_wide():
    w, h = 1280, 720
    im = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 255, h), fill=BG)
    d.line((255, 0, 255, h), fill=BORDER, width=2)
    text(d, (32, 44), "GymRat", 30, WHITE, True, "lm")
    for i, name in enumerate(["Perfil", "Entrenar", "Cronómetro", "Recap", "Rankings", "Coach IA", "Historial"]):
        y = 92 + i * 52
        if name == "Recap":
            rounded(d, (16, y, 240, y + 44), 14, CARD)
        text(d, (40, y + 22), name, 20, RED if name == "Recap" else MUTED, name == "Recap", "lm")
    text(d, (296, 48), "Recap", 34, WHITE, True, "lm")
    for i, (label, value) in enumerate([("Series", "148"), ("Volumen (kg)", "12.480"), ("Sesiones", "5")]):
        x = 296 + i * 310
        rounded(d, (x, 100, x + 290, 220), 24, CARD, BORDER)
        text(d, (x + 24, 124), label, 20, MUTED)
        text(d, (x + 24, 158), value, 46, WHITE, True)
    rounded(d, (296, 244, 1240, 680), 28, CARD, BORDER)
    text(d, (328, 272), "Volumen por día", 26, WHITE, True)
    for i, (day, value) in enumerate(zip("LMXJVSD", [60, 85, 0, 100, 70, 40, 0])):
        x = 350 + i * 128
        bar = round(value * 3.0)
        if bar:
            rounded(d, (x, 640 - bar, x + 64, 640), 10, RED if value == 100 else DARK_RED)
        text(d, (x + 32, 662), day, 20, MUTED, False, "mm")
    return im


for name, render in [("narrow-entrenar", entrenar), ("narrow-anatomia", anatomia), ("wide-recap", recap_wide)]:
    image = render()
    image.save(f"public/screenshots/{name}.png", optimize=True)
    print(f"✓ public/screenshots/{name}.png {image.size}")
