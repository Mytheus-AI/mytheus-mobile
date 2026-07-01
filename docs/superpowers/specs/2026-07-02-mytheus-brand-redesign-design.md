# Mytheus brand integration + signature-moments redesign

Date: 2026-07-02
Status: approved (design), pending spec review

## Goal

Integrate the Mytheus logo (terracotta tangle-into-line squiggle on cream) as the
app's brand system, confirm the app name reads "Mytheus" everywhere, and elevate
the UI with Claude.ai-inspired signature moments — while keeping the existing
token system, palette, typography, layout, and navigation untouched.

Source logo: user-supplied PNG (square, terracotta `~#D97757` stroke on cream
`~#F0EEE6`), copied into the repo as the master asset.

## 1. Brand assets (static, from the PNG)

- Create `assets/` with:
  - `assets/images/logo-source.png` — master copy of the supplied PNG.
  - `assets/images/icon.png` — 1024×1024 iOS app icon: squiggle centered on
    solid cream `#F0EEE6`, sized with comfortable margins (~64% mark width).
  - `assets/images/adaptive-icon.png` — Android adaptive foreground: squiggle
    centered in the safe zone (~55% of canvas) on transparent background.
  - `assets/images/splash-icon.png` — splash mark on transparent background.
- Wire into `app.json`:
  - `expo.icon: "./assets/images/icon.png"`
  - `expo.android.adaptiveIcon: { foregroundImage, backgroundColor: "#F0EEE6" }`
  - splash plugin: `{ image: "./assets/images/splash-icon.png", imageWidth: 200, backgroundColor: "#F0EEE6" }`
- Processing is done with macOS-native tools (`sips`) or ImageMagick if
  available; transparency extraction keys out the cream background.
- Name audit: `app.json` already has `name: "Mytheus"`; verify no stale
  "Reprise" strings remain (grep shows none in app code today).

## 2. Living vector mark (in-app)

- New component `src/components/BrandMark.tsx`:
  - The squiggle recreated as a single hand-drawn SVG bezier stroke path
    (`react-native-svg`), round caps, terracotta `colors.accent` by default,
    parameterized `size` and `color`.
  - Optional `animated` prop: draws itself on via stroke-dasharray /
    stroke-dashoffset driven by Reanimated (~900ms, easing out).
  - Exact pixel fidelity to the PNG is NOT required; it is the same gesture
    (tangle unspooling into a clean line) as a living motif.
- The existing `Sparkle` icon is retained wherever it means "AI"
  (Meeting Pod badge, Ask tab). The squiggle is the *brand* mark.

## 3. Signature moments

1. **Brand intro overlay** (`src/components/BrandIntro.tsx`, mounted in
   `app/_layout.tsx`): after fonts load and the native splash hides, a cream
   overlay shows the squiggle drawing itself (~900ms) with "Mytheus" fading in
   beneath (Newsreader 600), then the overlay fades out (~350ms) revealing the
   app. Runs once per cold start (module-level flag; no persistence needed).
2. **Home header**: small static `BrandMark` beside the greeting line in
   `ScreenHeader`; title/avatar unchanged.
3. **Hero card** (`app/(tabs)/index.tsx`): large watermark squiggle bleeding
   off the top-right corner inside the gradient (ink stroke at ~8% opacity);
   record button gets spring press-scale; mic icon pulses subtly.
4. **Tab bar** (`CustomTabBar.tsx`): active chip becomes a sliding pill
   animated with a spring; focused icon scales in slightly.
5. **Ask empty state** (`app/(tabs)/ask.tsx`): drawn squiggle (animated
   BrandMark) replaces the current illustration/sparkle as the hero of the
   empty state.
6. **Unified press feel**: `Tappable` gains a consistent spring scale
   (~0.97) so every card press feels the same.

## 4. Out of scope / unchanged

- Design tokens, palette, fonts: unchanged (already the Claude language).
- Screen layouts, navigation structure, mock data, copy: unchanged except
  where noted above.
- No new dependencies: `react-native-svg`, `react-native-reanimated`,
  `expo-linear-gradient` are already installed.

## 5. Verification

- `pnpm typecheck` and `pnpm lint` must pass.
- Relaunch in the iOS simulator (dev server already running on port 8083) and
  screenshot: brand intro, home, ask, insights, tab bar states. Visually
  confirm each signature moment renders and animates.
- App icon/splash config verified via `npx expo config` output (icon fields
  resolve); full native icon verification requires a rebuild and is noted as
  a follow-up if the dev client doesn't show it.
