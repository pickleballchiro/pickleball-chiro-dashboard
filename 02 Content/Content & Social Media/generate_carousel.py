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

def draw_slide_header(draw, slide_num, total=5):
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
    draw.rounded_rectangle([rx0, ry0, rx1, ry1], radius=40, fill=PILL_BG, outline=PILL_BORDER, width=2)
    draw.text((rx0 + pad_x, ry0 + pad_y - bbox[1]), text, font=fnt, fill=ORANGE)
    return ry1

def draw_orange_bar(draw, y):
    draw.rectangle([PAD, y, PAD + 88, y + 6], fill=ORANGE)
    return y + 6

def draw_divider(draw, y):
    draw.rectangle([PAD, y, W - PAD, y + 3], fill=DIVIDER)
    return y + 3

def draw_multicolor_line(draw, x, y, segments, default_font):
    cx = x
    for seg_text, seg_color, seg_font in segments:
        fnt = seg_font if seg_font else default_font
        bbox = draw.textbbox((cx, y), seg_text, font=fnt)
        draw.text((cx, y), seg_text, font=fnt, fill=seg_color)
        cx += bbox[2] - bbox[0]

def draw_headline_lines(draw, lines, y, font_size=88, max_width=None):
    """
    lines = list of:
        str  -> drawn in CREAM
        list of (text, color, font) tuples -> inline segments with color
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
        str  -> wrapped in CREAM
        list of (text, color, font_or_None)  -> inline-colored single line
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
        cx = PAD + dot_r
        cy = y + ascent // 2
        draw.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=ORANGE)
        draw.text((PAD + dot_r * 2 + 14, y), item, font=fnt, fill=CREAM)
        y += item_gap
    return y

# ── Slide layout engine ──────────────────────────────────────────────────────

def render_slide(slide_num, pill_text, headline_lines, body_content,
                 faded_text=None, headline_size=88, body_size=38,
                 footer_text=None, bullet_items=None, total_slides=5):
    img, draw = new_slide()

    draw_slide_header(draw, slide_num, total=total_slides)
    y = 80 + 30 + 56

    pill_bottom = draw_pill(draw, pill_text, y)
    y = pill_bottom + 44

    y = draw_orange_bar(draw, y) + 36

    y = draw_headline_lines(draw, headline_lines, y, font_size=headline_size)

    y += 28
    y = draw_divider(draw, y) + 34

    if bullet_items:
        y = draw_bullet_list(draw, bullet_items, y, font_size=body_size)
    elif body_content:
        y = draw_body_lines(draw, body_content, y, font_size=body_size)

    if faded_text:
        y += 20
        y = draw_faded_text(draw, faded_text, y)

    if footer_text:
        fnt_footer = get_font(lora_path, 24)
        draw.text((PAD, H - 60), footer_text, font=fnt_footer, fill=FOOTER_COL)

    return img

# ── CAROUSEL TEMPLATES ───────────────────────────────────────────────────────
# Each template is a list of 5 slide dicts.
# Keys: pill, headline (list), body (list of str or inline segments),
#       faded (str, optional), bullets (list, optional), footer (str, optional)
# Headline supports mixed color: use (text, COLOR, None) tuples in the list.

CAROUSELS = {

    # ── MISTAKE MIRROR: Reset volley ─────────────────────────────────────────
    "reset": [
        {
            "pill": "SWIPE »",
            "headline": [
                '"Works in drilling."',
                '"Falls apart in',
                'real games."',
            ],
            "body": [
                "You know what a good reset looks like.",
                [("But ", CREAM, None), ("knowing isn't the problem.", ORANGE, None)],
            ],
            "faded": "The gap between what you know and what you do under pressure — that's what we fix.",
        },
        {
            "pill": "SOUND FAMILIAR?",
            "headline": [
                [("You did ", CREAM, None), ("everything", ORANGE, None)],
                "right in drilling.",
            ],
            "bullets": [
                "Drilled it 100 times. Muscle memory locked in.",
                "Warm-up: clean resets every time.",
                "Game situation: ball pops up. Every time.",
                "Coach says 'soft hands.' Still pops up.",
            ],
        },
        {
            "pill": "HERE'S WHAT NOBODY CHECKED.",
            "headline": [
                "It's not your",
                [("technique.", CREAM, None), (" It's your", CREAM, None)],
                [("body state.", ORANGE, None)],
            ],
            "body": [
                "Under pressure, your body does something different than in drilling. The swing looks the same. The result isn't.",
                "The gap isn't technique — it's what your body stops doing when the point matters.",
            ],
        },
        {
            "pill": "THE 5.0 DIFFERENCE.",
            "headline": [
                "What high-level",
                "players feel",
                [("before", ORANGE, None), (" contact.", CREAM, None)],
            ],
            "body": [
                "At 5.0, the reset isn't a reaction — it's a setup. The body position before the ball arrives determines everything.",
                "Most players are still moving when contact happens. That's the pop. Not the swing.",
            ],
        },
        {
            "pill": "THIS CAN BE YOU.",
            "headline": [
                "Want to drill",
                "this the right",
                "way?",
            ],
            "body": [
                [("Comment ", CREAM, None), ("LESSONS", ORANGE, None), (" and let's work on this.", CREAM, None)],
            ],
            "faded": "Save this. Share it with your partner who's getting attacked at the kitchen.",
            "footer": "PICKLEBALL CHIRO · @DR.LANE_O",
        },
    ],

    # ── RATING ROADBLOCK: Stuck at 3.5 ──────────────────────────────────────
    "plateau": [
        {
            "pill": "SWIPE »",
            "headline": [
                '"Stuck at 3.5."',
                '"Can\'t break',
                'through."',
            ],
            "body": [
                "You've taken clinics. Watched the YouTube. Drilled the third shot for months.",
                [("And you're ", CREAM, None), ("still in the same spot.", ORANGE, None)],
            ],
            "faded": "Here's why drills alone won't get you to the next rating.",
        },
        {
            "pill": "THE PATTERN.",
            "headline": [
                [("You know", CREAM, None), (" what to do.", ORANGE, None)],
                "You can't do it",
                "under pressure.",
            ],
            "bullets": [
                "Took a clinic. Helped for a week. Reverted.",
                "Third shot drops fine in warm-up. Gone in a real game.",
                "Lose to players you know you should beat.",
                "The gap between practice and games is huge.",
            ],
        },
        {
            "pill": "WHAT NOBODY CHECKED.",
            "headline": [
                "It's probably",
                [("not", ORANGE, None), (" your", CREAM, None)],
                "technique.",
            ],
            "body": [
                "The body variable — your hip position, load timing, how fatigue changes your contact point — is invisible to most coaches.",
                "You've been fixing the swing. Nobody's checked what the body does differently when a game point is on the line.",
            ],
        },
        {
            "pill": "THE 5.0 BODY VARIABLE.",
            "headline": [
                "Fresh drop",
                [("vs.", ORANGE, None), (" tired drop.", CREAM, None)],
                "Different shots.",
            ],
            "body": [
                "Same technique. But in game 3, your hips are a half-beat late. Your contact point shifts. The drop becomes a floater.",
                "That's not a technique problem. That's a body efficiency problem — and it's fixable.",
            ],
        },
        {
            "pill": "LET'S FIX IT.",
            "headline": [
                "Ready to stop",
                "plateauing?",
            ],
            "body": [
                [("Comment ", CREAM, None), ("LESSONS", ORANGE, None), (" and let's work on this.", CREAM, None)],
            ],
            "faded": "Save this. Send it to your partner who's stuck at the same rating.",
            "footer": "PICKLEBALL CHIRO · @DR.LANE_O",
        },
    ],

    # ── BELIEF VIOLATION: Third shot drop ───────────────────────────────────
    "thirddrop": [
        {
            "pill": "SWIPE »",
            "headline": [
                '"My third shot',
                'drop is',
                [('inconsistent.”', ORANGE, None)],
            ],
            "body": [
                "You can hit it perfectly in isolation. The moment a real point is on the line, it's a different ball.",
            ],
            "faded": "Here's the part of this shot nobody is talking about.",
        },
        {
            "pill": "WHAT DAVE SAYS.",
            "headline": [
                [("\"I understand", CREAM, None)],
                "what I'm",
                [("supposed to do.\"", ORANGE, None)],
            ],
            "bullets": [
                "Warm-up drops: dialed in.",
                "Drilling: consistent 8 out of 10.",
                "Actual game: can't execute when it matters.",
                "\"I've watched it a hundred times. Can't do it.\"",
            ],
        },
        {
            "pill": "THE REAL VARIABLE.",
            "headline": [
                "Your hips are",
                [("late.", ORANGE, None), (" Not your", CREAM, None)],
                "paddle.",
            ],
            "body": [
                "Contact point consistency on the third shot is driven by hip position, not swing path. When you're tired or under pressure, the hips arrive a fraction of a second late.",
                "That fraction changes everything about where the ball goes.",
            ],
        },
        {
            "pill": "WHAT 4.5+ PLAYERS HAVE.",
            "headline": [
                "Reproducible",
                "shots under",
                [("pressure.", ORANGE, None)],
            ],
            "body": [
                "It's not talent. It's a physical calibration — body awareness that makes the shot the same in game 3 as it is in warm-up.",
                "That's teachable. And it starts with addressing the body variable, not the swing.",
            ],
        },
        {
            "pill": "LET'S BUILD THIS.",
            "headline": [
                "Want consistent",
                "drops in",
                "real games?",
            ],
            "body": [
                [("Comment ", CREAM, None), ("LESSONS", ORANGE, None), (" and let's work on this.", CREAM, None)],
            ],
            "faded": "Save this. Share it with your partner who keeps floating the third.",
            "footer": "PICKLEBALL CHIRO · @DR.LANE_O",
        },
    ],

    # ── PAIN ROTATION: Knee pain (Slot 5 only, max 1x/week) ─────────────────
    "knee": [
        {
            "pill": "SWIPE »",
            "headline": [
                '"Game 3.',
                'Every time.',
                [('Every game."', ORANGE, None)],
            ],
            "body": [
                "It's fine in games 1 and 2. Then it starts talking in game 3.",
                [("You know the ", CREAM, None), ("exact moment it shows up.", ORANGE, None)],
            ],
            "faded": "This isn't a coincidence. There's a pattern — and it tells you exactly what's wrong.",
        },
        {
            "pill": "SOUND FAMILIAR?",
            "headline": [
                [("You tried", CREAM, None), (" everything", ORANGE, None)],
                "they told you.",
            ],
            "bullets": [
                "Rested it. Came right back when you played.",
                "Iced it all week. Back in 20 minutes on court.",
                "PT gave you exercises. Helped — until full play.",
                "\"I'm afraid they'll tell me to stop playing.\"",
            ],
        },
        {
            "pill": "HERE'S WHAT NOBODY CHECKED.",
            "headline": [
                "The knee",
                [("isn't", ORANGE, None), (" the", CREAM, None)],
                "problem.",
            ],
            "body": [
                "Every solution treated the knee. Nobody looked at what was loading it.",
                "The game 3 pattern has a name: cumulative load from a movement pattern that breaks down under fatigue. The knee is the victim, not the source.",
            ],
        },
        {
            "pill": "THE UPSTREAM SOURCE.",
            "headline": [
                "Your split step",
                "is torquing",
                [("the medial", ORANGE, None), (" compartment.", CREAM, None)],
            ],
            "body": [
                "Every lateral push loads the knee differently depending on how your hip absorbs it. When the hip isn't doing its job, the knee pays the price.",
                "Hundreds of times per game. Cumulative. That's why game 3 is when it shows up.",
            ],
        },
        {
            "pill": "GET THE FRAMEWORK.",
            "headline": [
                "Want my free",
                "knee pain",
                "guide?",
            ],
            "body": [
                [("Comment ", CREAM, None), ("FREE", ORANGE, None), (" and I'll send it over.", CREAM, None)],
            ],
            "faded": "Save this. Send it to someone who's been told to just rest it.",
            "footer": "PICKLEBALL CHIRO · @DR.LANE_O",
        },
    ],

}

# ── Render a full carousel ───────────────────────────────────────────────────

def render_carousel(key):
    if key not in CAROUSELS:
        print(f"Unknown carousel '{key}'. Available: {', '.join(CAROUSELS.keys())}")
        sys.exit(1)

    slides = CAROUSELS[key]
    total = len(slides)
    subdir = os.path.join(OUTPUT_DIR, key)
    os.makedirs(subdir, exist_ok=True)

    print(f"Generating {total}-slide carousel: {key}")
    for i, s in enumerate(slides, 1):
        img = render_slide(
            slide_num=i,
            pill_text=s["pill"],
            headline_lines=s["headline"],
            body_content=s.get("body"),
            bullet_items=s.get("bullets"),
            faded_text=s.get("faded"),
            footer_text=s.get("footer"),
            total_slides=total,
        )
        path = os.path.join(subdir, f"slide_{i:02d}.png")
        img.save(path)
        print(f"  Saved {path}")

    print(f"\nDone! Files saved to {subdir}/")

# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    """
    Usage:
        python3 generate_carousel.py               # lists available carousels
        python3 generate_carousel.py reset          # reset volley (coaching)
        python3 generate_carousel.py plateau        # stuck at 3.5 (coaching)
        python3 generate_carousel.py thirddrop      # third shot drop (coaching)
        python3 generate_carousel.py knee           # knee pain (pain rotation only)

    Content priority: reset / plateau / thirddrop first.
    knee = Slot 5 pain rotation only (max 1x/week).
    """
    if len(sys.argv) < 2:
        print("Available carousels:")
        for k in CAROUSELS:
            print(f"  {k}")
        print("\nUsage: python3 generate_carousel.py <carousel_key>")
        print("Example: python3 generate_carousel.py reset")
        sys.exit(0)

    render_carousel(sys.argv[1])
