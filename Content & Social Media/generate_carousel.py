import os
import sys
import requests
from PIL import Image, ImageDraw, ImageFont

# Ensure user site-packages is on path (needed for requests on system Python)
_user_site = "/Users/odomlane17/Library/Python/3.9/lib/python/site-packages"
if _user_site not in sys.path:
    sys.path.insert(0, _user_site)

# ── Output dir ──────────────────────────────────────────────────────────────
OUTPUT_DIR = "carousel_output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Brand constants ──────────────────────────────────────────────────────────
W, H = 1080, 1350
BG          = "#2B2B2B"
ORANGE      = "#F05A28"
CREAM       = "#F5EFE6"
SAND        = "#C4B5A5"
FADED       = "#7A6E65"
DIVIDER     = "#4A4A4A"
PILL_BG     = "#3D2218"
PILL_BORDER = "#7A3018"
FOOTER_COL  = "#3D3530"
PAD         = 80

# ── Font download & conversion ───────────────────────────────────────────────
FONT_DIR = os.path.join(OUTPUT_DIR, "fonts")
os.makedirs(FONT_DIR, exist_ok=True)

def fetch_font_url(family, weight):
    """Ask Google Fonts CSS API for the current TTF URL."""
    css_url = f"https://fonts.googleapis.com/css2?family={family.replace(' ', '+')}:wght@{weight}&display=swap"
    r = requests.get(css_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
    r.raise_for_status()
    for line in r.text.splitlines():
        if "fonts.gstatic.com" in line:
            start = line.index("https://fonts.gstatic.com")
            end   = line.index(")", start)
            return line[start:end].strip()
    raise RuntimeError(f"Could not find font URL in CSS for {family} {weight}")

def download_font(family, weight, name):
    ttf_path = os.path.join(FONT_DIR, name + ".ttf")
    if os.path.exists(ttf_path):
        return ttf_path
    print(f"Downloading {name}...")
    url = fetch_font_url(family, weight)
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    with open(ttf_path, "wb") as f:
        f.write(r.content)
    print(f"  Saved {ttf_path}")
    return ttf_path

playfair_path = download_font("Playfair Display", 900, "PlayfairDisplay-Black")
lora_path     = download_font("Lora", 500, "Lora-Medium")

def get_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()

# ── Drawing helpers ──────────────────────────────────────────────────────────

def new_slide():
    img = Image.new("RGB", (W, H), BG)
    return img, ImageDraw.Draw(img)

def draw_slide_header(draw, slide_num, total=6):
    fnt = get_font(lora_path, 22)
    num_text = f"{slide_num:02d} / {total:02d}"
    tag_text = "@dr.lane_o"
    draw.text((PAD, 80), num_text, font=fnt, fill=FADED)
    bbox = draw.textbbox((0, 0), tag_text, font=fnt)
    tw = bbox[2] - bbox[0]
    draw.text((W - PAD - tw, 80), tag_text, font=fnt, fill=FADED)

def draw_pill(draw, text, y):
    fnt = get_font(lora_path, 24)
    bbox = draw.textbbox((0, 0), text, font=fnt)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad_x, pad_y = 24, 12
    rx0, ry0 = PAD, y
    rx1, ry1 = PAD + tw + pad_x * 2, y + th + pad_y * 2
    # background
    draw.rounded_rectangle([rx0, ry0, rx1, ry1], radius=40, fill=PILL_BG, outline=PILL_BORDER, width=2)
    draw.text((rx0 + pad_x, ry0 + pad_y - bbox[1]), text, font=fnt, fill=ORANGE)
    return ry1  # bottom of pill

def draw_orange_bar(draw, y):
    draw.rectangle([PAD, y, PAD + 88, y + 6], fill=ORANGE)
    return y + 6

def draw_divider(draw, y):
    draw.rectangle([PAD, y, W - PAD, y + 3], fill=DIVIDER)
    return y + 3

def text_width(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]

def text_height(font, draw=None):
    # Use ascent/descent from font metrics
    try:
        ascent, descent = font.getmetrics()
        return ascent + descent
    except Exception:
        return 40

def draw_multicolor_line(draw, x, y, segments, default_font):
    """segments = list of (text, color, font_override_or_None)"""
    cx = x
    for seg_text, seg_color, seg_font in segments:
        fnt = seg_font if seg_font else default_font
        bbox = draw.textbbox((cx, y), seg_text, font=fnt)
        draw.text((cx, y), seg_text, font=fnt, fill=seg_color)
        cx += bbox[2] - bbox[0]

def draw_headline_lines(draw, lines, y, font_size=88, max_width=None):
    """
    lines = list of:
        str  → drawn in CREAM
        list of (text, color, font) tuples → inline segments
    Returns bottom y.
    """
    fnt = get_font(playfair_path, font_size)
    if max_width is None:
        max_width = W - PAD * 2
    try:
        ascent, descent = fnt.getmetrics()
        line_h = ascent + descent
    except Exception:
        line_h = font_size + 10
    line_spacing = int(line_h * 1.15)

    for line in lines:
        if isinstance(line, str):
            draw.text((PAD, y), line, font=fnt, fill=CREAM)
        else:
            draw_multicolor_line(draw, PAD, y, line, fnt)
        y += line_spacing
    return y

def draw_body_lines(draw, paragraphs, y, font_size=38, line_spacing_extra=1.45):
    """
    paragraphs = list of:
        str  → drawn in CREAM as a single para
        list of (text, color, font_or_None)  → inline-colored para
    Returns bottom y.
    """
    fnt = get_font(lora_path, font_size)
    try:
        ascent, descent = fnt.getmetrics()
        line_h = ascent + descent
    except Exception:
        line_h = font_size + 8
    para_gap = int(line_h * 0.8)

    for i, para in enumerate(paragraphs):
        if i > 0:
            y += para_gap
        if isinstance(para, str):
            # Wrap text
            words = para.split()
            current_line = ""
            for word in words:
                test = (current_line + " " + word).strip()
                bbox = draw.textbbox((0, 0), test, font=fnt)
                if bbox[2] - bbox[0] > W - PAD * 2 and current_line:
                    draw.text((PAD, y), current_line, font=fnt, fill=CREAM)
                    y += int(line_h * line_spacing_extra)
                    current_line = word
                else:
                    current_line = test
            if current_line:
                draw.text((PAD, y), current_line, font=fnt, fill=CREAM)
                y += int(line_h * line_spacing_extra)
        elif isinstance(para, list):
            # Single line of inline segments
            draw_multicolor_line(draw, PAD, y, para, fnt)
            y += int(line_h * line_spacing_extra)
    return y

def draw_faded_text(draw, text, y, font_size=32, color=FADED):
    fnt = get_font(lora_path, font_size)
    max_w = W - PAD * 2
    words = text.split()
    current_line = ""
    try:
        ascent, descent = fnt.getmetrics()
        line_h = ascent + descent
    except Exception:
        line_h = font_size + 6
    for word in words:
        test = (current_line + " " + word).strip()
        bbox = draw.textbbox((0, 0), test, font=fnt)
        if bbox[2] - bbox[0] > max_w and current_line:
            draw.text((PAD, y), current_line, font=fnt, fill=color)
            y += int(line_h * 1.4)
            current_line = word
        else:
            current_line = test
    if current_line:
        draw.text((PAD, y), current_line, font=fnt, fill=color)
        y += int(line_h * 1.4)
    return y

def draw_bullet_list(draw, items, y, font_size=36):
    fnt = get_font(lora_path, font_size)
    try:
        ascent, descent = fnt.getmetrics()
        line_h = ascent + descent
    except Exception:
        line_h = font_size + 8
    item_gap = int(line_h * 1.5)
    dot_r = 7
    for item in items:
        # Draw orange dot
        cx = PAD + dot_r
        cy = y + ascent // 2
        draw.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=ORANGE)
        draw.text((PAD + dot_r * 2 + 14, y), item, font=fnt, fill=CREAM)
        y += item_gap
    return y

