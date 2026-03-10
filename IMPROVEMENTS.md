# Improvements Log

## Cycle 90 — Extract Hardcoded RGBA Colors to Semantic CSS Variables

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **RGB triplet tokens** — Added `--color-session-rgb`, `--color-weekly-rgb`, `--color-extra-rgb`, `--color-opus-rgb`, `--color-coffee-rgb`, `--color-warning-rgb`, `--color-danger-rgb` to both `:root` (Mocha) and `body.theme-light` (Latte) blocks. Enables `rgba(var(--color-X-rgb), alpha)` pattern for theme-safe alpha variants.
2. **Replaced 15 hardcoded rgba values** — Button borders/hovers (export-btn, coffee-btn, retry-btn), progress bar edge glows, sparkline drop-shadows, label text-shadows, timer halos, and resets-urgent text-shadow all now derive from CSS variables.
3. **Light theme correctness** — Latte RGB values match their Catppuccin Latte equivalents (e.g., blue `30, 102, 245` not Mocha `137, 180, 250`).

### Files Modified
- `src/renderer/styles.css` — Added 14 RGB triplet tokens (7 dark + 7 light), replaced 15 hardcoded rgba() calls

---

## Cycle 89 — Min-width Guards on Progress and Percentage

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Progress fill min-width** — Added `min-width: 1px` to `.progress-fill` and `.compact-fill` so 0.x% values still render a visible sliver.
2. **Percentage min-width** — Added `min-width: 32px` to `.usage-percentage` to prevent layout shift when value changes between 1-digit and 3-digit numbers.

### Files Modified
- `src/renderer/styles.css` — Added min-width to progress fills and percentage labels

---

## Cycle 88 — Fix Context Item Transition Easing

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Missing ease function** — Added `ease` to `.context-item` transition shorthand which was missing the timing function, causing abrupt linear transitions on hover.

### Files Modified
- `src/renderer/styles.css` — Added ease function to context-item transition

---

## Cycle 87 — Remove !important Overrides

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Proper specificity** — Replaced 6 `!important` declarations on `.pip.warning`, `.pip.danger`, `.pct-warning`, `.pct-danger`, `.timer-warning`, `.timer-danger` with properly-scoped selectors. Pip rules now use `.pip-row .pip.warning` to match parent specificity. Only `@media (prefers-reduced-motion)` retains `!important` (legitimate use).

### Files Modified
- `src/renderer/styles.css` — Removed `!important` from 6 rules, increased specificity on pip selectors

---

## Cycle 86 — will-change on Animated Elements

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Compositor hints** — Added `will-change: width` to `.progress-fill` and `.compact-fill`, `will-change: stroke-dashoffset` to `.timer-progress`. Promotes elements to compositor layers for smoother 300ms transitions.

### Files Modified
- `src/renderer/styles.css` — Added `will-change` to 3 selectors

---

## Cycle 85 — CSS Containment on Overlays

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Paint isolation** — Added `contain: layout style paint` to `.settings-overlay`, `.context-menu`, and `.help-overlay`. Isolates layout/paint recalculations when overlays toggle, preventing full-document reflow.

### Files Modified
- `src/renderer/styles.css` — Added `contain` to 3 overlay selectors

---

## Cycle 84 — Defensive Text Overflow

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Truncation protection** — Added `overflow: hidden; text-overflow: ellipsis` to `.usage-label`, `.timer-text`, and `.resets-at-text`. Prevents layout breakage from unexpected API data or locale-specific time formatting at the 530px constraint.
2. **Removed stray `font-family: inherit`** from `.timer-text` (redundant after font reset).

### Files Modified
- `src/renderer/styles.css` — Added overflow/text-overflow to 3 selectors, removed redundant font-family

---

## Cycle 83 — Font Inheritance Reset

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Global font reset** — Added `button, input, textarea, select { font: inherit; }` to the CSS reset section. Removed 16 redundant `font-family: var(--font-mono)` declarations across button, input, and label selectors that now inherit from `body`.

### Files Modified
- `src/renderer/styles.css` — Added font inherit reset, removed 16 redundant font-family declarations

---

## Cycle 82 — Session Key Input Placeholder Styling

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Themed placeholder** — Session key input now shows `sk-ant-sid01-...` placeholder in `--text-faint` at 60% opacity, consistent with the Catppuccin palette instead of browser default gray.

### Files Modified
- `src/renderer/styles.css` — Added `::placeholder` rule for `.session-key-input-row input`

---

## Cycle 81 — Sparkline Container Underglow

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **SVG drop-shadow underglow** — Sparkline SVGs now have a subtle colored `drop-shadow` (session=mauve, weekly=blue at 15% opacity) reinforcing their color identity. Consistent with the existing timer halo pattern.

### Files Modified
- `src/renderer/styles.css` — Added `filter: drop-shadow()` to `.history-sparkline svg` with per-row color via `nth-child`

---

## Cycle 80 — Settings Panel Inset Depth

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Sunken control panel** — Settings rows container now has a subtle inset `box-shadow`, horizontal margin, and border-radius creating a recessed panel effect that visually separates controls from the header/footer chrome.

### Files Modified
- `src/renderer/styles.css` — Added margin, border-radius, inset box-shadow to `.settings-rows`

---

