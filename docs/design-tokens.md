# Mytheus Mobile — Design Tokens

The single source of truth is code: `src/theme/tokens.ts` (color, radius,
spacing, shadow, gradient) and `src/theme/typography.ts` (type). This document
mirrors those files for designers and reviewers. If they disagree, the code
wins — update both in the same PR.

The language is warm, editorial, and calm: cream surfaces, terracotta accent,
serif display over a grotesk UI face, soft depth instead of borders. It is
deliberately aligned with the Claude.ai visual language and shared with
`mytheus-ui`.

## Color

### Surfaces

| Token | Hex | Use |
| :-- | :-- | :-- |
| `bgOuter` | `#DCD9CE` | Outermost letterboxing (rarely visible) |
| `bgApp` | `#F0EEE6` | App background — the cream everything sits on |
| `surface` | `#FFFFFF` | Cards, list rows, popovers |
| `surfaceAlt` | `#FAF9F4` | Tab bar, secondary surfaces |
| `navBorder` | `#EAE7DE` | Hairline borders on nav/chips |
| `tabTrack` | `#E7E3D9` | Segmented-control tracks |

### Ink (text)

| Token | Hex | Use |
| :-- | :-- | :-- |
| `ink` | `#1F1E1D` | Headings, primary text |
| `inkDeep` | `#28221C` | Display headings on warm gradients |
| `body` | `#33302C` | Body copy |
| `bodySoft` | `#3A352F` | Transcript/body on white |

### Muted greys (warm)

| Token | Hex | Use |
| :-- | :-- | :-- |
| `muted` | `#A8A096` | Secondary captions |
| `mutedAlt` | `#ABA398` | Timestamps, metadata |
| `mutedLabel` | `#A39A8E` | ALL-CAPS section labels |
| `mutedIcon` | `#BBAFA3` | Inactive icons, chevrons |
| `mutedDeep` | `#998F84` | Stronger secondary text |
| `mutedTime` | `#8A847B` | Clock/elapsed captions |

### Warm browns (text on peach gradients)

| Token | Hex |
| :-- | :-- |
| `warmText` | `#8C6F5D` |
| `warmText2` | `#6F5D54` |
| `warmText3` | `#5A4A40` |
| `warmText4` | `#7A6356` |
| `warmLabelOnPeach` | `#A07D67` |

### Accent

| Token | Hex | Use |
| :-- | :-- | :-- |
| `accent` | `#D97757` | THE terracotta: brand squiggle, active states, record |
| `accentDeep` | `#C15F3C` | Pressed/emphatic accent, trend text |
| `green` | `#5F7355` | Decisions, "up to date", they-owe |
| `brown` | `#9A7B4F` | Key points |
| `brownDot` | `#B0875A` | Key-point timeline nodes |

### Chips (bg / text pairs)

| Chip | Background | Text |
| :-- | :-- | :-- |
| Orange (actions, AI) | `#F7E9E1` | `#C15F3C` |
| Green (decisions) | `#ECEFE5` | `#5F7355` |
| Brown (key points) | `#F4ECDF` | `#9A7B4F` |
| Neutral (meta) | `#F3EFE9` | `#7A6F64` |

### Components

| Token | Hex | Use |
| :-- | :-- | :-- |
| `dark` | `#262625` | Dark controls: record button, composer deck, CTA |
| `avatarBg` / `avatarText` | `#E4DDD2` / `#8A7D70` | The user's own avatar |
| `checkboxBorder` | `#D9D3C8` | Unchecked checkbox |
| Speakers P / M / D | `#C15F3C` / `#7A6A53` / `#B0875A` | Transcript avatars |

### Dark-surface overlays (on `dark`)

Used inside the composer deck and control bars: white at 10–12% for chips and
buttons, white at 50–75% for secondary text/icons, `rgba(217,119,87,0.38–0.45)`
for accent-tinted chips/active states.

## Gradients

157° top-left → bottom-right (`start {x:0.08,y:0}`, `end {x:0.92,y:1}`).

| Token | Stops |
| :-- | :-- |
| `hero` | `#E6B398 → #EAC4AC (27%) → #F0DBC9 (54%) → #F6EFE4` |
| `overview` | `#EAC4AC → #F0DBC9 (45%) → #F6EFE4` |

Hero cards may carry a **squiggle watermark**: the brand mark in
`rgba(255,255,255,0.28–0.34)`, ~280–320 wide, bleeding off the top-right
corner, rotated −9°.

## Typography