# ── Slide layout engine ──────────────────────────────────────────────────────

def render_slide(slide_num, pill_text, headline_lines, body_content,
                 faded_text=None, headline_size=88, body_size=38,
                 footer_text=None, bullet_items=None):
    img, draw = new_slide()

    # Header
    draw_slide_header(draw, slide_num)
    y = 80 + 30  # baseline of header text ~30px tall

    y += 56  # gap after header

    # Pill
    pill_bottom = draw_pill(draw, pill_text, y)
    y = pill_bottom + 44

    # Orange rule
    y = draw_orange_bar(draw, y) + 36

    # Headline
    y = draw_headline_lines(draw, headline_lines, y, font_size=headline_size)

    y += 28  # gap before divider
    y = draw_divider(draw, y) + 34  # gap after divider

    # Body
    if bullet_items:
        y = draw_bullet_list(draw, bullet_items, y, font_size=body_size)
    elif body_content:
        y = draw_body_lines(draw, body_content, y, font_size=body_size)

    # Faded text
    if faded_text:
        y += 20
        y = draw_faded_text(draw, faded_text, y)

    # Footer
    if footer_text:
        fnt_footer = get_font(lora_path, 24)
        draw.text((PAD, H - 60), footer_text, font=fnt_footer, fill=FOOTER_COL)

    return img