## Cycle 79 — Light Theme Color Fidelity

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Catppuccin Latte warning/danger colors** — Light theme now overrides `--color-warning` to `var(--ctp-yellow)` (#df8e1d) and `--color-danger` to `var(--ctp-red)` (#d20f39) instead of using hardcoded Tailwind colors. Also overrides all derived `-bg` and `-border` RGBA values to match Latte palette.

### Files Modified
- `src/renderer/styles.css` — Added warning/danger/bg/border overrides to `body.theme-light`

---

## Cycle 78 — Compact Separator Breathing Pulse

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Living polybar feel** — Compact mode powerline separators now pulse opacity between 0.3 and 0.6 on a 3s infinite cycle, giving the compact bar an ambient "alive" quality. Respects prefers-reduced-motion.

### Files Modified
- `src/renderer/styles.css` — Added `@keyframes sep-pulse`, applied to `.compact-sep`

---

## Cycle 77 — Resets At Urgency Glow

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Urgency color shift** — "Resets At" text turns amber with a soft warning text-shadow when the timer is under 30 minutes. Transitions smoothly via CSS transitions on color, opacity, and text-shadow. Makes the reset time column functional rather than purely informational.

### Files Modified
- `src/renderer/styles.css` — Added transition and `.resets-urgent` class with warning color + text-shadow
- `src/renderer/app.js` — Added `.resets-urgent` class toggle in `refreshTimers()` for both session and weekly

---

## Cycle 76 — Expand Arrow Scale Bounce

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Spring pop on expand** — Expand arrow now plays a `scale(1.4)` bounce animation using the spring cubic-bezier when toggled to expanded state. Combines rotation with scale for emphasis at the moment of interaction.

### Files Modified
- `src/renderer/styles.css` — Added `@keyframes arrow-pop`, applied to `.expand-arrow.expanded`

---

## Cycle 75 — Skeleton Shimmer Double-Wave + Stagger

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Double-peak shimmer** — Skeleton loading shimmer now uses a wider gradient with two highlight peaks for a scanning effect instead of a flat single sweep. Second skeleton row staggers 200ms behind the first for cascading motion.

### Files Modified
- `src/renderer/styles.css` — Updated `.skeleton-shimmer` gradient and width, updated `@keyframes shimmer`, added `nth-child(2)` delay

---

## Cycle 74 — Compact Bar Accent Glow

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Neon segment glow** — Compact mode bar fills now emit a colored `box-shadow` glow matching their accent color, creating the polybar "lit segment" effect. Session (mauve), weekly (blue), warning (amber), danger (red) all have per-variant glow colors.

### Files Modified
- `src/renderer/styles.css` — Added `box-shadow` to `.compact-fill` and all color variants

---

## Cycle 73 — CSS accent-color on Native Controls

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Themed native controls** — Added `accent-color: var(--accent)` to `.threshold-input` and `.opacity-slider`, tinting the native spinner buttons and slider track fill to match the Catppuccin accent color. One-line CSS addition per element, works in all Chromium-based browsers.

### Files Modified
- `src/renderer/styles.css` — Added `accent-color` to `.threshold-input` and `.opacity-slider`

---

## Cycle 72 — Expand Toggle Runway Indicator

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **CSS-only expanding runway** — Expand toggle now shows a thin horizontal accent line that grows from center to 60% width on hover via `::before` pseudo-element. Provides visual affordance that the section expands, replacing the bare chevron.

### Files Modified
- `src/renderer/styles.css` — Added `position: relative` to `.expand-toggle`, added `::before` with width transition

---

## Cycle 71 — Login Icon Breathing Glow

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Ambient breathing animation** — Login step icon SVG now pulses with a soft accent-colored `drop-shadow` glow on a 3s infinite cycle. Makes the login screen feel alive and inviting. Respects `prefers-reduced-motion` via existing global animation override.

### Files Modified
- `src/renderer/styles.css` — Added `@keyframes login-breathe` and applied to `.step-icon svg`

---

## Cycle 70 — Error State Shake Animation

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Error icon shake** — Error state SVG icon now shakes horizontally (±3px) for 400ms with a 150ms delay (after fade-in completes). Universally understood "something went wrong" cue. One-shot animation, no infinite loop.

### Files Modified
- `src/renderer/styles.css` — Added `@keyframes error-shake` and applied to `.error-content svg`

---

## Cycle 69 — Toggle Switch Spring Bounce

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Physical snap feeling** — Settings toggle switch knob now uses `cubic-bezier(0.34, 1.56, 0.64, 1)` for the transform transition, creating an overshoot "spring bounce" effect on toggle. One CSS value change.

### Files Modified
- `src/renderer/styles.css` — Changed `.toggle-slider::before` transition timing function

---

## Cycle 68 — Letter-Spacing Breathing on Percentage Update

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Typography micro-animation** — When percentage values update, `letter-spacing` briefly widens from 0 to 0.5px then eases back over 300ms, creating a subtle "breathing" expansion on the digits during value changes.

### Files Modified
- `src/renderer/styles.css` — Added `letter-spacing` transition and `.pct-updating` class
- `src/renderer/app.js` — Added `pct-updating` class toggle in `animateValue()`

---

## Cycle 67 — Context Menu Staggered Item Entrance

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Cascading item slide-in** — Context menu items now stagger in with 20ms delays using `nth-child` selectors and the existing `row-enter` keyframe. First item appears instantly, subsequent items cascade in over ~120ms total.

### Files Modified
- `src/renderer/styles.css` — Added `animation: row-enter` to `.context-item` with `nth-child` delay rules

---

## Cycle 66 — Usage Label Text-Shadow from Accent Border

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Color bleed effect** — Usage labels now have a faint colored text-shadow (6px spread, 20% opacity) matching their row's accent border color. Creates the illusion that the i3-style left border is casting light onto the label text. Per-variant rules for session (mauve), weekly (blue), extra (green), opus (peach).

### Files Modified
- `src/renderer/styles.css` — Added `text-shadow` to `.usage-label` with variant overrides for `.weekly`, `.extra`, `.opus`

---

## Cycle 65 — Timer Circle Danger Halo

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **SVG drop-shadow halo** — Timer circle SVGs now emit a colored glow halo when in warning (amber, 2px spread) or danger (red, 3px spread) states using `filter: drop-shadow()`. Makes critical countdowns visible in peripheral vision.

### Files Modified
- `src/renderer/styles.css` — Added `filter: drop-shadow()` to `.timer-progress.warning` and `.timer-progress.danger`

---

## Cycle 64 — Progress Bar Leading-Edge Glow

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Active fill edge** — Progress bar fills now have an `inset -2px 0 4px` box-shadow at 40% opacity of their accent color on the right (leading) edge, suggesting the bar is actively filling. Per-variant shadows for session (mauve), weekly (blue), extra (green), opus (peach).

### Files Modified
- `src/renderer/styles.css` — Added `box-shadow` to `.progress-fill` and all color variants

---

## Cycle 63 — Data Readout in Fetch Flash

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Real data readout** — Fetch flash now has 50% chance of showing actual usage data with Unicode block pips instead of a fake command: `S:67% [███▁▁] W:23% [█▁▁▁▁]`. Uses U+2588 (full block) for filled pips and U+2581 (lower one eighth) for empty pips, creating an instant mini-dashboard that flashes for 600ms.
2. **Mixed mode** — The other 50% still shows randomized terminal commands for variety. Both modes use the same flash timing and fade transition.

### Files Modified
- `src/renderer/app.js` — Updated `showFetchFlash()` to conditionally render live usage data with Unicode block characters

---

## Cycle 62 — Vim j/k Focus Ring Navigation

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Keyboard row navigation** — `j`/`k` keys move a visible focus indicator between usage rows (including expanded extra rows). Focus ring uses `box-shadow: inset 2px 0 0 var(--accent)` to match i3's focused container border pattern. Focus hides on any mouse movement.
2. **Enter to pin tooltip** — Pressing Enter on a focused row pins its micro-popover tooltip visible (toggles `.tooltip-pinned` class). Pressing Enter again unpins it.
3. **c to copy** — Pressing `c` while a row is focused copies its percentage value to clipboard with brief "copied" feedback.
4. **Help overlay updated** — Added `j / k` (Navigate rows) and `Enter` (Pin row tooltip) to keyboard shortcuts guide.

### Files Modified
- `src/renderer/app.js` — Added `navigateFocus()`, `clearKbdFocus()`, `getFocusableElements()`, keyboard handlers for j/k/Enter/c
- `src/renderer/styles.css` — Added `.kbd-focus` and `.tooltip-pinned` styles
- `src/renderer/index.html` — Added j/k and Enter to help overlay

---

## Cycle 61 — Data Integrity Hash Display

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **4-char hex hash** — Displays a truncated SHA-256 hash of current usage data (`#a3f1`) in the status indicator area. Styled at 8px, 40% opacity — barely visible until data actually changes.
2. **Change flash** — When data refreshes and the hash changes, the hash text briefly flashes accent color at full opacity for 600ms, then fades back. Provides ambient awareness of "data actually changed" vs "data was re-fetched but identical."
3. **Minimal footprint** — Uses `crypto.subtle.digest` (async, native, fast for ~50 byte input). Occupies ~30px horizontal.

### Files Modified
- `src/renderer/index.html` — Added `#dataHash` span in status indicator
- `src/renderer/styles.css` — Added `.data-hash` and `.hash-changed` styles
- `src/renderer/app.js` — Added `computeDataHash()`, hash comparison in `updateUI()`

---

## Cycle 60 — Backdrop Filter Frosted Glass

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Frosted glass on overlays** — Applied `backdrop-filter: blur(12px) saturate(180%)` to context menu, micro-popover tooltip, and settings overlay. Uses reduced-alpha backgrounds (`--glass-bg`, `--glass-bg-heavy`) so the desktop wallpaper bleeds through the blur. Stacks with the existing Electron-level acrylic/vibrancy for layered depth.
2. **Theme-aware glass variables** — Added `--glass-bg` and `--glass-bg-heavy` CSS custom properties to both dark (Mocha) and light (Latte) themes, ensuring frosted glass works correctly in both color schemes. Dark uses mantle-based RGBA; light uses Latte base-based RGBA.
3. **Cross-platform prefix** — Added both `backdrop-filter` and `-webkit-backdrop-filter` for maximum Electron compatibility.

### Files Modified
- `src/renderer/styles.css` — Added glass vars to `:root` and `body.theme-light`, applied backdrop-filter to `.context-menu`, `.settings-overlay`, `[data-tooltip]::after`

---

## Cycle 59 — Stale Data Visual Decay

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Progressive desaturation on stale data** — When data age exceeds 2x the effective refresh interval, the content area desaturates to 50% with 90% brightness (`data-stale`). At 3x, it drops to 20% saturation and 80% brightness (`data-very-stale`). Creates a visual "decay" that communicates data freshness at a glance without requiring text parsing.
2. **Smooth recovery** — The filter transition uses `2s ease`, so when fresh data arrives the content smoothly rehydrates back to full color — a satisfying visual confirmation.
3. **Calibrated thresholds** — Uses 2x/3x refresh interval multiplier to avoid false positives during normal refresh cycles.

### Files Modified
- `src/renderer/styles.css` — Added `.content` transition, `.data-stale` and `.data-very-stale` filter rules
- `src/renderer/app.js` — Added staleness calculation and class toggling in `updateStatusText()`

---

## Cycle 58 — Inset Shadow Depth on Progress Bar Tracks

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Recessed track effect** — Added `box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.25), inset 0 -1px 0 rgba(255, 255, 255, 0.04)` to `.progress-bar` creating a subtle sunken channel. The top shadow makes the track appear recessed into the surface; the bottom highlight fakes a beveled edge. Invisible at normal viewing but satisfying at zoom — consistent with the existing gradient fills.
2. **Compact bars** — Applied lighter `inset 0 1px 1px rgba(0, 0, 0, 0.2)` to `.compact-bar` (3px tall, needs more subtle shadow).

### Files Modified
- `src/renderer/styles.css` — Added inset box-shadow to `.progress-bar` and `.compact-bar`

---

## Cycle 57 — OpenType Font Features & Subpixel Polish

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **OpenType font features** — Enabled `font-feature-settings: "zero", "ss01", "cv01"` on body for slashed zeros, stylistic alternates, and character variants. JetBrains Mono and Fira Code both support these features, with silent fallback for fonts that don't.
2. **Slashed zero in numeric displays** — Updated all 6 `font-variant-numeric` declarations from `tabular-nums` to `tabular-nums slashed-zero` so zeros are visually distinct from the letter O at the widget's tiny 9-11px font sizes.
3. **Subpixel rendering** — Added `-webkit-font-smoothing: antialiased` and `text-rendering: optimizeLegibility` to body for crisper glyph edges.

### Files Modified
- `src/renderer/styles.css` — Added font-feature-settings, font-smoothing, text-rendering to body; updated all font-variant-numeric declarations

---

## Cycle 56 — Fetch Terminal Flash on Refresh

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Terminal command flash** — On successful data refresh, a randomized terminal-style command briefly flashes at the bottom of the widget (e.g., `$ curl -s claude.ai/usage | jq .`, `$ cat /sys/class/claude/usage`). Appears for 600ms with a 150ms fade transition. Pure r/unixporn theater — makes the GUI widget feel like it's secretly a terminal.
2. **6 command variants** — Rotates through curl, fetch, rg, cat, systemctl, journalctl themed commands for visual variety.

### Files Modified
- `src/renderer/index.html` — Added `.fetch-flash` div inside widget-container
- `src/renderer/styles.css` — Added `.fetch-flash` absolute positioning, opacity transition
- `src/renderer/app.js` — Added `showFetchFlash()` with randomized command array, called after successful `fetchUsageData()`

---

## Cycle 55 — Workspace-Style Usage Pips in Title Bar

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **i3/sway workspace pips** — Replaced 40x2px mini bars with 5 rectangular pips (4x8px each) per metric in the title bar. Each pip represents a 20% quintile. Filled pips use the metric's accent color; the "active" pip (containing the current value) gets a subtle `box-shadow` glow — exactly matching the workspace indicator pattern from tiling WMs.
2. **Warning/danger pip colors** — When thresholds are crossed, all filled pips switch to amber (warning) or red (danger) to match progress bar behavior.
3. **Compact mode hiding** — Pips hidden in compact mode, same as old mini bars.

### Files Modified
- `src/renderer/index.html` — Replaced `.title-bars` with `.title-pips` containing `#sessionPips` and `#weeklyPips` pip rows
- `src/renderer/styles.css` — Replaced `.title-bar-track/.title-bar-fill` CSS with `.title-pips/.pip-row/.pip` with filled/active/warning/danger states
- `src/renderer/app.js` — Added `updatePipRow()` function, replaced `titleSessionBar`/`titleWeeklyBar` updates with pip logic

---

## Cycle 54 — Staggered Row Entrance Animation

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Cascading slide-in on first data load** — Usage rows slide in from left with a staggered 50ms delay per row when the main content is first shown. Uses `translateX(-8px)` → `translateX(0)` with `cubic-bezier(0.16, 1, 0.3, 1)` (Material Design 3 emphasized decelerate) over 200ms. Column headers animate in sync. Only fires once per session — not on every refresh.
2. **Respects reduced motion** — Already covered by the existing `prefers-reduced-motion` media query that blanket-disables animations.

### Files Modified
- `src/renderer/styles.css` — Added `@keyframes row-enter`, `.usage-section.entrance`, `.usage-headers.entrance` with staggered delays
- `src/renderer/app.js` — Added `hasPlayedEntrance` guard and class toggling in `showMainContent()`

---

## Cycle 53 — Hover Micro-Popover with ETA & Velocity

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **CSS-only micro-popover** — Replaced native `title` tooltips on progress bars with styled `::after` pseudo-element popovers on `.usage-section` rows. Uses `content: attr(data-tooltip)` with `white-space: pre` for multi-line display. Appears below the row on hover with 100ms fade-in transition.
2. **ETA to warning/danger thresholds** — Popover now shows: exact percentage (1 decimal), velocity in %/hr, estimated time to warning threshold (`warn ~2h15m`), and estimated time to danger threshold (`crit ~45m`). ETAs only shown when rate is positive and ETA is under 24h.
3. **Velocity-aware formatting** — Rates below 0.1%/hr shown as "stable" instead of noisy near-zero numbers. Positive rates prefixed with `+`.

### Files Modified
- `src/renderer/styles.css` — Added `position: relative` to `.usage-section`, added `[data-tooltip]::after` and `:hover::after` rules
- `src/renderer/app.js` — Rewrote `updateVelocityTooltips()` with `buildTooltip()`, `fmtEta()`, sets `dataset.tooltip` on `.usage-section` rows

---

## Cycle 52 — Gradient Progress Fills

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Vertical gradient on progress fills** — All progress fill bars (session, weekly, extra, opus, warning, danger) now use a vertical gradient: 15% lighter at top → base color at bottom via `color-mix(in srgb, ..., white 15%)`. Adds subtle depth reminiscent of htop/btop bar rendering. Uses CSS `color-mix()` (supported in Chromium 111+, Electron 28 has Chromium 120).
2. **Consistent across all states** — The gradient pattern is applied uniformly to all progress-fill variants including warning and danger states.

### Files Modified
- `src/renderer/styles.css` — Updated all `.progress-fill` background rules to use `linear-gradient` with `color-mix`

---

## Cycle 51 — Border Pulse on Data Refresh

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Refresh heartbeat** — Title bar border pulses from `--accent-dim` to `--accent-strong` for 400ms when fresh data arrives. Provides subtle visual confirmation of successful refresh. The 0.4s ease transition creates a smooth fade-back.
2. **Title bar transition** — Added `transition: border-bottom-color 0.4s ease` to `.title-bar` base styles.

### Files Modified
- `src/renderer/app.js` — Added `data-fresh` class toggle with 400ms timeout after successful fetch
- `src/renderer/styles.css` — Added `.title-bar.data-fresh` border color, added transition to `.title-bar`

---

## Cycle 49 — Click-to-Copy Usage Percentage + Title Bar Fill Transition

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Click-to-copy** — Clicking a usage percentage value copies it to clipboard with brief "copied" feedback (600ms). Cursor changes to pointer on percentage elements.
2. **Title bar fill background transition** — Added `background var(--transition-data)` to `.title-bar-fill` so warning/danger color changes animate smoothly.

### Files Modified
- `src/renderer/app.js` — Added click-to-copy event listeners on `.usage-percentage` elements
- `src/renderer/styles.css` — Added background transition to `.title-bar-fill`

---

## Cycle 48 — Compact Mode Warning/Danger Percentage Colors

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Color-coded compact percentages** — Compact mode session and weekly percentage text now turns amber (warning) or red (danger) when thresholds are crossed, matching the bar fill color behavior. Previously only the fills changed color; the percentage text stayed its accent/blue color.

### Files Modified
- `src/renderer/app.js` — Added `pct-warning`/`pct-danger` class toggling on compact percentage elements in `updateCompactView()`

---

## Cycle 47 — Export Shortcut + Arrow Timing

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Ctrl+E export shortcut** — The Ctrl+E keyboard shortcut was listed in the context menu and help overlay but never actually wired up. Added the handler in the keydown listener to trigger the export button click.
2. **Arrow rotation timing** — Expand arrow rotation now uses `transform 200ms ease` instead of `all 120ms` to match the 200ms expand section slide animation. Color still uses the fast 120ms.

### Files Modified
- `src/renderer/app.js` — Added Ctrl+E handler in keydown listener
- `src/renderer/styles.css` — Split `.expand-arrow` transition into separate color and transform durations

---

## Cycle 46 — Expand Section Slide Animation

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Smooth slide animation** — Expand section now uses `max-height` + `overflow: hidden` with 200ms ease transition instead of hard `display: block/none`. Section slides open/closed smoothly with padding-top also transitioning.
2. **Class-based toggle** — Replaced `style.display = 'block'/'none'` with `.open` class toggle across all three JS locations (init restore, click toggle, buildExtraRows empty state).

### Files Modified
- `src/renderer/styles.css` — Rewrote `.expand-section` with max-height 0, added `.expand-section.open` with max-height 300px
- `src/renderer/app.js` — Changed all expandSection display toggles to classList.toggle/add/remove('open')

---

## Cycle 45 — Context Menu Visual Refinement

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Accent left border** — Context menu now has a 2px accent-colored left border, matching the pattern used on usage rows, help overlay, and settings title.
2. **Softer shadow** — Reduced box-shadow from `0 4px 12px rgba(0,0,0,0.3)` to `0 2px 8px rgba(0,0,0,0.2)` for a more subtle depth effect.
3. **Fade-in animation** — Context menu now uses the existing `fade-in` keyframe for a smooth 100ms appear.
4. **Hover indent** — Hovered items get 2px extra left padding (`10px→12px`) creating a subtle shift that indicates focus.
5. **Wider menu** — Increased min-width from 150px to 180px to accommodate keyboard shortcut hints.

### Files Modified
- `src/renderer/styles.css` — Updated `.context-menu` border/shadow/animation, added hover padding-left

---

## Cycle 44 — Dead CSS Cleanup

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Removed dead CSS** — Cleaned up three unused CSS rules: `.compact-divider` (never in HTML), `.footer` (never in HTML), `.last-update` (never in HTML). These were leftover from earlier layout iterations.

### Files Modified
- `src/renderer/styles.css` — Removed `.compact-divider`, `.footer`, `.last-update` rules

---

## Cycle 43 — Progress Fill Hover Brightness

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Progress fill glow on hover** — When hovering a usage row, the progress fill bar gets `filter: brightness(1.15)`, making it subtly brighter. Adds a focused/active indicator to complement the row background highlight.

### Files Modified
- `src/renderer/styles.css` — Added `.usage-section:hover .progress-fill` with brightness filter

---

## Cycle 42 — Help Overlay Polish

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Accent left border on help panel** — Help overlay content now has a 3px accent-colored left border, matching the settings title indicator pattern and visually connecting it to the accent color system.
2. **Missing shortcut** — Added Ctrl+E (Export history CSV) to the help overlay keyboard shortcuts list.

### Files Modified
- `src/renderer/index.html` — Added Ctrl+E help row
- `src/renderer/styles.css` — Added `border-left: 3px solid var(--accent)` to `.help-content`

---

## Cycle 41 — Title Bar Warning States + Tooltip

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Warning/danger colors on title mini bars** — Title bar session and weekly mini fills now turn warning amber or danger red when their respective thresholds are crossed, matching the main progress bars.
2. **Tooltip on title bars** — Hovering the mini bar area shows "Session: X.X% · Weekly: X.X%" for exact values.

### Files Modified
- `src/renderer/styles.css` — Added `.title-bar-fill.warning` and `.title-bar-fill.danger` color rules
- `src/renderer/app.js` — Added classList.toggle for warning/danger on title fills, added tooltip on titleBars element

---

## Cycle 40 — Compact Mode Layout Fix

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Hide title mini bars in compact mode** — The 40px-wide mini usage bars are hidden in compact mode (`display: none`) since the compact row already shows S/W percentages.
2. **Compact status indicator fix** — Re-added `margin-left: auto` to `.status-indicator` in compact mode to maintain proper right-alignment when the title mini bars are hidden.

### Files Modified
- `src/renderer/styles.css` — Added `body.compact .title-bars { display: none }` and `body.compact .status-indicator { margin-left: auto }`

---

## Cycle 39 — Version Indicator in Settings

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Version display** — Settings footer now shows the app version (e.g., "v1.4.0") from package.json, right-aligned in faint 8px text. Aids debugging and is a standard element in riced status bars.
2. **Preload API** — Added `appVersion` property to the electron API bridge, reading directly from `package.json`.

### Files Modified
- `src/renderer/index.html` — Added `.version-text` span in settings footer
- `src/renderer/styles.css` — Added `.version-text` styles (8px, 50% opacity, right-aligned)
- `src/renderer/app.js` — Set version text in `init()`
- `preload.js` — Added `appVersion` property

---

## Cycle 38 — Title Bar Mini Usage Bars

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Inline title bars** — Two 40x2px mini progress bars in the title bar area showing session (accent color) and weekly (blue) utilization at a glance. Positioned between the title text and status ring, they provide instant visual summary without taking focus.
2. **Always-updated** — The title bars update on every `updateUI()` call regardless of compact/expanded mode, so they stay current.
3. **Layout adjustment** — Removed `margin-left: auto` from `.status-indicator` since `.title-bars` now provides the push-right behavior.

### Files Modified
- `src/renderer/index.html` — Added `.title-bars` div with two `.title-bar-track` + `.title-bar-fill` elements
- `src/renderer/styles.css` — Added title-bars, title-bar-track, and title-bar-fill styles
- `src/renderer/app.js` — Added title mini bar width updates in `updateUI()`

---

## Cycle 37 — Usage Row Hover Highlight

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Row hover effect** — Usage rows now get a subtle `--border-subtle` background highlight on hover with a 120ms transition. Matches the i3/sway focused-window highlight pattern.
2. **Smooth transition** — Added `transition: background var(--transition-fast)` to `.usage-section` for smooth in/out.

### Files Modified
- `src/renderer/styles.css` — Added `.usage-section:hover` background and transition to `.usage-section`

---

## Cycle 36 — Text Selection + Timer Text Refinement

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Accent-colored text selection** — `::selection` pseudo-element now uses `--accent-medium` background with `--text-primary` color. Consistent with the accent color system.
2. **Concise timer text** — "Not started" → "—idle—" and "Resetting..." → "reset…" for a more terminal-like, concise aesthetic.

### Files Modified
- `src/renderer/styles.css` — Added `::selection` rule
- `src/renderer/app.js` — Updated idle and resetting timer text strings

---

## Cycle 35 — Timer Text Warning/Danger Colors

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Color-coded timer text** — The "Resets In" countdown text now changes color to match the timer circle when elapsed time crosses warning (75%) or danger (90%) thresholds. Previously only the SVG circle changed color while the text stayed white.
2. **CSS classes** — Added `.timer-warning` (amber) and `.timer-danger` (red) classes with `!important` to override default text color.

### Files Modified
- `src/renderer/app.js` — Added `timer-warning`/`timer-danger` class toggling on `textElement` in `updateTimer()`
- `src/renderer/styles.css` — Added `.timer-warning` and `.timer-danger` color rules

---

## Cycle 34 — Reduced Motion Accessibility

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **`prefers-reduced-motion` media query** — When the OS has "reduce motion" enabled, all CSS animations and transitions are effectively disabled (duration set to 0.01ms, iteration count 1). This covers: shimmer skeleton, pulse-ring status, sparkline pulsing dot, CRT scanline (no animation, just static), fade-in transitions, and all interactive hover transitions.

### Files Modified
- `src/renderer/styles.css` — Added `@media (prefers-reduced-motion: reduce)` block at end of file

---

## Cycle 33 — Column Header Refinement

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Header separator line** — Added a 1px `--border-subtle` bottom border to `.usage-headers`, creating a clear visual separation between column labels and data rows. Increased bottom padding and margin for breathing room.
2. **Reduced header weight** — Decreased font-size from 8px to 7px, increased letter-spacing to 0.8px, added 70% opacity. Headers are now more background-level, letting data rows take visual priority.

### Files Modified
- `src/renderer/styles.css` — Updated `.usage-headers` padding/margin/border, refined `.col-header` font-size/spacing/opacity

---

## Cycle 32 — Sparkline Warning Threshold Line

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Warning threshold reference line** — Sparklines now show a dashed horizontal line at the warning threshold (default 75%) when it falls within the data range. Uses `--color-warning` color at 40% opacity with 3,3 dash pattern. Provides visual context for how close usage is to threshold limits.
2. **Dynamic color resolution** — Reads `--color-warning` via `getComputedStyle` since SVG attributes don't support CSS custom properties directly.

### Files Modified
- `src/renderer/app.js` — Added warning threshold line SVG element to `createSparklineSVG()`

---

## Cycle 31 — Sparkline Pulsing Live Dot

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Pulsing current-value dot** — The last data point on each sparkline now gently pulses (opacity 1→0.5, radius 2→3px) on a 2s infinite cycle, indicating live data. Adds subtle life to the expanded data visualization.
2. **CSS class on SVG circle** — Added `sparkline-dot` class to the final circle element in `createSparklineSVG()`.

### Files Modified
- `src/renderer/app.js` — Added `class="sparkline-dot"` to sparkline current-value circle
- `src/renderer/styles.css` — Added `sparkline-pulse` keyframe and `.sparkline-dot` animation

---

## Cycle 30 — Settings Panel Visual Polish

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Accent-colored header border** — Settings header now has a 2px `--accent-dim` bottom border matching the main title bar's accent stripe style.
2. **Slide-in animation** — Settings overlay fades in with a subtle 4px upward slide (150ms ease), matching the fade-in pattern used elsewhere.
3. **Title accent indicator** — Settings title now has a 2px accent-colored vertical bar before the text via `::before` pseudo-element, linking it to the accent color system.

### Files Modified
- `src/renderer/styles.css` — Added `settings-slide-in` keyframe, updated `.settings-header` border, added `.settings-title::before` accent bar

---

## Cycle 29 — Colored Compact Mode Percentages

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Color-coded compact percentages** — Session percentage in compact mode now uses `--color-session` (accent/mauve) and weekly uses `--color-weekly` (blue) instead of plain white text. Adds visual distinction at a glance.
2. **Label opacity** — Compact labels (S, W) now have 0.8 opacity for slightly softer text.

### Files Modified
- `src/renderer/styles.css` — Changed `.compact-pct` color to `--color-session`, added `#compactWeeklyPct` override, adjusted `.compact-label` opacity

---

## Cycle 28 — Context Menu Keyboard Shortcut Hints

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Shortcut hints in context menu** — Each context menu item now shows its keyboard shortcut right-aligned in faint text (Ctrl+R, Ctrl+M, Ctrl+T, Ctrl+,, Ctrl+E). Improves discoverability of keyboard shortcuts.
2. **Flex layout for context items** — `.context-item` is now `display: flex; justify-content: space-between` to position label and shortcut text.
3. **State indicator fix** — Updated JS selector to target `> span:first-child` when updating compact/click-through checkmarks, so the shortcut span isn't overwritten.

### Files Modified
- `src/renderer/index.html` — Wrapped context menu labels in spans, added `.ctx-shortcut` spans with shortcut text
- `src/renderer/styles.css` — Added flex layout to `.context-item`, added `.ctx-shortcut` styles
- `src/renderer/app.js` — Fixed compact/clickthrough state indicator selectors

---

## Cycle 27 — Progress Bar Tick Marks

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Quarter tick marks** — Progress bars now show subtle 1px vertical lines at 25%, 50%, and 75% via a `::after` pseudo-element with `repeating-linear-gradient`. Uses `--border-medium` color for minimal visual weight. The tick marks sit on top (z-index: 1) of the fill but behind interactions (pointer-events: none).
2. **Positioned container** — Added `position: relative` to `.progress-bar` to anchor the pseudo-element.

### Files Modified
- `src/renderer/styles.css` — Added `position: relative` and `::after` pseudo-element to `.progress-bar`

---

## Cycle 26 — Sparkline Gradient Area Fill

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **SVG gradient fill** — Replaced flat `fill-opacity: 0.1` on sparkline area with a proper `linearGradient` that fades from 25% opacity at top to 0% at bottom. Much more polished data-viz look at small sizes.
2. **Unique gradient IDs** — Each sparkline SVG gets a unique gradient ID via random suffix to avoid conflicts when multiple sparklines are on screen.

### Files Modified
- `src/renderer/app.js` — Added `<defs>` with `<linearGradient>` to `createSparklineSVG()`, changed area fill from flat color to `url(#gradId)`

---

## Cycle 25 — Status Dot → Micro Countdown Ring

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Micro countdown ring** — Replaced the 5px status dot with a 12x12 SVG ring (r=4.5) that fills as the refresh interval elapses. At 0% elapsed the ring is empty; at 100% it's full and about to refresh. Merges three signals (status color, refresh countdown, last-updated) into one cohesive element.
2. **Ring states** — Idle: green stroke filling over time. Refreshing: warning color with pulse animation. Error: danger color.
3. **1s linear transition** — Ring progress updates every second via `updateStatusText()`, with `stroke-dashoffset` transition set to `1s linear` for smooth animation between ticks.

### Files Modified
- `src/renderer/index.html` — Replaced `status-dot` span with `status-ring` SVG (12x12, two circles)
- `src/renderer/styles.css` — Replaced `.status-dot` styles with `.status-ring` / `.status-ring-bg` / `.status-ring-progress`, renamed `pulse-dot` to `pulse-ring`
- `src/renderer/app.js` — Updated elements refs (`statusRing`, `statusRingProgress`), updated `setStatus()` to use ring class, added ring progress calculation in `updateStatusText()`

---

## Cycle 24 — i3-Style Left Accent Borders on Usage Rows

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Left accent borders** — Each usage row now has a 2px left border colored by its type: session (mauve), weekly (blue), extra (green), opus (peach). Matches the i3/sway window indicator pattern for instant visual hierarchy.
2. **Dynamic row color inheritance** — Dynamically-created extra rows in `buildExtraRows()` now include the `colorClass` on the row element itself, so the left border picks up the correct color.
3. **Header alignment** — Adjusted `.usage-headers` left padding from 10px to 12px to align with the 2px border offset on usage rows.

### Files Modified
- `src/renderer/styles.css` — Added `border-left: 2px solid` to `.usage-section`, added `.usage-section.weekly/.extra/.opus` color overrides, adjusted header padding
- `src/renderer/index.html` — Added `weekly` class to the weekly usage-section div
- `src/renderer/app.js` — Added `colorClass` to dynamically created row's className

---

## Cycle 23 — Powerline Segment Separators in Compact Mode

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Powerline-style separators** — Replaced pipe `|` text separators in compact mode with CSS-drawn angled triangles using `clip-path: polygon(0 0, 100% 50%, 0 100%)`. The separators are 6x16px with `--border-medium` color at 50% opacity, matching the polybar/tmux powerline aesthetic.
2. **Empty span content** — Removed text content from `.compact-sep` spans since the visual is now pure CSS.

### Files Modified
- `src/renderer/styles.css` — Rewrote `.compact-sep` with clip-path triangle, inline-block display
- `src/renderer/index.html` — Cleared pipe text from all 4 compact-sep spans

---

## Cycle 22 — Session Persistence + Startup State Restoration

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Expand state persistence** — The expanded/collapsed state of the details section is now saved to electron-store and restored on app launch. Toggling the expand arrow calls `saveSettings({ expanded: isExpanded })`.
2. **Partial save guards** — All fields in the `save-settings` IPC handler now check `!== undefined` before writing to electron-store. This prevents partial saves (e.g., saving only `expanded`) from overwriting other settings with `undefined`.
3. **Settings roundtrip** — `get-settings` now includes the `expanded` field. `init()` reads it and restores the expand state before first render.

### Files Modified
- `main.js` — Added `expanded` to get-settings, guarded all save-settings fields with `!== undefined`
- `src/renderer/app.js` — Restore expand state in `init()`, save expand state on toggle

---

## Cycle 21 — Visual Polish + SVG Icon Fix

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Settings SVG sizing** — Removed leftover `font-size: 14px` from `.settings-btn` (emoji artifact). Added `.settings-btn svg` with explicit 13x13px dimensions for the gear icon.
2. **Smooth percentage color transition** — `.usage-percentage` now transitions color smoothly when entering/leaving warning/danger states.

### Files Modified
- `src/renderer/styles.css` — Fixed settings-btn SVG size, added percentage color transition

---

## Cycle 20 — Context Menu States + Live Compact Timer

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Context menu state indicators** — Right-click menu now shows checkmarks (\u2713) next to "Compact Mode" and "Click-Through" when those modes are active. Updated dynamically each time the menu is opened.
2. **Live compact timer** — Compact mode countdown timer now ticks every second (previously only updated on data refresh). The `startCountdown` interval now calls `updateCompactView()` when in compact mode, keeping the `M:SS` timer display live.
3. **Countdown routing** — `startCountdown` interval now branches: compact mode calls `updateCompactView()`, normal mode calls `refreshTimers()`/`refreshExtraTimers()`.

### Files Modified
- `src/renderer/app.js` — Context menu state checkmarks, compact timer in `startCountdown`, branched countdown logic

---

## Cycle 19 — Color-Coded Percentages + CRT Scanlines

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Color-coded percentages** — Usage percentage text turns yellow at warning threshold and red at danger threshold, matching the progress bar state. Uses `.pct-warning` and `.pct-danger` CSS classes applied alongside bar classes.
2. **CRT scanline overlay** — Subtle horizontal scanline effect via `::before` pseudo-element on `.widget-container`. Repeating gradient with 2% opacity every 4px. Pointer-events: none so it doesn't block interaction. Adds vintage terminal/CRT aesthetic to the rice.
3. **Widget container positioning** — Added `position: relative` to `.widget-container` for the scanline pseudo-element overlay.

### Files Modified
- `src/renderer/styles.css` — CRT scanline overlay, `.pct-warning`/`.pct-danger` classes, position: relative on container
- `src/renderer/app.js` — `updateProgressBar` now applies `pct-warning`/`pct-danger` to percentage elements

---

## Cycle 18 — Custom CSS Injection

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Custom CSS textarea** — Settings panel includes a monospace textarea where users can paste custom CSS overrides. Applied live via a dynamic `<style>` element. Persisted to electron-store.
2. **CSS injection safety** — Uses a dedicated `<style id="user-custom-css">` element, injected via `textContent` (not innerHTML), so no XSS risk. CSS is applied both on settings save and on app startup.
3. **Settings panel height** — Increased from 348px to 395px for the new row.

### Files Modified
- `main.js` — Added `customCSS` to settings get/save
- `src/renderer/index.html` — Added Custom CSS textarea row in settings
- `src/renderer/styles.css` — `.custom-css-input` and `.settings-row-vertical` styles
- `src/renderer/app.js` — `customStyleEl`, `applyCustomCSS()`, custom CSS in loadSettings/saveSettings/init

---

## Cycle 17 — Keyboard Help Overlay

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Keyboard help overlay** — Press `?` to toggle a centered overlay showing all available keyboard shortcuts. Shows keybinds in accent-colored badges with descriptions. Escape closes it (Escape priority: help → settings → minimize).
2. **Help grid layout** — Two-column grid with `help-key` (accent background badge) and `help-desc` (description text). Matches Catppuccin theme.
3. **Discoverable shortcuts** — Lists Ctrl+R (refresh), Ctrl+M (compact), Ctrl+T (click-through), Ctrl+, (settings), Esc (close), ? (help).

### Files Modified
- `src/renderer/index.html` — Added help overlay markup with keybind grid
- `src/renderer/styles.css` — Help overlay styles (backdrop, content box, key badges, grid)
- `src/renderer/app.js` — `?` keybind handler, Escape priority chain update, `helpOverlay` element

---

## Cycle 16 — Title Bar Accent Stripe + Mode Badge

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Accent stripe** — Title bar border-bottom changed from 1px subtle to 2px accent-dim, creating a subtle colored bar that reflects the chosen accent color. Common rice widget pattern.
2. **Mode badge** — Small text badge in the title bar that shows active modes (e.g., "passthrough" when click-through is enabled). Updates dynamically via `updateModeBadge()`. Styled in 8px uppercase accent color.
3. **Code cleanup** — Removed attempted trailing glow on progress bars (clipped by `overflow: hidden`), keeping the flat aesthetic intentional.

### Files Modified
- `src/renderer/index.html` — Added `#modeBadge` span in title bar
- `src/renderer/styles.css` — Title bar accent stripe (2px border-bottom), `.mode-badge` styles
- `src/renderer/app.js` — Added `updateModeBadge()`, `modeBadge` element, called on click-through toggle

---

## Cycle 15 — Usage Velocity + Dynamic Window Title

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Usage velocity tooltips** — Progress bar tooltips now show consumption rate (e.g., "+2.3%/hr" or "stable"). Calculated from the last 30 minutes of usage history snapshots. Shows sign-prefixed rate or "stable" for <0.1%/hr change.
2. **`calculateVelocity()`** — Async function that reads usage history, filters to last 30min, computes delta/hours for both session and weekly metrics.
3. **Dynamic window title** — Document title updates every second with live usage: `S:45% W:12% — Claude Usage`. Shows in taskbar hover and window switcher.

### Files Modified
- `src/renderer/app.js` — Added `calculateVelocity()`, `updateVelocityTooltips()`, dynamic `document.title` in `updateStatusText()`

---

## Cycle 14 — Auto-Hide on Inactivity

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Auto-hide** — Widget fades to 15% opacity after 10 seconds of mouse inactivity (mouse leaves widget area). Instantly reappears on mouse re-enter. Uses `mousemove`, `mouseenter`, `mouseleave` events with a timeout-based approach. Doesn't auto-hide while settings overlay is open.
2. **Smooth opacity transitions** — Base widget-container has `transition: opacity 0.3s ease` for both show (fast) and hide (0.3s). Also transitions `border-color` for focus glow.

### Files Modified
- `src/renderer/styles.css` — Auto-hidden state (15% opacity), transition on widget-container
- `src/renderer/app.js` — `AUTO_HIDE_DELAY`, `autoHideTimeout`, `isAutoHidden`, `resetAutoHide()`, `startAutoHide()`, mouse event listeners

---

## Cycle 13 — Accent Color Picker

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Accent color picker** — Settings row with 10 Catppuccin color dots: Mauve, Blue, Sapphire, Teal, Green, Yellow, Peach, Red, Pink, Lavender. Clicking updates `--accent`, `--accent-dim`, `--accent-medium`, `--accent-strong`, and `--color-session` CSS variables live. Accent selection persisted via electron-store and restored on startup.
2. **Dynamic alpha calculation** — `applyAccent()` parses the hex color to RGB and generates proper rgba() values for dim/medium/strong accent variants, ensuring correct transparency at any accent color.
3. **Settings panel height** — Increased from 320px to 348px to accommodate the accent row.

### Files Modified
- `main.js` — Added `accent` to settings get/save persistence
- `src/renderer/index.html` — Added accent selector row with 10 color dots
- `src/renderer/styles.css` — Added `.accent-selector`, `.accent-dot` styles with Catppuccin color backgrounds
- `src/renderer/app.js` — Added `applyAccent()`, accent dot event listeners, accent in loadSettings/saveSettings/init, settings height 320→348

---

## Cycle 12 — Window Vibrancy + Dynamic Tray Icon + Focus Glow

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Window vibrancy/blur** — Acrylic material on Windows 11 via `setBackgroundMaterial('acrylic')`, vibrancy on macOS via `setVibrancy('under-window')`. Background CSS updated to semi-transparent (85% dark, 88% light) to let blur show through. Graceful fallback on unsupported platforms.
2. **Dynamic tray icon** — System tray icon changes color based on highest usage level: green (#a6e3a1) for normal, yellow (#f59e0b) for warning, red (#ef4444) for danger. Generated as SVG→base64 data URL via `nativeImage.createFromDataURL`. Updates on every fetch alongside tooltip.
3. **Focus glow** — Widget border subtly changes to accent color when it has keyboard focus via `:focus-within` on `.widget-container`.

### Files Modified
- `main.js` — Added `nativeImage` import, `createTrayIcon()` SVG generator, `set-click-through` handler, `update-tray-icon` handler, acrylic/vibrancy setup in `createMainWindow`
- `preload.js` — Exposed `updateTrayIcon`
- `src/renderer/styles.css` — Semi-transparent backgrounds for blur, focus-within glow, click-through state
- `src/renderer/app.js` — `updateTrayTooltip` now also updates tray icon color

---

## Cycle 11 — Animated Counters + Click-Through + Polybar Compact

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Animated number counters** — Usage percentages smoothly count up/down when values change using `requestAnimationFrame` with ease-out-quad easing over 300ms. Uses `WeakMap` to track previous values per element. Skips animation for changes <0.5%.
2. **Click-through mode** — Ctrl/Cmd+T or context menu toggles mouse pass-through (`setIgnoreMouseEvents`). Widget becomes a pure HUD overlay — clicks pass to windows underneath. Visual indicator: 60% opacity + dashed accent border. `{ forward: true }` enables hover detection while ignoring clicks.
3. **Polybar-style compact mode** — Compact mode now uses pipe separators (`|`) between segments for a polybar/i3status aesthetic. Added session reset countdown timer segment showing `M:SS` in compact bar. Layout: `| S [bar] 45% | W [bar] 12% | 2:34 |`

### Files Modified
- `main.js` — Added `set-click-through` IPC handler using `setIgnoreMouseEvents`
- `preload.js` — Exposed `setClickThrough`
- `src/renderer/index.html` — Polybar-style compact with pipe separators and timer segment; click-through context menu item
- `src/renderer/styles.css` — Click-through visual state, compact separator/timer styles
- `src/renderer/app.js` — `animateValue()` with RAF + easing, `prevValues` WeakMap, click-through toggle (Ctrl+T + context menu), compact timer countdown, `compactTimer` element

---

## Cycle 10 — Full Aesthetic Overhaul (Catppuccin Rice)

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **CSS custom properties** — Extracted all colors, borders, fonts, radii, and transitions into CSS variables. ~60 semantic tokens in `:root` with full Catppuccin Latte overrides in `body.theme-light`. Zero hardcoded colors in component rules.
2. **Catppuccin Mocha/Latte palette** — Dark theme uses Mocha (base #1e1e2e, text #cdd6f4, accent mauve #cba6f7). Light theme uses Latte (base #eff1f5, text #4c4f69, accent mauve #8839ef). Warning/danger colors kept at full saturation for WCAG compliance.
3. **Monospace typography** — Switched from system serif/sans-serif to `JetBrains Mono, Fira Code, Cascadia Code, SF Mono, Consolas, Monaco, monospace`. All buttons and inputs use the mono stack.
4. **Flattened visual chrome** — Removed all gradients (backgrounds, progress fills, buttons). Removed all box-shadows from progress bars. Reduced border-radius from 6-10px to 3px globally. Solid flat colors everywhere.
5. **Faster transitions** — Interactive elements (buttons, hover states) use 120ms. Data transitions (progress bars, timer circles) stay at 300ms. Fade-in animation shortened to 150ms.
6. **SVG settings icon** — Replaced emoji ⚙️ with feather-icons gear SVG (14x14, stroke-based). Inherits `currentColor` for theme compatibility.
7. **JS sparkline colors from CSS** — `updateHistoryChart()` now reads `--color-session` and `--color-weekly` from `getComputedStyle` instead of hardcoded hex values. Sparklines adapt to both themes automatically.
8. **Tighter spacing** — Title bar reduced from 36px to 32px height. Padding reduced throughout. Control buttons from 28px to 26px. Toggle switches from 34x18 to 32x16. Settings footer/rows tightened.
9. **Light theme simplification** — Eliminated 25+ `body.theme-light` component overrides. Light theme now works entirely via CSS variable reassignment in one block.

### Files Modified
- `src/renderer/styles.css` — Complete rewrite: CSS variables, Catppuccin palette, flat styling, monospace, reduced chrome
- `src/renderer/index.html` — Replaced emoji gear with SVG settings icon
- `src/renderer/app.js` — Sparkline colors read from CSS custom properties via getComputedStyle

---

## Cycle 2 — Keyboard Shortcuts + Error State + Micro-interactions

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Keyboard shortcuts** — Ctrl/Cmd+R to refresh, Escape to close settings, Ctrl/Cmd+, to toggle settings
2. **Error state with retry** — Shows error container with retry button when API fails and no cached data exists. If cached data exists, keeps showing stale data with red status dot.
3. **Smooth CSS transitions** — Fade-in with subtle translateY for state changes (login/no-usage/error/content)
4. **Progress bar tooltips** — Hover over progress bar to see exact percentage (e.g., "72.3% used")

### Files Modified
- `src/renderer/index.html` — Added error state container with retry button
- `src/renderer/styles.css` — Added error state styles, fade-in animation, light theme error styles
- `src/renderer/app.js` — Added keyboard shortcuts, error handling with retry, showError function, progress tooltips

## Cycle 9 — Context Menu + Smart Refresh

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Right-click context menu** — Custom dropdown on title bar right-click with: Refresh, Compact Mode, Settings, Export History, Minimize to Tray, Exit. Positioned to stay within viewport bounds. Full dark + light theme styles.
2. **Smart refresh** — When session or weekly usage exceeds 80%, auto-refresh switches to 1-minute intervals (vs configured interval). Reverts to normal when usage drops below threshold. Uses recursive setTimeout instead of setInterval for dynamic interval adjustment.
3. **Status countdown** — Reflects the effective refresh interval (smart or configured) in the countdown display.

### Files Modified
- `src/renderer/index.html` — Added context menu markup with action items
- `src/renderer/styles.css` — Added context menu styles (dark + light), danger hover for exit
- `src/renderer/app.js` — Added context menu handlers, getEffectiveRefreshInterval, changed setInterval to recursive setTimeout, updated status text countdown

---

## Cycle 8 — Refresh Interval + Data Export

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Configurable refresh interval** — Button selector in settings: 1m, 2m, 5m (default), 10m, 15m. Persisted via electron-store. Auto-update restarts when changed. Countdown in status text reflects the configured interval.
2. **Export usage history** — "Export" button in settings footer opens native save dialog and writes CSV (Timestamp, Session %, Weekly %). Button shows "Exported!" feedback on success. Uses Electron `dialog.showSaveDialog`.
3. **Settings panel height** — Increased to 320px to accommodate refresh interval row.

### Files Modified
- `main.js` — Added `dialog`/`fs` imports, `export-usage-history` IPC handler, `refreshInterval` in settings
- `preload.js` — Exposed `exportUsageHistory`
- `src/renderer/index.html` — Added interval selector row, export button with download icon
- `src/renderer/styles.css` — Added interval selector + export button styles (dark + light)
- `src/renderer/app.js` — Changed UPDATE_INTERVAL to variable, added interval button handlers, export handler, settings load/save for interval

---

## Cycle 7 — Window Snap + Bounds Safety

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Snap to edges** — Widget snaps to screen work-area edges (left, right, top, bottom) when dragged within 20px. Uses debounced move handler (150ms) with isSnapping flag to prevent event loops.
2. **Bounds check on startup** — Validates saved window position against all connected displays. If the window is off-screen (monitor disconnected, resolution changed), recenters on primary display.
3. **Screen module** — Added Electron `screen` import for display-aware positioning.

### Files Modified
- `main.js` — Added `screen` import, `ensureOnScreen` function, snap-to-edge logic in move handler with debounce/flag protection

---

## Cycle 6 — Skeleton Loading + Accessibility

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Skeleton loading screen** — Two animated shimmer bars with "Connecting to Claude.ai..." text replace the spinner on first load. Matches the layout of actual content.
2. **ARIA labels** — Added `aria-label` to all title bar buttons (settings, refresh, minimize, close). Added `role="progressbar"` with `aria-valuenow/min/max` to session and weekly progress bars. Added `aria-live="polite"` to percentage displays and status indicator.
3. **Focus management** — Replaced global `outline: none` with `*:focus-visible` purple ring (2px solid #8b5cf6). Mouse clicks use `:focus:not(:focus-visible)` to hide outlines. Keyboard users get visible focus indicators.
4. **Role attributes** — Added `role="status"` and `aria-live="polite"` to status indicator. Progress bars dynamically update `aria-valuenow`.
5. **Keyboard shortcut hints** — Button titles now show shortcuts (e.g., "Refresh (Ctrl+R)").

### Files Modified
- `src/renderer/index.html` — Skeleton loading markup, ARIA attributes on buttons/bars/status
- `src/renderer/styles.css` — Skeleton styles with shimmer animation, focus-visible ring, removed blanket outline:none
- `src/renderer/app.js` — ARIA progressbar value updates in updateProgressBar

---

## Cycle 5 — Widget Opacity + Tray Usage Info

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Widget opacity slider** — Range slider in settings (30-100%) with live preview. Applied on startup. Persisted via electron-store.
2. **Tray tooltip with usage** — System tray hover shows "Claude Usage - Session: X% | Weekly: Y%", updated after each fetch.
3. **Auto-refresh countdown** — Status text shows "Xm ago . M:SS" with per-second countdown to next refresh. Tooltip shows exact last-updated time.
4. **Settings panel height** — Increased from 260px to 290px to accommodate opacity row.

### Files Modified
- `main.js` — Added `set-opacity` + `update-tray-tooltip` IPC handlers, opacity in settings persistence + startup restore
- `preload.js` — Exposed `setOpacity` and `updateTrayTooltip`
- `src/renderer/index.html` — Added opacity slider row in settings
- `src/renderer/styles.css` — Added opacity slider styles (dark + light themes)
- `src/renderer/app.js` — Added opacity live control, tray tooltip update, refresh countdown in status text (1s interval)

---

## Cycle 4 — Usage History Sparklines

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Usage history storage** — Saves session + weekly utilization snapshots every 5 min via electron-store, rolling 24h window (~288 max entries)
2. **Sparkline visualization** — Inline SVG sparklines (polyline + area fill + trailing dot) in the expandable section, rendered using safe DOM methods (createElementNS)
3. **Trend indicator** — Up/down/flat arrow next to each sparkline based on last 6 data points
4. **Expand section resize** — Widget height accounts for history chart rows when expanded

### Files Modified
- `main.js` — Added `save-usage-snapshot` and `get-usage-history` IPC handlers
- `preload.js` — Exposed `saveUsageSnapshot` and `getUsageHistory`
- `src/renderer/index.html` — Added history chart section in expandable area
- `src/renderer/styles.css` — Added sparkline, trend indicator, and history chart styles (dark + light)
- `src/renderer/app.js` — Added createSparklineSVG (safe DOM), calculateTrend, setTrendIndicator, saveUsageSnapshot, updateHistoryChart; integrated with fetch and expand handlers

---

## Cycle 3 — Compact Mode

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Compact mode toggle** — Double-click title bar or Ctrl/Cmd+M to toggle compact mode
2. **Compact layout** — Single row with "S" (session) and "W" (weekly) mini progress bars and percentages
3. **Compact window size** — 530x56px (down from 530x155px), 64% smaller footprint
4. **Setting persistence** — Compact preference saved to electron-store, restored on app launch
5. **Warning/danger colors** — Compact bars change color at thresholds just like normal mode
6. **Light theme support** — Full light theme styles for compact mode

### Files Modified
- `main.js` — Added `compact` to settings persistence
- `src/renderer/index.html` — Added compact content section with session/weekly bars
- `src/renderer/styles.css` — Added compact mode styles, title bar shrink, light theme variants
- `src/renderer/app.js` — Added toggleCompactMode, updateCompactView, dblclick handler, Ctrl+M shortcut, init restoration

---

## Cycle 1 — Status Indicator + Notification Alerts

**Status:** Complete
**Timestamp:** 2026-03-07

### Changes
1. **Status indicator in title bar** — Green/yellow/red dot with "Updated Xm ago" text. Tooltip shows exact timestamp. Auto-updates every 30s.
2. **Desktop notification alerts** — Fires when usage crosses warning/danger thresholds (session + weekly). Only notifies on upward transitions (normal->warning, warning->danger). Clicking notification focuses the widget.
3. **Notifications toggle in Settings** — Enable/disable threshold notifications, persisted via electron-store.
4. **Refresh status feedback** — Dot pulses yellow during refresh, turns red on error, green on success.

### Files Modified
- `main.js` — Added `Notification` import, `show-notification` IPC handler, notifications setting persistence
- `preload.js` — Exposed `showNotification` to renderer
- `src/renderer/index.html` — Added status indicator in title bar, notifications toggle in settings
- `src/renderer/styles.css` — Added status indicator styles (dark + light themes), pulse animation
- `src/renderer/app.js` — Added status tracking, threshold notification logic, settings integration
