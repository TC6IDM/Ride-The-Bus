# The two characters - image-generation prompts

Two mobsters in the back room, one on each side of the table. They are scenery:
they never touch the cards, never cover the board or the bar, and never react to
a result before the cards have shown it.

| | THE BOSS (right) | THE FLOORMAN (left) |
|---|---|---|
| Pose | seated in a leather club chair | standing, watching over the game |
| Faces | screen LEFT, toward the table | screen RIGHT, toward the table |
| Age, build | mid-50s, broad, heavy | late 30s, tall, lean |
| Silhouette | wide and low, dark fedora | tall and narrow, pale grey fedora |
| Moves | breathes, cigar smoke, a puff when a big win could be coming | breathes, blinks, leans in on the same moment, tips his hat after a full game win |

They are a pair, so they must look painted by the same hand: same style, same
light, same camera, same scale. Generate the Boss first, then give the
generator his image as the style reference for the Floorman.

> **Status, 2026-10-22: BUILT and in the game.** Both men, the bar cart, the
> smoke and the floor are live (`BackRoomCast.svelte`, `cast.svelte.ts`,
> `castScript.ts`, `table.css`'s floor); the art is built from the masters by
> `scripts/character-art.py`. Everything is filed in `art-masters/characters/`
> (picks, reasons and alternates in its `README.md`). Every frame is final -
> the Floorman's hat tip took three prompts (Floorman Prompt 3, third version).
> To change any frame: drop the new take in its folder under
> `art-masters/characters/`, rename it to the pick's name, and re-run
> `scripts/character-art.py`.

---

## Exactly what to send, in order (ChatGPT, image generation)

Everything goes to **ChatGPT's built-in image generation** on your Pro
account. The prompts are written for it: square for the Boss, tall portrait for
the Floorman, transparent backgrounds, and edits made with its **Select** brush.

Every animation is a swap between frames of one painting, so **the frames must
line up**. The Select brush is what makes that possible: it repaints only the
area you brush and leaves every other pixel alone. A plain "edit this image"
message redraws the whole picture, and the face and chair drift.

**Three rules for every step:**
- **Always edit the MASTER (the IDLE image), never the frame before.** Editing
  PUFF to make EXHALE stacks up drift; every frame comes from IDLE.
- **Brush generously**: the whole area that changes plus a margin round it
  (a raised arm needs the space it moves into, too).
- **Reject and redo** any frame where something outside the brushed area
  changed. I can nudge a few pixels into line; I cannot fix a different face.

Download every image with the download button (that keeps the full-size PNG
and its transparency; a screenshot or "copy image" loses both).

### Chat 1 - THE BOSS (one new chat, all his frames in it)

**Second generation, 2026-10-22: the cigar is in his FAR hand.** He sits
behind the table, so his near side (the left of the image) will be hidden by
the table's far edge and the chips; the face and the cigar have to be in the
half that stays in view. The first set, with the cigar in his near hand, is
kept in `art-masters/characters/boss/old-near-hand/`.

**Why editing does not cost quality here.** From a frame I use only the part
it was made to change - the arm, the eyes, the face - and every other pixel in
the game is the master's own. So each frame is ONE edit of the fresh master
(never an edit of an edit), and anything the generator softens outside the
brush never reaches the screen. If the brushed part itself comes back soft or
smeared, regenerate that one frame.

| Step | Click | Select-brush | Paste | Save as |
|---|---|---|---|---|
| 1 | *(new chat)* attach `floorman-idle.png` with the paperclip | - | **Boss Prompt 1 - MASTER** | `boss-idle.png` |
|   | Regenerate until it is right - every frame inherits it. Check: the cigar is in the hand on the RIGHT of the image, held out past the end of the chair arm with the ember over empty space; he looks painted by the same hand as the Floorman, and like a different man. | | | |
| 2 | `boss-idle.png` | his two eyes only | **Boss Prompt 2 - BLINK** | `boss-blink.png` |
| 3 | `boss-idle.png` | the whole far arm from the shoulder, the cigar where it rests now, his chest, his mouth and chin - **stop at the nose: NOT the eyes, NOT the hat** - plus the open space in front of (LEFT of) his mouth and chin, where the cigar will point | **Boss Prompt 3 - PUFF** | `boss-puff.png` |
| 4 | `boss-idle.png` | the same area as step 3 | **Boss Prompt 4 - LOWER, HIGH** | `boss-exhale-1-high.png` |
| 5 | `boss-idle.png` | the same area | **Boss Prompt 5 - LOWER, MID** | `boss-exhale-2-mid.png` |
| 6 | `boss-idle.png` | the same area | **Boss Prompt 6 - LOWER, LOW** | `boss-exhale-3-low.png` |
| 7 | `boss-idle.png` | the cigar arm from the shoulder and the cigar, plus the space above the chair arm it rises into | **Boss Prompt 7 - SALUTE, RAISE** | `boss-salute-1-raise.png` |
| 8 | `boss-salute-1-raise.png` | his head and hat only | **Boss Prompt 8 - SALUTE, LOOK** | `boss-salute-2-look.png` |
| 9 *(optional)* | `boss-salute-1-raise.png` | his head and hat only | **Boss Prompt 9 - SALUTE, TURNING** | `boss-salute-mid.png` |

Steps 8 and 9 are the one exception to "always edit the master": only his
head comes from them, so the raise frame under it is the right base.

Save all of them into `art-masters/characters/boss/`.

### Chat 2 - THE SMOKE: done

The smoke sheets from the first pass are kept (Boss Prompt 10 says why).

### Chat 3 - THE FLOORMAN (a new chat)

| Step | What you do | What you paste | Save as |
|---|---|---|---|
| 1 | **Attach `boss-idle.png`** (the paperclip), then send | **Floorman Prompt 1 - MASTER** | `floorman-idle.png` |
|   | Same as the Boss: regenerate or correct until it is right. Check he looks like the same artist painted him, and like a different man. | | |
| 2 | Click the Floorman IDLE image, **Select**, brush his head, hat, shoulders and folded arms down to the waist, plus the space ahead of his face | **Floorman Prompt 2 - LEAN IN** | `floorman-lean.png` |
| 3 | Click the IDLE image, **Select**, brush both arms from the shoulders down to the hands, the whole folded area across his chest and down to his left hip pocket, the hat and his whole face. Leave his shoulders' outline and his legs unbrushed | **Floorman Prompt 3 - HAT TIP** | `floorman-hattip.png` |
| 4 | Click the IDLE image, **Select**, brush only his two eyes | **Floorman Prompt 4 - BLINK** | `floorman-blink.png` |
| 5 *(optional)* | Click the IDLE image, **Select**, brush only his two eyes | **Floorman Prompt 5 - GLANCE** | `floorman-glance.png` |

That is **4-5 Boss images, 1 smoke sheet and 4-5 Floorman images**.

**If the Select brush is not on your account**, attach the IDLE image to a new
message instead and paste the same edit prompt. The prompts already say "keep
everything identical"; expect more rejects, and still always attach IDLE.

**If a background comes back white or checkered-but-opaque** (the checkerboard
painted in, not real transparency), reply: *"Same image, but with a truly
transparent background (PNG alpha), no checkerboard pattern."* Still wrong?
Reply: *"Same image on a perfectly flat mid-grey #7F7F7F background, no
gradient, no shadow"* and I will cut it out. Never green: the spill would show
on the brass and cream against the walnut walls. The smoke is meant to be on
black - I turn its brightness into transparency, which keeps the soft edges.

**Licence**: note the date and that it was your ChatGPT Pro account in
`PROVENANCE.md` (below) - the row in `ASSET_LICENCES.md` needs it, as the Suno
track's does.

---

## The scene they stand in (context for both)

So the art fits what is already on screen:

- **The room**: a dark back room. Walnut wood panelling (deep brown, near
  black in the corners) up to a thin **brass dado rail** a third of the way
  down, dark floorboards below. A heavy vignette; the middle is the brightest.
- **The table**: a large round polished-wood table seen from above at a steep
  angle, filling most of the frame, a red-backed deck and stacks of red, blue,
  green, black and white clay chips on it.
- **One lamp, upper RIGHT**, warm. Every shadow on the table falls down-left;
  every highlight sits top-right. The characters must be lit the same way.
- **The camera** is high, looking down on the table. A person would be seen
  from somewhat above, so the characters are drawn **from slightly above eye
  level, looking down about 15 degrees** - not straight on, not top-down.
- **The palette**: walnut browns, aged brass and gold, cream paper, card red
  **#a80828** (the house crimson), and the chips' colours. Matte everywhere.
  The game's rule is "lit, not haloed": **no glow, no bloom, no neon, no
  sparkle** on anything.

---

## THE BOSS (right side, seated) - second generation, cigar in the FAR hand

**Where he will be, so the picture is composed for it.** In the room's
top-right corner, BEHIND the table, about 300 px tall at 1200x675, his right
edge fully on screen. The table's far edge and the stacks of chips cover his
near side - the left of the image: the near arm, the near knee, the front
corner of the chair. What stays in view is the right half: his face, his far
hand and the cigar, the far chair arm, and the chair's back. The cigar is held
out past the end of the far chair arm so its smoke rises against the dark
wall, not across his face.

### Boss Prompt 1 - MASTER (attach `floorman-idle.png`, then paste as is)

```
A 2D game character illustration of an original 1940s crime boss seated in a
deep oxblood-red leather club chair, shown as a single full figure on a fully
transparent background (PNG with alpha). He is a casino back-room boss quietly
watching a high-stakes card game. Match the attached reference image exactly
in painting style, brushwork, palette, lighting direction and level of detail:
the two are a matched pair painted by the same artist for the same game. He is
a different man from the one in the reference.

CAMERA AND POSE: three-quarter view, viewed from slightly above eye level
(looking down about 15 degrees). His body and chair are turned toward the LEFT
of the image, as if he is watching a card table just off the left edge of the
frame; his head is turned a little further left, eyes on that table. He sits
back, settled and unhurried, his weight deep in the chair. His legs are crossed
at the knee, the polished black-and-white two-tone wingtip shoe of the top leg
clearly visible.

HIS HANDS - THIS MATTERS MOST: the cigar is in his LEFT hand, the hand FURTHER
from the viewer, on the RIGHT side of the image. That forearm rests along the
far chair arm, and the hand rests relaxed over the front end of that arm,
holding a lit cigar between two fingers. The cigar points out and slightly
down, held out PAST the end of the chair arm so that its glowing tip is over
empty space, clear of his body and clear of the chair - nothing behind the tip
but background. A heavy gold signet ring is on the little finger of that
hand. His RIGHT hand - nearer the viewer, on the left of the image - rests
empty and relaxed on the near chair arm. His chest and stomach are
unobstructed by either arm.

THE MAN: mid-50s, broad-shouldered, heavy-set but solid, a thick neck. A
square, weathered face with heavy jowls, a strong nose that was broken once, a
dark five o'clock shadow, thick dark eyebrows, grey at the temples. Heavy-lidded,
half-closed eyes and a faint, knowing half-smile: amused, patient, in charge.
Original character - no resemblance to any real person or actor.

WARDROBE: a charcoal-grey pinstripe three-piece suit, wide 1940s lapels, a
matching waistcoat buttoned over his stomach with a thin gold watch chain
looped across it. A cream shirt with a spread collar, a deep crimson silk tie
(#a80828) worn slightly loosened, a crimson silk pocket square folded in three
points. A dark charcoal felt fedora with a black grosgrain band, brim snapped
down at the front, tilted a few degrees. Gold cufflinks.

THE CHAIR: a deep oxblood-red leather club chair, worn and creased with age,
rolled arms, a row of brass nail-head studs along the front of each arm and the
base, short dark wooden feet. The whole chair is in frame, turned with him
toward the left.

THE CIGAR: a thick dark-brown cigar, a third smoked, a thin grey band of ash at
the tip, a small orange ember. NO smoke anywhere in the image - not from the
cigar, not in the air (the smoke is animated separately, and a painted wisp
would hang frozen under it).

LIGHT: a single warm lamp from the UPPER RIGHT of the image. It falls on the
top of the hat brim, his face, the far shoulder, the cigar hand and the far
chair arm; the near side of his body, toward the left of the image, falls into
soft warm shadow. A thin warm rim light runs along the top of the hat, the
shoulders and the back of the chair, so the dark silhouette reads clearly
against a dark brown wood-panelled wall. Shadows are soft and warm, never
black.

STYLE: painterly, semi-realistic, hand-painted card-game art, like a premium
illustrated casino game: confident visible brushwork, clean readable shapes, a
clear silhouette. Warm, muted palette of walnut browns, charcoal, aged brass,
cream and deep crimson. Matte surfaces. No glossy plastic look, no glow, no
bloom, no neon, no lens flare, no sparkles, no outline stroke around the
figure. Crisp and detailed, not soft or smeared.

COMPOSITION: a SQUARE image. One figure with his chair, centred horizontally,
filling about the lower 80% of the height; the top of the hat about a fifth of
the way down. The chair feet sit just above the bottom edge with a small
margin. Nothing cropped - not the hat, the shoes, the chair or the cigar.
Fully transparent background: no floor, no rug, no wall, no shadow on the
ground, no scenery, no table, no props, no cards, no money, no weapons, no
text, no logo, no signature, no watermark.
```

### Boss Prompts 2-9 - the frames (Select-brush edits; see the Chat 1 table for what to click and brush)

In every one, "his cigar hand" is his LEFT hand: further from the viewer, on
the RIGHT of the image.

**Boss Prompt 2 - BLINK**
```
Keep everything outside the selected area exactly as it is. Inside it: his
eyes are fully closed in a relaxed blink. Nothing else changes. No smoke.
```

**Boss Prompt 3 - PUFF** - plays while the last card is held. (Fourth
version, 2026-10-22. Every earlier take pointed the cigar from his lips to
the RIGHT of the image - back across his own cheek toward his ear, because
the prompt asked for it. He faces LEFT, so a cigar in his mouth points LEFT,
forward, the way he is looking.)
```
Keep everything outside the selected area exactly as it is. Inside it: he is
drawing on his cigar, relaxed and unhurried, the way a man who has smoked
cigars all his life does it - like a still from a 1940s film.

DIRECTION - THIS MATTERS MOST: he is facing toward the LEFT of the image, so
the cigar points FORWARD out of his mouth, the same way his face points:
toward the LEFT of the image, angled gently DOWN, about 15 degrees below
level. It never points back across his cheek toward his ear, and never toward
the right of the image.

THE ARM: his LEFT arm - the far arm, on the right of the image - rises from
the elbow, which stays resting on the far chair arm, and the forearm comes up
in front of his chest, so the hand is just in front of and a little below his
chin, on the side he is facing.

THE GRIP: the cigar rests lightly between the tips of his thumb, index and
middle fingers, held about a third of the way along from the end in his
mouth. Ring and little fingers curl loosely; the gold signet ring shows. The
wrist is relaxed, the palm toward him, the back of the hand toward the
viewer. The hand does NOT touch his face - no knuckles on the cheek, no fist.

THE CIGAR: the UNLIT, cut end sits in the corner of his mouth, lips closed
around it, cheeks slightly drawn in. Most of its length is beyond his
fingers, out in front of his face: the LIT end, with grey ash and a brighter
orange ember, is at the far front end, to the LEFT of his face, clear of his
hand and face. No glow around the ember.

His head, hat and eyes do not move. Same suit sleeve, same cuff, same ring.
No smoke.
```

**Boss Prompt 4 - LOWER, HIGH** - the cigar just off his lips. (Second
version, 2026-10-22: it must match the new Puff - still pointing forward -
where the first held it pointing back at his face.)
```
Keep everything outside the selected area exactly as it is. Inside it: he has
just taken the cigar from his lips. His LEFT hand (the far hand, on the right
of the image) is a few inches below and in front of his chin, the forearm up
in front of his chest, the elbow still resting on the far chair arm. He holds
the cigar lightly in his fingertips, and it still points FORWARD and DOWN,
toward the LOWER LEFT of the image - the way he is facing - with the LIT end
(ash and a small orange ember) away from him at the lower-left end; his wrist
is just beginning to turn as he lowers it. The hand does not touch his face.
Lips slightly parted in a slow exhale. No smoke - leave the air in front of
his mouth empty.
```

**Boss Prompt 5 - LOWER, MID** - halfway down.
```
Keep everything outside the selected area exactly as it is. Inside it: his
LEFT hand (the far hand, on the right of the image) holds the cigar halfway
between his mouth and the far chair arm, at the height of his chest, out to
the side, clear of his body, the elbow still on the chair arm. The cigar lies
roughly level: the UNLIT, cut end points toward him, and the LIT end - the ash
and the small orange ember - points AWAY from him, out toward the right of the
image. The lit end never points at his chest or face. Mouth closed in a faint,
satisfied half-smile. No smoke.
```

**Boss Prompt 6 - LOWER, LOW** - nearly back on the arm.
```
Keep everything outside the selected area exactly as it is. Inside it: his
LEFT hand (the far hand, on the right of the image) has almost brought the
cigar back to rest - the hand just above the front end of the far chair arm,
about to settle on it, the cigar pointing out past it. Mouth closed in a
faint, satisfied half-smile. No smoke.
```

**Boss Prompt 7 - SALUTE, RAISE** - after a full game win has been shown.
```
Keep everything outside the selected area exactly as it is. Inside it: he
raises the cigar a little in his LEFT hand (the far hand, on the right of the
image) in a small, approving toast, the elbow still on the far chair arm, the
cigar held up at shoulder height, out to the side, clear of his face.
Restrained, not cheering. His head does not move. No smoke.
```

**Boss Prompt 8 - SALUTE, LOOK** (made on `boss-salute-1-raise.png`)
```
Keep everything outside the selected area exactly as it is. Inside it: he
turns his head to look straight out at the viewer, with a slow, satisfied,
knowing smile and one eyebrow slightly raised. Same man, same face, same
charcoal fedora at the same tilt, same light from the upper right. No smoke.
```

**Boss Prompt 9 - SALUTE, TURNING** (optional; made on `boss-salute-1-raise.png`)
```
Keep everything outside the selected area exactly as it is. Inside it: his
head is halfway through turning from the table toward the viewer - a
three-quarter view, his eyes sliding toward the viewer, the knowing smile
just starting. Same man, same face, same charcoal fedora at the same tilt,
same light from the upper right. No smoke.
```

### Boss Prompt 10 - SMOKE (DONE - not regenerated)

`smoke/smoke-1.png` and `smoke-2.png` from the first pass are kept: they are
separate from the Boss, so changing his hands does not touch them. The plume
still leaves his mouth toward the left, which is the way he faces. The prompt,
for the record:

```
Cigar smoke elements for animating separately, on a PURE BLACK background
(#000000), nothing else in the image. A SQUARE image holding, well separated
from each other with clear black space between them:
- across the top half, five individual thin wisps of cigar smoke side by side,
  each a single slow rising curl, tall and narrow (about four times as tall as
  wide), every one a different shape;
- across the bottom half, two soft billowing exhaled plumes side by side, each
  a little wider than tall, drifting out to the LEFT as if breathed out by
  someone facing left, thinning and breaking up at the far end.
Pale warm grey smoke, soft-edged and translucent, painterly, matching a warm
hand-painted card-game illustration style. Lit faintly from the upper right.
No glow, no colour, no sparkles, no faces or shapes hidden in the smoke.
```

---

## THE FLOORMAN (left side, standing)

The Boss's man on the floor: the one who runs the table for him. He stands at
the left edge of the room, outside the light, arms folded, and watches every
card. Where the Boss is heavy, warm and amused, the Floorman is lean, cool and
attentive - so the two never read as the same man twice. His suit is NOT the
Boss's charcoal: midnight navy, so he separates from the walnut wall, with the
house crimson only in the pocket square.

### Floorman Prompt 1 - MASTER (attach `boss-idle.png`, then paste as is)

```
A 2D game character illustration of an original 1940s mobster - a casino
floorman and enforcer - standing alone and watching over a card game, shown as
a single full figure on a fully transparent background (PNG with alpha). Match
the attached reference image exactly in painting style, brushwork, palette,
lighting direction and level of detail: the two are a matched pair painted by
the same artist for the same game. He is a different man from the one in the
reference.

CAMERA AND POSE: full figure, head to shoes, three-quarter view, viewed from
slightly above eye level (looking down about 15 degrees). His body is turned
toward the RIGHT of the image, as if watching a card table just off the right
edge of the frame; his head is turned a little further right and tilted very
slightly down, eyes fixed on that table. He stands upright and still, weight
on his back (left) leg, the front (right) knee very slightly bent, feet apart
at shoulder width. His arms are folded across his chest, right forearm over
left, the left hand visible tucked against his right upper arm, the right hand
resting on his left bicep. Calm, patient, alert - a man who has watched a
thousand hands and misses nothing.

THE MAN: late 30s, tall (about 6'2"), lean and wiry, long-limbed, square
shoulders. A narrow, angular, clean-shaven face, high cheekbones, a sharp jaw,
a thin straight nose, a thin pale scar through the outer end of the left
eyebrow. Dark hair slicked back under the hat, short and neat at the sides.
Narrowed, steady dark eyes; a flat, unreadable mouth with a wooden toothpick
held in the corner of it. Not smiling. Original character - no resemblance to
any real person or actor.

WARDROBE: a midnight-navy double-breasted suit, peak lapels, six buttons with
two fastened, sharply tailored, the trousers high-waisted with a crisp crease
and turn-ups. A crisp white shirt, a narrow black silk tie with a small gold
tie bar. A deep crimson silk pocket square (#a80828) in a single sharp point.
A pale dove-grey felt fedora with a black band, brim snapped down low at the
front and tilted down over his right eye, so one eye is shaded. Polished black
oxford shoes. A thin gold wristwatch just showing at the left cuff. No
overcoat, no gloves.

LIGHT: a single warm lamp from the UPPER RIGHT of the image, the same light as
the reference. It falls across the front of his body and his face, the top of
the hat brim, the folded forearms and the front of the trousers; the back of
the figure, toward the left edge of the image, falls into soft warm shadow.
The hat brim throws a soft shadow over his eyes so only a glint of them
catches the light. A thin warm rim light runs down his left side and the back
of the hat, so the silhouette reads clearly against a dark brown
wood-panelled wall. Shadows are soft and warm, never black.

STYLE: painterly, semi-realistic, hand-painted card-game art, like a premium
illustrated casino game: confident visible brushwork, clean readable shapes, a
clear, tall, narrow silhouette. Warm, muted palette: midnight navy, dove grey,
white, black, aged brass and gold, deep crimson accents. Matte surfaces. No
glossy plastic look, no glow, no bloom, no neon, no lens flare, no sparkles,
no outline stroke around the figure.

COMPOSITION: a TALL PORTRAIT image (2:3). One standing figure, centred
horizontally; the soles of his shoes just above the bottom edge with a small
margin, a small margin above the hat, so he fills about 90% of the height.
Nothing cropped. Fully transparent background: no floor, no shadow on
the ground, no wall, no scenery, no table, no chair, no props, no cards, no
money, no weapons and no holster or gun anywhere, no text, no logo, no
signature, no watermark.
```

### Floorman Prompts 2-5 - the frames (each a Select-brush edit of the Floorman IDLE image)

**Floorman Prompt 2 - LEAN IN** - NOT USED. Both takes squared and bulked his
shoulders instead of leaning, so a swap would jump; the lean is done as motion
on the IDLE image (the upper body tilted a few degrees from the hips). Kept for
the record; the takes are in `alternates/`.
```
Using the attached image: keep the image identical - the same man, face, suit,
hat, lighting, colours, size, and his feet in exactly the same place on the
canvas, transparent background. Change ONLY his upper body and face: he leans
his head and shoulders forward and a little toward the right, about ten
degrees, as if looking closer at a card on a table to his right. His arms stay
folded. His eyes widen slightly under the hat brim and his brows lift a
fraction; the toothpick has stopped, held still between his lips. Tense,
attentive, holding his breath. A small, restrained change.
```

**Floorman Prompt 3 - HAT TIP** - after a full game win, once the cards have
shown it. (Third version, 2026-10-22. Every take so far kept some of the arm
fold while the right hand was up: first three arms, then a left hand jammed
in at his side with nothing to tuck under - the right arm it hid beneath in
the idle is up at the hat. And every take turned his whole body to face the
viewer, so the swap from idle jumps at the shoulders. This one drops the fold
and keeps the body where it was.)
```
Keep everything outside the selected area exactly as it is. Inside it: he
tips his hat to the viewer.

HIS BODY STAYS TURNED toward the RIGHT of the image, three-quarter, exactly
as it was - shoulders, chest and jacket in the same place. Only his head
turns, to look straight out at the viewer.

HIS ARMS - EXACTLY TWO, AND NO FOLD:
- His RIGHT arm (on the left of the image) rises: the upper arm out from the
  shoulder, the forearm up, the hand at the front of his hat brim, holding it
  between thumb and fingers in a small, respectful tip.
- His LEFT arm (on the right of the image) hangs relaxed at his side, the
  hand pushed into his trouser pocket, the jacket's front falling open a
  little over it. Nothing is folded across his chest any more; the front of
  his jacket, the buttons and the tie show clearly.

THE RAISED HAND IS FULL SIZE: a large, strong adult man's hand, as long from
wrist to fingertip as his face is from chin to hairline, the fingers long and
clearly drawn. A white shirt cuff at the wrist. NO wristwatch on that wrist.

His face: the faintest approving smile at one corner of his mouth, the
toothpick still in place. Same man, same navy suit, same grey fedora, same
light from the upper right. Understated - a nod of respect, not a
celebration. No smoke.
```

**Floorman Prompt 4 - BLINK** - for idle life.
```
Using the attached image: keep the image absolutely identical, pixel for pixel,
except his eyes, which are fully closed in a relaxed blink under the hat brim.
Nothing else changes.
```

**Floorman Prompt 5 - GLANCE** (optional - an idle fidget every so often between rounds).
```
Using the attached image: keep the image absolutely identical, pixel for
pixel, except his eyes, which glance across to the far RIGHT, as if checking
on someone sitting on the far side of the room. The head does not move.
Nothing else changes.
```

---

## Reshoot (optional): the Floorman's in-between frame

The hat tip goes from a head turned to the table straight to a head facing
the viewer. As a swap that is a jump; one midway frame turns it into a
movement. Not required - without it the turn is a quick dissolve, which is
what a painted character in a visual novel does. (The Boss's equivalent is
now Boss Prompt 9, in his own set.)

**Floorman Prompt 6 - HAT TIP, MIDWAY** (recommended: his whole upper body
turns, which is the bigger jump). In the Floorman chat: click
`floorman-idle.png`, **Select**, brush his head, hat, shoulders, chest and
right arm down to the waist. Save as `floorman-hattip-mid.png`.
```
Using the attached image: keep everything outside the selected area exactly as
it is. Inside it: he is halfway through turning from the table toward the
viewer - his head and shoulders turned about halfway, a three-quarter view,
his eyes moving toward the viewer. His left arm stays folded across his chest.
His right hand has come out of the folded arms and is rising, at the height of
his collar, on its way to the brim of his hat. Same man, same face, same
navy suit, same grey fedora, same toothpick, same light from the upper right.
No smoke.
```

---

## The Boss's corner: a bar cart (proposed, 2026-10-22)

With the Boss up in the far corner, the strip of room below him - right of
the table, down to the bar - is empty. A piece of HIS furniture fills it and
makes the corner his: a 1940s bar cart. It is a prop, not a third character:
static, no animation, dark wood and brass so it sits back against the wall
and never competes with the cards. It rhymes with the game twice - the drinks
(the red cup already on the table) and the cigar (the ashtray). Nearer the
camera than the Boss, so drawn at the Floorman's depth, its far end tucked
behind the table rim like his chair.

**Prop Prompt 1 - BAR CART** (its own new chat; attach `boss-idle.png` as the
style reference). Save as `art-masters/characters/props/barcart.png`. (Second
version, 2026-10-23. In the first, both big wheels sat INSIDE the cart: the
near one cut straight through the cigar box and the lower shelf, the far one
through the shelf. On a real bar cart the two big wheels hang on an axle
OUTSIDE the side rails, clear of the frame, and nothing on the shelves reaches
them. This version spells out the construction.)
```
A 2D game prop illustration: a 1940s mahogany two-tier bar cart, shown alone
on a fully transparent background (PNG with alpha). Match the attached
reference image exactly in painting style, brushwork, palette, lighting
direction and level of detail - it belongs in the same back room as the man
in the reference. Do not include the man or his chair.

CAMERA: three-quarter view from slightly above eye level (looking down about
15 degrees), the cart turned so its front faces toward the LEFT of the image.

THE CART: dark polished mahogany, two rectangular tiers held by four slim
turned legs, one at each corner, the lower tier a little above the floor. A
curved brass handle rail at the RIGHT end and a thin brass gallery rail round
the top tier. Worn, well used, expensive.

THE WHEELS - BUILT LIKE A REAL CART, THIS MATTERS MOST:
- Two large spoked wooden wheels with brass rims and brass hubs, at the RIGHT
  end (the handle end), one on each side of the cart.
- They are mounted OUTSIDE the cart's frame, on the ends of a single straight
  brass axle that runs across under the lower tier, between the two right-hand
  legs. Each wheel stands just outside its side of the cart, parallel to it,
  with a small clear gap between the wheel and the side of the cart - the
  wheel never overlaps, crosses or passes through any leg, shelf, rail or
  object.
- The near wheel is fully in front of the cart's near side; the far wheel is
  behind the cart's far side, partly hidden by the cart, as a real object
  would be.
- Each wheel is a little taller than the lower tier is high, its bottom on
  the same floor line as the legs.
- The two LEFT legs end in small brass castor wheels.

ON THE TOP TIER: a heavy cut-crystal decanter about two-thirds full of amber
whiskey with a crystal stopper, two short cut-glass tumblers (one with a
finger of whiskey, one empty), and a heavy round cut-glass ashtray with a
little grey ash in it. ON THE LOWER TIER, kept to the LEFT half of the shelf,
well away from the wheels: three dark glass bottles of different heights and a
closed wooden cigar box.

NO labels, words, logos or brand marks on anything - bottles and box are
plain. No cigar, no smoke, no ice, no money, no playing cards, no people.

LIGHT: a single warm lamp from the UPPER RIGHT. Small, soft highlights on the
crystal and brass - matte and restrained, no sparkle, no glow, no bloom, no
lens flare. A thin warm rim light along the top edge so it reads against a
dark brown wood-panelled wall.

STYLE: painterly, semi-realistic, hand-painted card-game art; walnut and
mahogany browns, aged brass, amber, smoky glass. No outline stroke.

COMPOSITION: a SQUARE image, the cart centred, filling about 80% of the
width, its wheels and feet just above the bottom edge with a small margin.
Nothing cropped. Fully transparent background: no floor, no shadow on the
ground, no wall, no scenery, no text, no watermark.
```

**Check before keeping one:** look at both big wheels. Each must stand clear
of the cart's side with a sliver of background between them, and the axle must
run under the shelf - not a wheel drawn ON the shelf. Then save it over
`barcart.png` (the old one goes to `props/alternates/barcart-wheels-through-shelf.png`)
and I re-run `scripts/character-art.py`.

**Prop Prompt 2 - WHISKEY GLASS - NOT USED.** The owner chose CSS instead (2026-10-23: "just CSS the whiskey glass but as detailed as possible"); the glass is `.tumbler` in `table.css`. Kept in case that changes. (2026-10-23; its own new chat; attach
`props/barcart.png` - the regenerated one, if you have it - as the reference).
Save as `art-masters/characters/props/tumbler.png`. It replaces the CSS glass
on the table (the owner: "it just looks so simple and basic CSS"), so it must
be seen from the TABLE's camera, not the cart's: the table is looked down on
from about 45 degrees, which is why the chips' tops are wide ovals. A glass
from the cart's low angle would stand on the table like a sticker.
```
A 2D game prop illustration: ONE short, heavy cut-crystal whiskey tumbler
with two fingers of amber whiskey in it, alone on a fully transparent
background (PNG with alpha). The SAME glass as the cut-crystal tumbler in the
attached reference - the same diamond-cut pattern and thick base - painted in
the same style, palette and light.

CAMERA - THIS MATTERS MOST: seen from HIGH ABOVE, looking down at about 45
degrees, as if it is standing on a card table and the viewer is standing over
the table. So the rim is a wide, open oval - the top of the glass is about
two thirds as tall as it is wide - and you look down into it: the whiskey's
surface is a large oval of amber seen through the mouth. The side of the glass
looks short, foreshortened by the high view.

THE GLASS: clear, heavy crystal, about as tall as it is wide. A thick, bright
rim. Deep diamond cuts on the lower two thirds of the side, a thick clear
base. The whiskey fills the lower third: rich, warm amber, glowing where the
light comes through it, with a thin bright line where its surface meets the
glass.

WHAT IS SEEN THROUGH IT: the glass stands on dark, polished walnut wood, and
that warm brown wood is what shows through the clear parts of the glass - paint
it in, inside the glass's outline. But OUTSIDE the glass's outline the
background is fully transparent: no table, no wood, no floor, no shadow, no
reflection on the ground.

LIGHT: one warm lamp from the UPPER RIGHT. A bright, crisp highlight down the
right side of the glass and along the right of the rim; the left side darker.
The whiskey glows amber where the light passes through it. Small sharp
highlights on the cuts - no sparkle stars, no glow, no bloom, no lens flare.

STYLE: painterly, semi-realistic, hand-painted card-game art, crisp and
detailed. No outline stroke.

COMPOSITION: a SQUARE image, the glass centred, filling about 70% of the
width. Nothing cropped. No ice, no straw, no garnish, no text, no logo, no
watermark.
```

**Check before keeping one:** the rim must be a wide oval you can look down
into - if you can only see the glass's side and a thin line of rim, it is the
wrong camera, and it will not sit on the table. Then I add it to the art
script, ship it as a WebP and swap it in for the CSS glass (which stays as the
fallback while the image loads, like the court figures).

---

## Before you hand them over - a check per image

- [ ] Same face, suit, colours and hat as its master; nothing has moved that
      the edit prompt did not ask to move (flip between the master and the
      frame quickly - only the named part should jump).
- [ ] Light from the upper right; a rim light along the top/back edge.
- [ ] Transparent background (or the flat #7F7F7F), no floor shadow, no
      scenery, no text or watermark anywhere.
- [ ] Nothing cropped at the canvas edge (hat, shoe, chair foot, elbow).
- [ ] No weapon, no money, no resemblance to a real actor.
- [ ] Smoke on pure black, the wisps not touching each other.

Where they are now (PNG straight out of the generator - never resized or
compressed there; processing does that):

```
art-masters/characters/
  README.md      provenance, the pick for every frame and why, the alternates
  boss/          idle, blink, puff, exhale-1-high, exhale-2-mid, exhale-3-low,
                 salute-1-raise, salute-2-look   (+ alternates/)
  floorman/      idle, blink, glance, hattip     (+ alternates/)
  smoke/         smoke-1 (the wisps and plume used), smoke-2 (extra wisps)
```

`art-masters/` is outside the app on purpose: nothing there ships. I process
them into small WebP files under the app's `static/`, fetched at start like the
music bed and the court art (never imported - the build inlines imports into
`index.html`), so the game still runs if they fail to load.

---

## How I will wire them (so the art is made for the right job)

**Breathing (both).** As built: the whole figure scaled a fraction of a
percent (0.3% wide, 0.6% tall) from where his weight rests - the Floorman's
feet, the Boss's seat - on a slow 5-second cycle, the two out of step. At that
size the chair's stretch is under a pixel, so the masked two-layer split first
planned here was not needed. The Floorman's lean is the same body rotated
2.4 degrees from the ankles.

**Which image plays when.** Frames are swapped with a dissolve of about 100 ms;
because each is locked to its master, only the moving part dissolves.

| Moment | Boss | Floorman |
|---|---|---|
| Always | `idle` breathing; a wisp from the ember every few seconds | `idle` breathing |
| Every 4-8 s | `blink` for ~150 ms | `blink` for ~150 ms |
| Now and then, between rounds only | - | `glance` for ~1 s |
| At the deal, on HALF the rounds whose last card will be held (the owner's call, 2026-10-23) | the lift, `low` -> `mid` -> `high` -> `puff`, 0.7 s after the deal - and he KEEPS puffing, a small breath of smoke every 1.5 s, through the hold to the turn | - |
| Last card goes out to be squeezed (the hold) | the raise: `exhale-3-low` -> `exhale-2-mid` -> `exhale-1-high` -> `puff`, ~120 ms each (the exhale frames played backwards ARE the lift); holds `puff` through the hum, the ember warming | the upper body tilts ~4 degrees toward the table over the hum's climb (motion, not a frame) |
| The card turns, WHATEVER it shows | `exhale-1-high` with the plume leaving his mouth -> `exhale-2-mid` -> `exhale-3-low` -> `idle`, ~700 ms | straightens |
| A takeover closes - SOMETIMES, more often the rarer the win (`reactionTo`: Classic Big 21% anyone, Huge 43%, Mega 76%, Epic and Max ~always, Max always both) | `salute-1-raise` -> `salute-2-look`, held ~2 s, back the same way - when it is the Boss, or 0.7 s after the Floorman when both | `hattip` (`hattip-mid` if reshot) |
| Reduced motion | `idle`, still | `idle`, still |

The alternates are not used.

**Lining the frames up.** The Boss's frames were whole-image redraws, so each
is locked to the master: the master everywhere, the frame only where it
really changed (the arm, the face), through a feathered mask. A swap then
moves only the part that should move.

**Smoke (Boss): painted sprites, moved by CSS.** Not smoke drawn in CSS:
CSS smoke is blurred gradients, which reads as the generic look Stake's
rating guidance names, sits beside a painted man like a different artist,
and animating a blur repaints every frame. The painted wisps from
`smoke-1.png` (brightness turned into transparency) are animated by
`transform` and `opacity` only, which the browser hands to the compositor -
next to free. The cigar sheds one at a time from the ember: rising, drifting
a little left, widening and fading over 4-6 seconds, never more than two at
once. The exhale is the painted plume leaving his mouth, swelling and
thinning. The ember is mine to draw (a small dot that warms during the
puff), not the painting's.

**Blinks and fidgets.** A blink every 4-8 seconds at random, a frame swap of
about 150 ms. The Floorman's glance now and then between rounds, never during
one.

**The puff - "a big win is possibly coming".** The game already knows that
moment honestly: the last card is HELD (the hum, the squeeze) only on a round
with an Equal pick that reaches the last card alive, and the tunnel vignette
comes only when that card could land Huge or bigger (`lastCardHolds`,
`lastCardTunnels`). Both are decided from what was bet and what the player
can already see - three cards face up - never from the result. So the Boss
PUFFS as the card goes out to be squeezed and the ember warms through the
hum's climb, and EXHALES when the card turns, whatever it shows; the Floorman
LEANS IN on the same beat and straightens when it turns. Tying either of them
to "this round will win" before the cards show it would be an early tell, and
a player would learn to read the Boss instead of the cards.

**After the turn**, reacting to the result is fair: the Floorman's hat tip and
the Boss's salute only after a full game win has been shown, under the win
takeover's veil or as it closes.

**Where they go.** In the room, behind the table and the whole board, never
over a card, a chip readout or the bar, and never catching a click. At the 16:9
sizes (Desktop to Popout L) the table leaves a strip of room about 13% of the
width on each side, top to bar - mocked at 1200x675 on 2026-10-22 with heads
matched in size: the Floorman fills the left strip head to shoe, in front of
the wall chart; the Boss sits at the right edge with the far side of his
chair running off-screen.

**The Boss is BEHIND the table, never in front of it** (the owner's call,
2026-10-22). Beside the table at the bar's height, the table's right edge
- nearly vertical from about a third to two thirds of the way down - hid his
resting cigar hand. He sits further back, in the room's top-right corner,
and **never cut off by the screen edge** (the owner, 2026-10-22).

With the cigar in his NEAR hand (the first set), the whole figure has to sit
right of the chip stacks, so the largest Boss that is fully on screen with a
visible cigar is 220-240 px - smaller than the 250 px the owner already called
"a bit small". So **the cigar moves to his FAR hand** (the reshoot below):
then his table-side half can sit behind the table's far rim and the chips,
and he is **about 300 px tall, right edge 8 px inside the screen**, top about
22 px down, the near arm and the front corner of the chair hidden by the
table - which is what sitting behind a table looks like - and the cigar at
the end of the far chair arm, in clear view, its smoke rising past the red
leather against the dark wall. Mocked as `otherhand-300`.

The **Floorman** stands at the left edge, his solid outline 12 px in. The
**bar cart** (`props/barcart.png`) is 190 px tall at the bottom right, 8 px
inside the edge, its left end behind the table rim.

Passed on: the Boss beside the table at bar height (the table edge hid the
cigar); 310 px with a third of the chair off the right edge (the owner: not
cut off); 250 px whole in the corner ("a bit small"); 280 px (cigar among the
chips); 330 px (face at the screen edge); 220-240 px whole with the near-hand
cigar (smaller still, hat at the top edge); moving the chip stacks (unneeded
once the cigar changed hands).

**Still open:** phones (portrait, no room at the sides) and Popout S (too
small to read) - my suggestion is to leave them out there.

**Reduced motion:** both stand still on their IDLE frames; no breathing, no
drifting smoke, no puff.

**Size budget.** Each frame ships as a trimmed WebP a few hundred pixels tall;
the whole set should land around 300-500 KB, fetched after the game is up, so
the first paint does not wait for it.