# ── Slide 1 ──────────────────────────────────────────────────────────────────
def make_slide1():
    img, draw = new_slide()
    draw_slide_header(draw, 1)
    y = 80 + 30 + 56
    pill_bottom = draw_pill(draw, "SWIPE »", y)
    y = pill_bottom + 44
    y = draw_orange_bar(draw, y) + 36

    fnt_h = get_font(playfair_path, 88)
    fnt_b = get_font(lora_path, 38)

    headline_lines = [
        '"Bone-on-bone."',
        '"Meniscus tear."',
        '"Wear and tear."',
    ]
    y = draw_headline_lines(draw, headline_lines, y, font_size=88)

    y += 28
    y = draw_divider(draw, y) + 34

    # Body line 1
    draw.text((PAD, y), "Your ortho gave you a diagnosis.", font=fnt_b, fill=CREAM)
    try:
        _, descent = fnt_b.getmetrics()
        lh = fnt_b.getmetrics()[0] + descent
    except Exception:
        lh = 46
    y += int(lh * 1.45)

    # Body line 2 — mixed color
    seg1 = "But not an answer to "
    seg2 = "why it keeps happening."
    fnt_b_italic = fnt_b  # fallback — Lora doesn't have italic here, use orange
    draw.text((PAD, y), seg1, font=fnt_b, fill=CREAM)
    x2 = PAD + draw.textbbox((0, 0), seg1, font=fnt_b)[2]
    draw.text((x2, y), seg2, font=fnt_b, fill=ORANGE)
    y += int(lh * 1.45) + 20

    # Faded
    draw_faded_text(draw, "These describe the structure of your knee. They don't explain the pattern.", y, font_size=32)

    path = os.path.join(OUTPUT_DIR, "slide_01.png")
    img.save(path)
    print(f"Saved {path}")

# ── Slide 2 ──────────────────────────────────────────────────────────────────
def make_slide2():
    img, draw = new_slide()
    draw_slide_header(draw, 2)
    y = 80 + 30 + 56
    pill_bottom = draw_pill(draw, "SOUND FAMILIAR?", y)
    y = pill_bottom + 44
    y = draw_orange_bar(draw, y) + 36

    # Headline with "everything" in orange
    fnt_h = get_font(playfair_path, 88)
    try:
        ascent, descent = fnt_h.getmetrics()
        lh = ascent + descent
    except Exception:
        lh = 100
    line_spacing = int(lh * 1.15)

    # Line 1: "You did everything"
    seg_you = "You did "
    seg_ev  = "everything"
    draw.text((PAD, y), seg_you, font=fnt_h, fill=CREAM)
    x2 = PAD + draw.textbbox((0, 0), seg_you, font=fnt_h)[2]
    draw.text((x2, y), seg_ev, font=fnt_h, fill=ORANGE)
    y += line_spacing

    draw.text((PAD, y), "they told you.", font=fnt_h, fill=CREAM)
    y += line_spacing

    y += 28
    y = draw_divider(draw, y) + 34

    bullet_items = [
        "Rested it. It came right back.",
        "Got the injections. Made it worse.",
        "Wore the sleeve every single game.",
        "Now they're saying surgery might be next.",
    ]
    draw_bullet_list(draw, bullet_items, y, font_size=36)

    path = os.path.join(OUTPUT_DIR, "slide_02.png")
    img.save(path)
    print(f"Saved {path}")