| Role | Family | Weights | Use |
| :-- | :-- | :-- | :-- |
| Sans (UI) | Hanken Grotesk | 400 / 500 / 600 / 700 / 800 | Everything interactive: body, labels, buttons |
| Serif (display) | Newsreader | 400 / 500 / 600 / 700 | Screen titles, hero headlines, stat values, quotes |
| Wordmark | Fraunces | 600 | The brand name ONLY — never for general headings |

Recurring type styles:

- Screen title: Newsreader 600, 26, tracking −0.4
- Hero headline: Newsreader 600, 26–28, tracking −0.3
- Hero stat value: Newsreader 600, 21–44 (scale to prominence)
- Section label: Hanken 800, 11.5, tracking +0.9, ALL CAPS, `mutedLabel`
- Card title: Hanken 700, 14–15.5, tracking −0.2
- Body: Hanken 500, 13–14, line-height ~1.45
- Caption/meta: Hanken 500–600, 11–12.5
- Wordmark: Fraunces 600, 32–40, tracking −0.6 to −0.8

## Radii

| Token | Value | Use |
| :-- | :-- | :-- |
| `hero` | 28 | Gradient hero cards |
| `card` | 22 | Cards, rows, popovers |
| `control` | 22 | Dark control bars, composer deck |
| `button` | 16 | Primary dark buttons |
| `tab` | 14 | Pills inside dark bars |
| `iconBtn` | 14 | 40×40 icon shells |
| `chip` | 999 | All pills/chips |
| `checkbox` | 7 | Checkboxes |

## Spacing

| Token | Value |
| :-- | :-- |
| `screenX` | 14 — horizontal screen margin for cards |
| `gutter` | 18 — text margin (labels align at 18) |

Rhythm: 22–26 between sections, 11–12 between sibling cards, 14–20 padding
inside cards.

## Shadows (iOS / `elevation` Android)

| Token | Color | Opacity | Radius | Y | Elev. | Use |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `card` | `#3C2D23` | 0.08 | 12 | 6 | 2 | White cards |
| `hero` | `#C18F6D` | 0.30 | 24 | 14 | 8 | Gradient heroes (warm glow) |
| `darkButton` | `#1E1C1A` | 0.20 | 14 | 8 | 5 | Dark CTAs |
| `control` | `#1E1C1A` | 0.22 | 18 | 10 | 6 | Control bars / deck |
| `iconBtn` | `#3C2D23` | 0.08 | 3 | 1 | 1 | Icon shells, chips |

## Motion

| Pattern | Spec |
| :-- | :-- |
| Section entrance (`Reveal`) | fade + rise 14→0, 520ms, ease-out-cubic, stagger siblings 90–110ms |
| Press feel (`Tappable`) | spring to scale 0.97 (buttons 0.88–0.96), opacity 0.92 |
| Brand draw-on (`BrandMark`) | stroke-dashoffset sweep, 1350–1600ms, ease-in-out-cubic |
| Cold-start intro | draw 1350ms → wordmark fade+rise 520ms @780ms → overlay out 380ms @2050ms |
| Tab pill | spring translate, speed 24 / bounciness 7; icon pops 0.82→1 |
| Count-up (`AnimatedCount`) | 700–900ms, stagger 90ms |
| Ring/bar fills | 620–900ms, ease-out-cubic, delay 150–250ms |
| Typewriter (Ask/live) | ~3 chars / 24–50ms tick; thinking pause ~1300ms |
| Reduced motion | all entrances snap to final state (`AccessibilityInfo`) |

## Brand

- **Mark**: the squiggle — a tangle unspooling into a clean line (traced as a
  single SVG stroke in `src/components/squiggle-path.ts`, viewBox 200×100,
  length ≈871, native stroke weight 6). Terracotta `accent` on cream.
- **Sparkle**: soft concave four-point star = "AI is working"; the squiggle is
  the *brand*, the sparkle is the *agent*.
- **Wordmark**: "Mytheus" in Fraunces 600.
- **App icon / splash**: mark centered on `#F0EEE6` (`assets/images/`).
- **Voice**: plain verbs, sentence case, first person for the agent
  ("I remember every meeting you've captured"), no exclamation marks.

## Rules

1. Never hex-code in a screen; import from `src/theme/tokens.ts`.
2. One gradient hero per screen, maximum.
3. Terracotta is for brand + action, green for decisions/settled, brown for
   knowledge; don't mix their meanings.
4. Depth comes from the shadow set, not borders (borders only on
   `surfaceAlt` nav and chips, in `navBorder`).
5. Fraunces is reserved for the wordmark.
6. Every new animation must respect reduced motion.