# ── Slide 3 ──────────────────────────────────────────────────────────────────
def make_slide3():
    img, draw = new_slide()
    draw_slide_header(draw, 3)
    y = 80 + 30 + 56
    pill_bottom = draw_pill(draw, "HERE'S WHAT NOBODY CHECKED.", y)
    y = pill_bottom + 44
    y = draw_orange_bar(draw, y) + 36

    fnt_h = get_font(playfair_path, 84)
    try:
        ascent, descent = fnt_h.getmetrics()
        lh = ascent + descent
    except Exception:
        lh = 96
    ls = int(lh * 1.15)

    draw.text((PAD, y), "The knee isn't", font=fnt_h, fill=CREAM)
    y += ls

    # "the problem." in orange
    seg1, seg2 = "the ", "problem."
    draw.text((PAD, y), seg1, font=fnt_h, fill=CREAM)
    x2 = PAD + draw.textbbox((0, 0), seg1, font=fnt_h)[2]
    draw.text((x2, y), seg2, font=fnt_h, fill=ORANGE)
    y += ls

    draw.text((PAD, y), "It's the victim.", font=fnt_h, fill=CREAM)
    y += ls

    y += 28
    y = draw_divider(draw, y) + 34

    fnt_b = get_font(lora_path, 36)
    try:
        asc, desc = fnt_b.getmetrics()
        blh = asc + desc
    except Exception:
        blh = 44
    bls = int(blh * 1.45)

    draw.text((PAD, y), "Every solution treated the knee. Nobody looked at", font=fnt_b, fill=CREAM)
    y += bls
    draw.text((PAD, y), "what was driving the load into it.", font=fnt_b, fill=CREAM)
    y += bls + 20

    # Second paragraph with mixed color
    p2_a = "The knee keeps flaring because something upstream isn't"
    p2_b = "doing its job — "
    p2_c = "and the knee is paying the price."
    draw.text((PAD, y), p2_a, font=fnt_b, fill=CREAM)
    y += bls
    draw.text((PAD, y), p2_b, font=fnt_b, fill=CREAM)
    x2 = PAD + draw.textbbox((0, 0), p2_b, font=fnt_b)[2]
    draw.text((x2, y), p2_c, font=fnt_b, fill=ORANGE)

    path = os.path.join(OUTPUT_DIR, "slide_03.png")
    img.save(path)
    print(f"Saved {path}")

# ── Slide 4 ──────────────────────────────────────────────────────────────────
def make_slide4():
    img, draw = new_slide()
    draw_slide_header(draw, 4)
    y = 80 + 30 + 56
    pill_bottom = draw_pill(draw, "REAL PATIENT. TWO WEEKS.", y)
    y = pill_bottom + 44
    y = draw_orange_bar(draw, y) + 36

    fnt_h = get_font(playfair_path, 82)
    try:
        ascent, descent = fnt_h.getmetrics()
        lh = ascent + descent
    except Exception:
        lh = 94
    ls = int(lh * 1.15)

    draw.text((PAD, y), "58 years old.", font=fnt_h, fill=CREAM); y += ls
    draw.text((PAD, y), "Bone-on-bone.", font=fnt_h, fill=CREAM); y += ls
    draw.text((PAD, y), "Multiple tears.", font=fnt_h, fill=CREAM); y += ls

    seg1, seg2 = "About to get ", "PRP."
    draw.text((PAD, y), seg1, font=fnt_h, fill=CREAM)
    x2 = PAD + draw.textbbox((0, 0), seg1, font=fnt_h)[2]
    draw.text((x2, y), seg2, font=fnt_h, fill=ORANGE)
    y += ls

    y += 28
    y = draw_divider(draw, y) + 34

    fnt_b = get_font(lora_path, 36)
    try:
        asc, desc = fnt_b.getmetrics()
        blh = asc + desc
    except Exception:
        blh = 44
    bls = int(blh * 1.45)

    draw.text((PAD, y), "Injections made it worse. Wore a brace every time", font=fnt_b, fill=CREAM); y += bls
    draw.text((PAD, y), "she stepped on the court — told the brace was", font=fnt_b, fill=CREAM); y += bls
    draw.text((PAD, y), "keeping her safe.", font=fnt_b, fill=CREAM); y += bls + 20

    draw.text((PAD, y), "It wasn't. It was masking what was actually missing.", font=fnt_b, fill=CREAM)

    path = os.path.join(OUTPUT_DIR, "slide_04.png")
    img.save(path)
    print(f"Saved {path}")

# ── Slide 5 ──────────────────────────────────────────────────────────────────
def make_slide5():
    img, draw = new_slide()
    draw_slide_header(draw, 5)
    y = 80 + 30 + 56
    pill_bottom = draw_pill(draw, "AFTER TWO WEEKS WITH ME.", y)
    y = pill_bottom + 44
    y = draw_orange_bar(draw, y) + 36

    fnt_h = get_font(playfair_path, 82)
    try:
        ascent, descent = fnt_h.getmetrics()
        lh = ascent + descent
    except Exception:
        lh = 94
    ls = int(lh * 1.15)

    draw.text((PAD, y), "3 hours on court.", font=fnt_h, fill=CREAM); y += ls
    draw.text((PAD, y), "No brace. No Advil.", font=fnt_h, fill=CREAM); y += ls

    # "No price to pay" in orange
    draw.text((PAD, y), "No price to pay", font=fnt_h, fill=ORANGE); y += ls
    draw.text((PAD, y), "the next day.", font=fnt_h, fill=CREAM); y += ls

    y += 28
    y = draw_divider(draw, y) + 34

    fnt_b = get_font(lora_path, 36)
    try:
        asc, desc = fnt_b.getmetrics()
        blh = asc + desc
    except Exception:
        blh = 44
    bls = int(blh * 1.45)

    draw.text((PAD, y), "Same knee. Same MRI. Same diagnosis.", font=fnt_b, fill=CREAM); y += bls + 20
    draw.text((PAD, y), "We didn't fix her MRI. We fixed what the MRI never showed.", font=fnt_b, fill=CREAM)

    path = os.path.join(OUTPUT_DIR, "slide_05.png")
    img.save(path)
    print(f"Saved {path}")

# ── Slide 6 ──────────────────────────────────────────────────────────────────
def make_slide6():
    img, draw = new_slide()
    draw_slide_header(draw, 6)
    y = 80 + 30 + 56
    pill_bottom = draw_pill(draw, "THIS CAN BE YOU.", y)
    y = pill_bottom + 44
    y = draw_orange_bar(draw, y) + 36

    fnt_h = get_font(playfair_path, 84)
    try:
        ascent, descent = fnt_h.getmetrics()
        lh = ascent + descent
    except Exception:
        lh = 96
    ls = int(lh * 1.15)

    draw.text((PAD, y), "Want the exact", font=fnt_h, fill=CREAM); y += ls
    draw.text((PAD, y), "system I used", font=fnt_h, fill=CREAM); y += ls
    draw.text((PAD, y), "to get her there?", font=fnt_h, fill=CREAM); y += ls

    y += 28
    y = draw_divider(draw, y) + 34

    fnt_b = get_font(lora_path, 38)
    fnt_b_bold = fnt_b  # using orange as bold-equivalent
    try:
        asc, desc = fnt_b.getmetrics()
        blh = asc + desc
    except Exception:
        blh = 46
    bls = int(blh * 1.45)

    # "Comment FREE and I'll send you..."
    seg_a = "Comment "
    seg_b = "FREE"
    seg_c = " and I'll send you my free checklist —"
    draw.text((PAD, y), seg_a, font=fnt_b, fill=CREAM)
    x2 = PAD + draw.textbbox((0, 0), seg_a, font=fnt_b)[2]
    draw.text((x2, y), seg_b, font=fnt_b, fill=ORANGE)
    x3 = x2 + draw.textbbox((0, 0), seg_b, font=fnt_b)[2]
    draw.text((x3, y), seg_c, font=fnt_b, fill=CREAM)
    y += bls

    draw.text((PAD, y), "the same framework I used to get her playing 3 hours,", font=fnt_b, fill=CREAM); y += bls
    draw.text((PAD, y), "3 days a week, without knee pain.", font=fnt_b, fill=CREAM); y += bls + 24

    # Faded save text
    y = draw_faded_text(draw, "Save this. Send it to someone who's been told surgery is their only option.", y, font_size=30)

    # Footer
    fnt_footer = get_font(lora_path, 24)
    draw.text((PAD, H - 60), "PICKLEBALL CHIRO · @DR.LANE_O", font=fnt_footer, fill=FOOTER_COL)

    path = os.path.join(OUTPUT_DIR, "slide_06.png")
    img.save(path)
    print(f"Saved {path}")

# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    slides = sys.argv[1:] or ["1","2","3","4","5","6"]
    funcs = {"1": make_slide1, "2": make_slide2, "3": make_slide3,
             "4": make_slide4, "5": make_slide5, "6": make_slide6}
    print("Generating carousel slides...")
    for s in slides:
        funcs[s]()
    print("\nDone! Files saved to carousel_output/")
    for f in sorted(os.listdir(OUTPUT_DIR)):
        if f.endswith(".png"):
            fp = os.path.join(OUTPUT_DIR, f)
            sz = os.path.getsize(fp)
            print(f"  {f}  ({sz:,} bytes)")
