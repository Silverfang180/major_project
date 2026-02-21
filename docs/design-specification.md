# CHRONICLE — DESIGN SPECIFICATION
## Prompt Version Control System

---

## 1. VISUAL HIERARCHY BLUEPRINT

### ATTENTION FLOW (First 3 Seconds)

**PRIMARY DOMINANCE (0-1 second): Version Timeline**
- Occupies RIGHT 35% of screen (520px fixed width)
- Vertical, reverse-chronological (newest at top)
- Latest version has 4px electric blue left border with subtle glow
- Version counter sits at timeline top: "47 versions" in bold
- Eye is drawn RIGHT because:
  - Only saturated color on screen (blue)
  - Only area with visual "weight" (borders, shadows)
  - Counter triggers "I've accomplished something" dopamine hit

**SECONDARY DOMINANCE (1-2 seconds): Editor Panel**
- Occupies CENTER 50% (flexible, grows with window)
- Large textarea dominates vertical real estate
- "Create New Version" button floats at bottom-right with elevation shadow
- Button is ONLY interactive color (saturated blue)
- Panel is intentionally MUTED (grays, low saturation):
  - Editor is workspace, not destination
  - Timeline is the trophy case
  - Contrast directs attention to "commit" action

**TERTIARY ELEMENTS (2-3 seconds): Navigation & Metadata**
- Prompt sidebar: LEFT 15% (240px), compressed, gray-on-gray
- Prompt metadata: Above editor, monospace key badge, subdued colors
- Header: Thin top strip, health indicator only, no branding noise
- These elements SUPPORT but never COMPETE

### WHAT NEVER COMPETES FOR ATTENTION

**Always Subordinate:**
- Health indicator: 8px dot, top-right, no text, pulses only when offline
- Delete buttons: Hidden until hover, ghost buttons, no fill
- Timestamps: 11px gray text, right-aligned, italicized
- Model settings JSON: Code block style, dimmed, collapsed by default
- Empty states: Center-aligned, large font, but 40% opacity

**Why This Hierarchy Increases Perceived Intelligence:**

1. **Timeline dominance = progress visibility**
   - User sees history accumulate in real-time
   - Brain interprets visible memory as system sophistication
   - "It remembers" = "It's powerful"

2. **Editor restraint = focus signal**
   - Muted workspace reduces cognitive load
   - User isn't overwhelmed by competing visual elements
   - "It knows what matters" = "It's smart"

3. **Single accent color = clarity**
   - Blue only appears on important actions and achievements
   - Brain creates association: blue = progress
   - "Color has meaning" = "Design is intentional" = "Tool is professional"

4. **Spatial consistency = competence**
   - Layout never shifts between prompts
   - Timeline always in same location
   - "I know where things are" = "I'm in control" = "I'm competent"

The hierarchy creates a psychological loop:
- See timeline → feel accomplished → want to add more → see editor → take action → see timeline update → feel accomplished

---

## 2. PSYCHOLOGY-DRIVEN UI CHECKLIST

### COMPETENCE SIGNALS

□ **Primary action is reachable within 500ms of mouse movement**
  Why: Fitts's Law — shorter distance = higher perceived control
  Implementation: "Create New Version" button fixed bottom-right of editor panel

□ **Current location is identifiable in <2 seconds**
  Why: Cognitive load theory — orientation precedes action
  Implementation: Active prompt in sidebar has 3px left blue border + background tint

□ **Disabled states include REASON in tooltip**
  Why: Attribution theory — users blame interface vs. self-competence
  Implementation: Hover over disabled "Create" shows "Change note required"

□ **Every text input shows character count or validation status**
  Why: Progress monitoring increases perceived agency
  Implementation: Live validation with green checkmark or red error text <100ms

□ **Undo-like capability exists for mistakes**
  Why: Risk tolerance increases with safety nets
  Implementation: Deleted versions move to "Recently Deleted" (24hr TTL), restorable

### MOMENTUM SIGNALS

□ **Action feedback appears within 100ms**
  Why: Causality perception — delay breaks mental model of control
  Implementation: Button press shows instant state change (depressed, spinner, etc.)

□ **Completed actions show SUCCESS state for 2-3 seconds**
  Why: Variable reward timing (dopamine), progress visibility
  Implementation: Version card appears with green glow pulse, fades to normal

□ **Version counter increments with animated transition**
  Why: Gamification without gamification — progress made tangible
  Implementation: Number flips up with "+1" that floats and fades (800ms)

□ **Timeline shows visual "time since last change"**
  Why: Temporal landmarks create memory anchors, recency bias triggers action
  Implementation: "2 hours ago" vs "3 weeks ago" in different text weights

□ **Staggered animations on list load (50ms cascade)**
  Why: Perception of accumulation, building momentum
  Implementation: Version cards fade-in-up with 50ms delay per card

□ **"Last edited" indicator on active prompt in sidebar**
  Why: Zeigarnik effect — unfinished tasks create tension to return
  Implementation: Pulsing orange dot + "Edited 5m ago" if unsaved changes exist

### TRUST SIGNALS

□ **Destructive actions require 2-step confirmation**
  Why: Loss aversion — friction prevents regret
  Implementation: Delete button → modal with explicit consequences → red "Delete Forever" button

□ **Old versions have "sealed" visual treatment**
  Why: Mental model reinforcement of immutability
  Implementation: Lock icon, reduced opacity, no hover state, READ-ONLY cursor

□ **Version timeline is NEVER hidden or collapsible**
  Why: Transparency = trust, hidden features = suspicion
  Implementation: Timeline is fixed-width grid column, always visible

□ **Creating version feels HEAVIER than editing**
  Why: Commitment signaling — important actions should feel important
  Implementation: 350ms animation sequence with elevation + glow vs 150ms focus state

□ **Error messages explain WHAT happened and WHY**
  Why: Transparency prevents learned helplessness
  Implementation: "Version not created: Model settings contains invalid JSON at line 3"

□ **Health indicator shows backend connectivity**
  Why: System status visibility reduces uncertainty anxiety
  Implementation: Green pulse = online, red pulse = offline, gray = checking

### ANTI-PATTERNS (MUST AVOID)

□ **NO generic "Loading..." for >1 second without progress**
  Why: Uncertainty anxiety, perceived unresponsiveness
  Solution: Skeleton UI showing structure, or specific message "Loading 47 versions..."

□ **NO success toasts that auto-dismiss in <2 seconds**
  Why: Users miss confirmation, creates uncertainty
  Solution: 3-second minimum, or require manual dismiss

□ **NO animations longer than 400ms (except celebrations)**
  Why: Feels sluggish, users perceive as "slow"
  Solution: Keep base transitions at 250ms, celebrations at 600ms max

□ **NO icons without text labels for primary actions**
  Why: Cognitive load, ambiguity, accessibility
  Solution: All buttons have text, icons are supplementary

□ **NO color-only information distinction**
  Why: Colorblind accessibility, cognitive load
  Solution: Use color + icon + text (e.g., red + trash icon + "Delete")

□ **NO "phantom" deleted items that just vanish**
  Why: Breaks causality, creates uncertainty about success
  Solution: Collapse animation (400ms) + success toast

□ **NO arbitrary wait times (artificial delays)**
  Why: User time is sacred, delays feel manipulative
  Solution: Show actual async operations, no setTimeout delays

---

## 3. MICRO-INTERACTION SYSTEM

### CREATE PROMPT
**Trigger:** Click "+" icon button in sidebar header

**Sequence:**
1. **0ms:** Modal background fades in (200ms, ease-out)
   - Background: rgba(0,0,0,0.85)
   - Backdrop blur: 8px (signals context switch)

2. **50ms:** Modal content slides up 20px while fading in (200ms, decelerate easing)
   - Psychological: Emerging from below = creation metaphor

3. **250ms:** First input field auto-focuses
   - 3px blue focus ring appears (150ms, ease-in)
   - Placeholder text has cursor blink

4. **Validation (real-time):**
   - Invalid: Red underline + red text below (<100ms)
   - Valid: Green checkmark appears right of input (100ms)
   - Button state: Disabled (50% opacity) until all fields valid

5. **Submit click:**
   - Button shows 2px depression (100ms, active state)
   - Button content changes to spinner (20px, 300ms rotation)
   - Success: Checkmark replaces spinner (200ms, scale from 0.8)

6. **250ms after success:** Modal slides down + fades out (250ms, accelerate easing)

7. **Modal fully closed:** New prompt appears in sidebar
   - Slides in from left edge (300ms, decelerate)
   - Auto-scrolls to position (400ms, ease-in-out)
   - Brief blue glow around item (600ms pulse)

**Emotional Purpose:**
- Immediate focus = agency ("I can start immediately")
- Validation feedback = competence ("I'm doing it right")
- Success celebration = reward ("I accomplished something")
- Smooth transition = professionalism ("This tool is polished")

---

### CREATE NEW VERSION
**Trigger:** Click "Create New Version" button (bottom-right of editor)

**Validation Fail Sequence:**
1. **0ms:** Button shakes horizontally
   - 3 shakes, ±4px displacement, 60ms each (total 180ms)
   - Psychological: Physical rejection metaphor

2. **200ms:** Error text appears above button
   - Red text: "Change note required" or "Invalid JSON in model settings"
   - Fade in 150ms

**Success Sequence:**
1. **0ms:** Button shows 2px depression (100ms)
   - Box-shadow reduces, simulates press

2. **100ms:** Button content replaced with spinner
   - 16px spinner, 300ms per rotation
   - Button maintains size (no layout shift)

3. **Simultaneously:** Editor dims to 60% opacity
   - 200ms fade
   - Signals: "Processing your input"

4. **API responds:** Timeline scrolls to top (300ms, ease-in-out)

5. **New version card materializes:**
   - Initial state: 0 opacity, 0.8 scale, -20px Y position
   - Final state: 1 opacity, 1.0 scale, 0 Y position
   - Duration: 350ms, ease-out-back (slight overshoot)
   - 4px left border glows once: 0 → 1 → 0 opacity (600ms)

6. **Version counter updates:**
   - "+1" appears above counter, floats up 20px, fades out (800ms)
   - Counter number flips (150ms)

7. **Editor returns to normal:**
   - Opacity back to 100% (200ms)
   - Change note field clears with fade (150ms)
   - Success toast slides up from bottom-right (200ms)

8. **2 seconds later:** Success toast fades out (300ms)

**Emotional Purpose:**
- Shake rejection = clear failure signal, no ambiguity
- Button depression = tactile feedback, physical metaphor
- Dimming editor = "System is thinking", processing visibility
- Card appearance = celebration, "birth" of new version
- Counter animation = progress made tangible, dopamine hit
- Smooth transitions = professionalism, care in craft

**Why High Ceremony:**
- Creating a version is IMPORTANT (not casual)
- Animation sequence = ritual = importance
- Users remember and value what felt significant
- Contrast with lightweight editing reinforces hierarchy

---

### SELECT PROMPT
**Trigger:** Click prompt item in sidebar

**Sequence:**
1. **0ms:** Clicked item highlights INSTANTLY (<50ms)
   - Blue left border appears (3px)
   - Background tints (5% blue)
   - Psychological: Imperative feedback, tool is responsive

2. **50ms:** Previous selection fades to inactive state (150ms)
   - Border removes
   - Background returns to default

3. **150ms:** Main panel content (editor + timeline) fades out (200ms)
   - Opacity: 1 → 0
   - Prevents jarring content swap

4. **350ms:** Loading state appears
   - Skeleton UI (gray blocks matching layout)
   - NOT a spinner (spinner = unknown duration, skeleton = structure is known)
   - Psychological: Content IS coming, reduces anxiety

5. **API responds:** Content fades in with stagger
   - Prompt metadata: 250ms fade, from top
   - Editor textarea: 300ms fade + 10px up-slide, stagger +50ms
   - Timeline header: 350ms fade, stagger +100ms
   - Version cards: 350ms fade-up, 50ms cascade per card

6. **Complete:** All elements at full opacity
   - Focus moves to editor textarea (optional, based on user intent)

**Emotional Purpose:**
- Instant highlight = responsiveness, control
- Fade transition = spatial consistency (layout never jumps)
- Skeleton UI = "content exists, loading is progress not waiting"
- Staggered appearance = perception of building, not loading
- No layout shift = professionalism, stability

---

### VIEW HISTORY (Scrolling Timeline)

**Passive Indicators:**
1. **Version age visualization** (always present, no interaction)
   - Latest version: 4px border #2D9EE0 (electric blue), subtle glow
   - <24 hours: 4px border rgba(45,158,224,0.7)
   - <1 week: 4px border rgba(45,158,224,0.4)
   - <1 month: 4px border rgba(45,158,224,0.2)
   - Older: 4px border rgba(108,117,125,0.3) (gray)
   - Psychological: Color intensity = recency, immediate visual understanding

2. **Hover interaction:**
   - Card elevates 4px on Y-axis (150ms, standard easing)
   - Box-shadow increases: 0 4px 12px rgba(0,0,0,0.3) → 0 8px 16px rgba(0,0,0,0.4)
   - Small lock icon fades in at top-right corner (100ms)
   - Background lightens 3% (subtle)

3. **Cursor behavior:**
   - Version text: cursor = default (NOT text-select)
   - Psychological: Reinforces READ-ONLY nature
   - Delete button: cursor = pointer (only interactive element)

4. **Scroll shadows** (when content overflows):
   - Top edge: linear-gradient shadow when scrolled down
   - Bottom edge: linear-gradient shadow when scroll room remains
   - Fade in 150ms on scroll start
   - Psychological: Depth cue, "more content exists"

**Emotional Purpose:**
- Color fade = visual time machine, intuitive aging
- Lock icon on hover = immutability reinforcement, "these are sealed"
- Elevation = inspect mode, not edit mode
- Scroll shadows = content awareness, reduces "is there more?" anxiety

---

### DESTRUCTIVE ACTIONS (Delete Prompt or Version)

**Trigger:** Click delete button (trash icon, ghost style, hidden until hover)

**Sequence:**
1. **0ms:** Modal background fades in (200ms)
   - Overlay: rgba(0,0,0,0.85)
   - Backdrop blur: 8px

2. **50ms:** Modal slides up + fades in (200ms, decelerate)

3. **Modal content structure:**
   - Title: RED text, "Delete [Prompt/Version]"
   - Icon: Large red trash icon (48px)
   - Message: "This cannot be undone. Version history will be permanently deleted."
   - Buttons:
     - Cancel: LEFT position, larger touch target (140px), secondary style
     - Delete Forever: RIGHT position, smaller (120px), RED fill
   - Psychological: Cancel is easier to hit (Fitts's Law), prevents mistakes

4. **Cancel click:**
   - Modal slides down + fades out (250ms)
   - No other changes

5. **Confirm click:**
   - "Delete Forever" button depresses (100ms)
   - Button shows spinner (300ms)

6. **API responds (success):**
   - Modal fades out (200ms)
   
7. **Item removal animation:**
   - Item fades to 0 opacity (200ms)
   - Height collapses to 0 with margin collapse (400ms, ease-in)
   - Surrounding items slide to fill gap (300ms, ease-in-out)

8. **200ms after removal complete:** Success toast appears
   - Slides up from bottom-right (200ms)
   - Text: "Version deleted" or "Prompt and all versions deleted"
   - Duration: 3 seconds before auto-dismiss

**Emotional Purpose:**
- Red color = universal danger signal
- Explicit message = no ambiguity, informed consent
- Cancel easier to hit = prevents accidents, respect for user
- Collapse animation = causality visible, "I caused this effect"
- Toast confirmation = closure, "action completed successfully"

**Why Heavy Friction:**
- Destructive actions should feel CONSEQUENTIAL
- Friction = time to reconsider
- Two-step = prevents muscle memory accidents
- Explicit language = no ambiguity about permanence

---

### PASSIVE MICRO-INTERACTIONS (Always Active)

**Health Indicator Pulse:**
- Frequency: Every 5 seconds when online
- Animation: Scale 1.0 → 1.15 → 1.0, opacity 1.0 → 0.7 → 1.0
- Duration: 2 seconds (subtle, not attention-grabbing)
- Purpose: Ambient reassurance, "system is alive"

**Input Focus States:**
- All text inputs: 3px blue outline appears (200ms ease)
- Box-shadow: 0 0 0 3px rgba(45,158,224,0.3)
- Purpose: Clear focus indicator, accessibility + beauty

**Version Counter Update:**
- On new version: "+1" floats up and fades (800ms)
- Counter digit flips with slight 3D rotate effect
- Purpose: Progress made tangible, small celebration

**Sidebar Hover:**
- 2px blue left border slides in from left (100ms)
- Background tint increases 2%
- Purpose: Preview of selection, clear affordance

**Button Hovers (all buttons):**
- Elevation increases 1px on Y (150ms)
- Box-shadow grows slightly
- Background lightens 5%
- Purpose: Tactile feedback preview, "this is pressable"

---

## 4. COLOR SYSTEM (Dark + Light Themes)

### DARK THEME (Default)

**Background Layers:**
```
--bg-primary: #0B0E11
  Role: Base canvas, editor panel
  Psychology: Near-black reduces eye strain, matches developer tools (VSCode, terminals)
  Not pure black: Avoids extreme contrast glare

--bg-secondary: #151920
  Role: Sidebar, timeline, header
  Psychology: +6% lightness creates subtle elevation
  Elevation without borders: Cleaner visual hierarchy

--bg-tertiary: #1C2127
  Role: Cards, inputs, elevated surfaces
  Psychology: +10% lightness, tactile depth perception
  Touch surfaces feel "closer" to user

--bg-elevated: #232931
  Role: Modals, popovers, tooltips
  Psychology: +15% lightness, maximum elevation
  Floats above everything, clear z-index hierarchy
```

**Surface Treatment:**
```
--surface-glass: rgba(255, 255, 255, 0.02)
  Role: Subtle glass effect on modals
  Psychology: Premium feel without distraction
  2% opacity = discovered not seen

--surface-border: rgba(255, 255, 255, 0.06)
  Role: Hairline borders, dividers
  Psychology: Structure without weight
  Borders guide, don't contain

--surface-divider: rgba(255, 255, 255, 0.04)
  Role: Section separators within panels
  Psychology: Gentle organization
  Visible but not dominant
```

**Primary Accent (ONLY saturated color):**
```
--accent-primary: #2D9EE0
  Role: Primary actions, latest version, focus states
  Psychology: Blue = trust + technology + intelligence
  Cyan-shift: Modern, not corporate
  Saturation: 72%, high contrast on dark without aggression
  
--accent-hover: #4DB3F5
  Role: Hover state for primary elements
  Psychology: Lightness increase = approachability
  +15% lightness maintains recognition

--accent-glow: rgba(45, 158, 224, 0.3)
  Role: Shadows, focus rings, latest version glow
  Psychology: 30% opacity creates "aura" effect
  Emphasizes without overwhelming
```

**Destructive Color:**
```
--danger-primary: #E84855
  Role: Delete actions, errors, warnings
  Psychology: Red = stop, danger, loss
  Used ONLY for destructive actions (specificity = clarity)

--danger-hover: #FF6B75
  Role: Hover state for danger buttons
  Psychology: Lightening reduces intimidation
  Maintains seriousness while being approachable

--danger-glow: rgba(232, 72, 85, 0.3)
  Role: Danger button shadows, error highlights
  Psychology: Red glow = urgency without panic
```

**Success Color:**
```
--success-primary: #26C281
  Role: Confirmations, health indicator, validation
  Psychology: Green = go, growth, success
  Never used for primary actions (that's blue)

--success-glow: rgba(38, 194, 129, 0.25)
  Role: Success state highlights, pulse effects
  Psychology: Green glow = reassurance, completion
```

**Text Hierarchy:**
```
--text-primary: #E8ECEF (93% white)
  Role: Primary content, headers, body text
  Psychology: High contrast for readability
  Not pure white: Reduces glare on dark backgrounds

--text-secondary: #9BA4AD (65% white)
  Role: Metadata, labels, secondary info
  Psychology: Clear subordination to primary
  Still readable, but deemphasized

--text-tertiary: #6C757D (48% white)
  Role: Timestamps, placeholders, hints
  Psychology: Lowest priority information
  Visible when needed, invisible when scanning

--text-disabled: #434A52 (30% white)
  Role: Disabled button text, inactive states
  Psychology: Clearly unusable
  Forces user to address blocker before proceeding
```

**Semantic Version Colors:**
```
--version-latest: #2D9EE0 (accent-primary)
  Role: Current/newest version border
  Psychology: "This is active, this is now"

--version-recent: rgba(45, 158, 224, 0.6) (60% opacity)
  Role: <24 hours old
  Psychology: Still fresh, recent work

--version-old: rgba(45, 158, 224, 0.3) (30% opacity)
  Role: >1 week old
  Psychology: Fading into history

--version-archived: rgba(108, 117, 125, 0.3) (gray, 30% opacity)
  Role: >1 month old
  Psychology: Historical, sealed, complete
```

---

### LIGHT THEME (Presentation/Review Mode)

**Background Layers:**
```
--bg-primary: #FFFFFF
  Role: Base canvas
  Psychology: Clean slate, presentation ready
  
--bg-secondary: #F7F8FA
  Role: Sidebar, timeline, header
  Psychology: Subtle warmth, not clinical

--bg-tertiary: #ECEEF2
  Role: Cards, inputs
  Psychology: Tactile depth, slightly recessed

--bg-elevated: #FFFFFF
  Role: Modals (with stronger shadow)
  Psychology: Maximum elevation, floats clearly
```

**Surface Treatment:**
```
--surface-glass: rgba(0, 0, 0, 0.02)
  Role: Subtle depth on elevated surfaces

--surface-border: rgba(0, 0, 0, 0.08)
  Role: Visible borders (needs more opacity on light)

--surface-divider: rgba(0, 0, 0, 0.04)
  Role: Section dividers
```

**Accent Colors (Same Hue, Adjusted Saturation):**
```
--accent-primary: #1E88D6 (darker blue)
  Role: Primary actions
  Psychology: Higher contrast on light background
  Saturation: 78%, visibility on white

--accent-hover: #3399E6
  Role: Hover states

--accent-glow: rgba(30, 136, 214, 0.2)
  Role: Focus rings, glows (lower opacity on light)
```

**Destructive & Success (Adjusted):**
```
--danger-primary: #D63447
--success-primary: #1FA872
  Psychology: Slightly darker for light background contrast
```

**Text Hierarchy:**
```
--text-primary: #1C2127 (92% black)
--text-secondary: #5C6775 (60% black)
--text-tertiary: #8A94A0 (48% black)
--text-disabled: #B8BFC7 (25% black)
  Psychology: Inverted hierarchy maintains readability
```

**Theme Toggle Behavior:**
- Toggle switch in header (top-right, next to health)
- Transition: 250ms for all colors (smooth but not slow)
- Preserves layout (no reflow)
- System preference detection on first load
- User choice persists in localStorage

**Why Both Themes:**
- Dark: Working mode, reduces eye strain, developer expectation
- Light: Presentation mode, sharing, meetings, screenshots
- Psychological shift: Dark = creation, Light = review
- Both must feel intentional, not "forced to support both"

---

## 5. TYPOGRAPHY SYSTEM

### FONT FAMILIES

```
--font-display: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif
  Use: Headers, buttons, UI chrome
  Rationale: Geometric sans, technical but friendly, excellent small sizes
  Psychology: Modern without being trendy, professional credibility

--font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
  Use: Body text, editor content, descriptions
  Rationale: System fonts = zero latency, native feel
  Psychology: Subconscious "this is a native app" perception
  Reduces "this is just a web page" friction

--font-mono: 'JetBrains Mono', 'SF Mono', 'Consolas', 'Courier New', monospace
  Use: Keys, version IDs, JSON, code blocks
  Rationale: Developer tool credibility, excellent ligatures
  Psychology: Mono = technical, precise, authoritative
  Distinguishes data from prose
```

**Font Loading Strategy:**
- System fonts load instantly (no FOIT/FOUT)
- Inter loaded async for headers only
- No font flash on body text (always system)
- Psychology: Instant paint = responsiveness

---

### TYPE HIERARCHY

**H1 — Application Title**
```
Font: Inter (display)
Size: 28px (1.75rem)
Weight: 700 (bold)
Line-height: 1.2
Letter-spacing: -0.02em (optical correction)
Color: var(--text-primary)
Transform: none
```
Purpose: App identity, used once in header
Psychology: Authority, permanence, brand

**H2 — Major Section Headers**
```
Font: Inter
Size: 18px (1.125rem)
Weight: 600 (semibold)
Line-height: 1.3
Letter-spacing: -0.01em
Color: var(--text-primary)
```
Purpose: "Latest Version", "Version History"
Psychology: Organization, clear hierarchy

**H3 — Field Labels & Subsections**
```
Font: Inter
Size: 13px (0.8125rem)
Weight: 600 (semibold)
Line-height: 1.4
Letter-spacing: 0.03em (slight expansion)
Color: var(--text-secondary)
Transform: uppercase
```
Purpose: "PROMPT TEXT", "MODEL SETTINGS", "CHANGE NOTE"
Psychology: Labels not content, organizational
Uppercase = distinction without weight

**Body — Primary Content**
```
Font: System
Size: 15px (0.9375rem)
Weight: 400 (regular)
Line-height: 1.6 (readable paragraphs)
Color: var(--text-primary)
```
Purpose: Editor textarea, descriptions, version text
Psychology: Neutral, readable, invisible typography
Focus on content not form

**Body Small — Metadata & Hints**
```
Font: System
Size: 13px (0.8125rem)
Weight: 400
Line-height: 1.5
Color: var(--text-secondary)
```
Purpose: Timestamps, "last edited", form hints
Psychology: Subordinate but legible

**Monospace Badge — Technical Identifiers**
```
Font: JetBrains Mono
Size: 12px (0.75rem)
Weight: 500 (medium)
Line-height: 1.5
Color: var(--accent-primary)
Background: rgba(accent-primary, 0.1)
Padding: 2px 8px
Border-radius: 3px
```
Purpose: Prompt keys, version numbers, IDs
Psychology: "This is system data, not prose"
Badge treatment = importance + distinction

**Button Text**
```
Font: Inter
Size: 14px (0.875rem)
Weight: 500 (medium)
Letter-spacing: 0.01em
Transform: none
```
Purpose: All buttons
Psychology: Readable at small size, balanced weight
Not too light (weak), not too bold (aggressive)

**Code Blocks (JSON settings)**
```
Font: JetBrains Mono
Size: 13px (0.8125rem)
Weight: 400
Line-height: 1.6
Color: var(--text-secondary)
Background: var(--bg-tertiary)
Padding: 12px
Border-radius: 6px
```
Purpose: Model settings display in version history
Psychology: Code environment, technical credibility

---

### TYPOGRAPHIC RULES

**1. Never pure black on dark or pure white on light**
- Dark theme: Lightest text = #E8ECEF (93% white)
- Light theme: Darkest text = #1C2127 (92% black)
- Rationale: Reduces glare, easier on eyes
- Psychology: Subtle = sophisticated

**2. Line-height correlates with font size**
- Large headers: 1.2 (tight, for impact)
- Body text: 1.6 (loose, for reading)
- Rationale: Optical balance at different scales
- Psychology: Headers feel solid, body feels open

**3. Negative letter-spacing for display sizes**
- 28px: -0.02em
- 18px: -0.01em
- 13px: +0.03em (uppercase labels)
- Rationale: Optical correction, tighter at large scale
- Psychology: Intentional, not default

**4. Monospace always gets background treatment**
- Never naked monospace in prose
- Always: background + padding + border-radius
- Rationale: Creates "badge" or "pill" effect
- Psychology: "This is data, inspect closely"

**5. Italics ONLY for change notes**
- User-written change notes: Italic
- System text: Never italic
- Rationale: Italic = voice, opinion, human
- Psychology: Distinguishes human from machine

**6. All-caps ONLY for H3 labels**
- Field labels: Uppercase
- Everything else: Normal case
- Rationale: Organizational, not emphasis
- Psychology: Caps = category, not shouting

**7. Weight progression must be visible**
- Regular: 400
- Medium: 500 (buttons, mono)
- Semibold: 600 (headers, labels)
- Bold: 700 (app title only)
- Rationale: Each step is perceptible
- Psychology: Hierarchy through weight

---

### HOW TYPOGRAPHY REINFORCES TRUST & CLARITY

**Trust Signals:**
- System fonts = "This respects my OS preferences"
- Monospace for data = "This tool understands technical precision"
- Consistent hierarchy = "This tool has structure"
- No font tricks = "This tool is straightforward"

**Clarity Signals:**
- 4-tier text color hierarchy = "I know what's important"
- Uppercase labels vs. normal content = "I know what's organizational"
- Italic for human voice = "I know what's opinion vs. fact"
- Background on technical identifiers = "I know what to inspect closely"

**Technical Credibility:**
- JetBrains Mono = Developer tool association
- Badge treatment on IDs = System thinking
- Code block styling = Technical fluency
- Rationale: Users (especially non-technical) trust tools that "look serious"

---

## 6. LAYOUT TRANSLATION (CSS-Ready)

### SPACING SCALE
```css
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
}
```
**Rule:** All spacing must be multiples of 4px
**Why:** Consistent rhythm, easier mental math, cleaner code

---

### GRID LAYOUT
```css
.app-container {
  display: grid;
  grid-template-columns: 240px 1fr 520px;
  grid-template-rows: 64px 1fr;
  height: 100vh;
  gap: 0;
}

.header {
  grid-column: 1 / -1;
  grid-row: 1;
  border-bottom: 1px solid var(--surface-border);
  background: var(--bg-secondary);
  padding: 0 var(--space-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar {
  grid-column: 1;
  grid-row: 2;
  background: var(--bg-secondary);
  border-right: 1px solid var(--surface-border);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.editor-panel {
  grid-column: 2;
  grid-row: 2;
  background: var(--bg-primary);
  padding: var(--space-xl);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.timeline-panel {
  grid-column: 3;
  grid-row: 2;
  background: var(--bg-secondary);
  border-left: 1px solid var(--surface-border);
  overflow-y: auto;
  padding: var(--space-lg);
}
```

**Why This Grid:**
- Sidebar: 240px = wide enough for readable text, narrow enough to not dominate
- Timeline: 520px = fixed width prevents shrinking (importance signal)
- Editor: Flexible = grows with screen, accommodates long prompts
- No gaps: Borders provide separation without white space waste

---

### CARD COMPONENTS
```css
.version-card {
  background: var(--bg-tertiary);
  border-left: 4px solid var(--version-old);
  border-radius: 6px;
  padding: var(--space-md);
  margin-bottom: var(--space-md);
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

.version-card:hover {
  background: var(--bg-elevated);
  transform: translateY(-4px);
  box-shadow: 
    0 8px 16px rgba(0, 0, 0, 0.3),
    0 0 0 1px var(--surface-border);
}

.version-card.latest {
  border-left-color: var(--accent-primary);
  box-shadow: 
    0 0 0 1px var(--accent-glow),
    0 4px 16px rgba(45, 158, 224, 0.15);
}

.version-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm);
}

.version-number {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--accent-primary);
  background: rgba(45, 158, 224, 0.1);
  padding: 2px 8px;
  border-radius: 3px;
}

.version-timestamp {
  font-size: 13px;
  color: var(--text-tertiary);
  font-style: italic;
}

.version-change-note {
  font-size: 14px;
  color: var(--text-primary);
  font-style: italic;
  margin-bottom: var(--space-sm);
}

.version-content {
  background: var(--bg-primary);
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  padding: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.version-label {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-tertiary);
  margin-bottom: 4px;
}

.version-text {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  line-height: 1.5;
}
```

**Psychology:**
- Left border: Visual anchor, easy scanning
- Hover elevation: "This is inspect-able"
- Latest glow: "This is special"
- Badge treatment on number: Technical precision
- Italic change note: Human voice

---

### BUTTON STYLES
```css
.btn-primary {
  background: var(--accent-primary);
  color: #FFFFFF;
  border: none;
  border-radius: 6px;
  padding: 12px 24px;
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 2px 8px rgba(45, 158, 224, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}

.btn-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 
    0 4px 16px rgba(45, 158, 224, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.15) inset;
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: 
    0 1px 4px rgba(45, 158, 224, 0.3),
    0 0 0 1px rgba(0, 0, 0, 0.2) inset;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-danger {
  background: var(--danger-primary);
  color: #FFFFFF;
  /* Same structure as primary */
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--surface-border);
  color: var(--text-primary);
  padding: 12px 24px;
  border-radius: 6px;
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
}

.btn-secondary:hover {
  background: var(--bg-elevated);
  border-color: var(--text-tertiary);
}

.btn-icon {
  background: transparent;
  border: 1px solid var(--surface-border);
  width: 36px;
  height: 36px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 150ms ease;
}

.btn-icon:hover {
  background: var(--bg-elevated);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}
```

**Psychology:**
- Inset highlight: Creates depth, "button has mass"
- Hover lift: Affordance, "this can be pressed"
- Active press: Tactile feedback, physical metaphor
- Disabled opacity: Clearly unusable state

---

### INPUT FIELDS
```css
.input-field {
  background: var(--bg-tertiary);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 12px 16px;
  font-family: var(--font-body);
  font-size: 15px;
  color: var(--text-primary);
  transition: all 200ms ease;
  width: 100%;
}

.input-field:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 
    0 0 0 3px var(--accent-glow),
    0 0 0 1px var(--accent-primary);
}

.input-field::placeholder {
  color: var(--text-tertiary);
}

.input-field:disabled {
  background: var(--bg-secondary);
  color: var(--text-disabled);
  cursor: not-allowed;
  border-color: transparent;
}

.textarea-field {
  /* Same as input-field */
  min-height: 120px;
  resize: vertical;
  font-family: var(--font-body);
  line-height: 1.6;
}

.textarea-field.code {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
}
```

**Psychology:**
- 3px focus ring: Thick = important, accessible
- Glow + outline: Dual-layer emphasis
- Disabled transparency: Visually "inactive"
- Code textarea uses mono: Technical context

---

### MODAL OVERLAY
```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: modalFadeIn 200ms ease-out;
}

@keyframes modalFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: var(--bg-elevated);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  min-width: 480px;
  max-width: 600px;
  box-shadow: 
    0 24px 48px rgba(0, 0, 0, 0.6),
    0 0 0 1px var(--surface-glass) inset;
  animation: modalSlideUp 200ms cubic-bezier(0, 0, 0.2, 1);
}

@keyframes modalSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  padding: var(--space-lg);
  border-bottom: 1px solid var(--surface-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-body {
  padding: var(--space-lg);
}

.modal-footer {
  padding: var(--space-lg);
  border-top: 1px solid var(--surface-border);
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
}
```

**Psychology:**
- High opacity overlay: Forces focus, blocks distraction
- Backdrop blur: Premium feel, depth cue
- Slide up: Emerging metaphor, content "rising"
- Inset highlight: Floating, elevated surface

---

### ANIMATION EASING
```css
:root {
  --easing-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --easing-decelerate: cubic-bezier(0, 0, 0.2, 1);
  --easing-accelerate: cubic-bezier(0.4, 0, 1, 1);
  --easing-bounce: cubic-bezier(0.68, -0.55, 0.27, 1.55);
}
```

**Usage:**
- Standard: Default transitions (hover, focus)
- Decelerate: Elements entering (modals, cards)
- Accelerate: Elements exiting (closing, hiding)
- Bounce: Celebrations (new version appears)

---

### SHADOWS
```css
:root {
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);
  --shadow-xl: 0 24px 48px rgba(0, 0, 0, 0.6);
  --shadow-primary: 0 4px 16px rgba(45, 158, 224, 0.3);
  --shadow-danger: 0 4px 16px rgba(232, 72, 85, 0.3);
}
```

**Usage:**
- sm: Subtle elevation (cards at rest)
- md: Hover states
- lg: Modals, popovers
- xl: Maximum elevation (error modals)
- primary/danger: Colored emphasis

**Psychology:**
- Darker shadows on dark theme (50-60% opacity)
- Larger blur = higher elevation
- Colored shadows = semantic emphasis

---

### SCROLL BEHAVIOR
```css
.scrollable {
  overflow-y: auto;
  scroll-behavior: smooth;
}

.scrollable::-webkit-scrollbar {
  width: 8px;
}

.scrollable::-webkit-scrollbar-track {
  background: transparent;
}

.scrollable::-webkit-scrollbar-thumb {
  background: var(--text-tertiary);
  border-radius: 4px;
}

.scrollable::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* Scroll shadows (show more content cue) */
.scrollable::before,
.scrollable::after {
  content: '';
  position: sticky;
  display: block;
  height: 20px;
  pointer-events: none;
  z-index: 10;
}

.scrollable::before {
  top: 0;
  background: linear-gradient(
    to bottom,
    var(--bg-secondary),
    transparent
  );
}

.scrollable::after {
  bottom: 0;
  background: linear-gradient(
    to top,
    var(--bg-secondary),
    transparent
  );
}
```

**Psychology:**
- Thin scrollbar: Modern, unobtrusive
- Smooth scroll: Polished, intentional
- Scroll shadows: "More content exists" cue

---

## 7. SHINY OBJECT SYNDROME (WITHOUT GAMIFICATION)

### HOW THE UI MAKES USERS WANT TO RETURN

**1. Progress Visibility (Endowment Effect)**

Mechanism:
- Version counter always visible: "47 versions"
- Timeline shows accumulation: Scroll = see history
- Latest version glows: "This is my newest achievement"

Psychology:
- Endowment effect: "I've invested 47 versions, I own this"
- Sunk cost (positive): "I've put work in, I want to continue"
- Zeigarnik effect: If prompt shows "Edited 5m ago", tension to complete

Implementation:
- Counter in timeline header, bold, large font
- "Last edited" indicator on sidebar prompts with unsaved changes
- Visual aging of versions (color fade) creates history narrative

**2. Emotional Visibility of Progress**

Mechanism:
- Creating version = celebration animation (350ms sequence)
- Counter increments with "+1" float-up animation
- New version card appears with glow pulse
- Timeline scrolls to show placement

Psychology:
- Dopamine hit from visual reward
- Variable reward timing (animation is unpredictable reward)
- Completion satisfaction (checkbox without checkbox)

Implementation:
- Not a gamified "level up" or points
- Just: "I made something, and the system celebrates it"
- Feels serious, not playful

**3. Ownership Triggers**

Mechanism:
- User sees THEIR prompts listed
- User sees THEIR version history
- User sees THEIR change notes in italics (personal voice)
- Timeline is a monument to THEIR work

Psychology:
- IKEA effect: "I built this, it's valuable"
- Personal investment: "These are MY prompts, not templates"
- Memory anchors: Change notes trigger "I remember when I made that"

Implementation:
- Change notes in italic = personal diary entry
- Timeline always visible = constant reminder of ownership
- No "undo" needed because history is preserved = safety = confidence

**4. Momentum Perception**

Mechanism:
- Staggered animations create "building" effect
- Version cards cascade in (50ms delay each)
- Timeline shows chronological flow (top = now, bottom = past)
- "Time since last change" creates recency pressure

Psychology:
- Momentum illusion: "I'm on a roll, keep going"
- Recency bias: "I just did this 2 hours ago, don't lose streak"
- Forward motion: "History accumulates, I'm progressing"

Implementation:
- NOT a streak counter (too gamified)
- Just: Visual flow + temporal cues
- Feels natural, not manipulative

**5. Safety & Trust = Confidence to Experiment**

Mechanism:
- Versions are immutable (locked icon on hover)
- Delete actions are HEAVY (2-step, red, explicit)
- History is always visible = no hidden changes
- Can always "go back" by creating new version from old

Psychology:
- Loss aversion mitigated: "I can't lose work"
- Risk tolerance increases: "I can try bold changes"
- Trust builds: "This tool protects me"

Implementation:
- Lock icons on old versions
- "Recently deleted" (24hr restore)
- Explicit "This cannot be undone" messaging
- No silent failures

---

### WHY THIS WORKS FOR NON-TECHNICAL USERS

**Non-technical users fear:**
1. Breaking things
2. Losing work
3. Not understanding what happened
4. Looking incompetent

**Chronicle addresses each:**

1. **Can't break things**
   - Versions are immutable
   - History always visible
   - Delete requires confirmation
   - Visual: Lock icons, sealed cards

2. **Can't lose work**
   - Everything is versioned
   - Timeline shows all history
   - Recently deleted recovery
   - Visual: Counter, accumulation

3. **Always understand**
   - Change notes explain "what happened"
   - Timestamps show "when"
   - Visual aging shows "how old"
   - Visual: Italics for notes, color fading

4. **Feel competent**
   - Immediate feedback on every action
   - Success celebrations
   - Clear visual hierarchy
   - Visual: Animations, glows, confirmations

**Specific non-technical UX:**
- No jargon: "Create New Version" not "Commit"
- Clear labels: "Change Note" not "Commit Message"
- Visual timeline: Scroll = history (universal metaphor)
- Monospace badges: Look technical but don't require understanding

**Result:**
- Non-technical user: "I understand this, I'm making progress"
- Technical user: "This respects version control principles"
- Both: "This tool makes me better at my work"

---

### PSYCHOLOGICAL LOOP (30-SECOND EXPERIENCE)

**0-5 seconds:**
- User sees timeline on right (dominant)
- User sees version counter: "47 versions"
- User thinks: "Someone has invested here"

**5-15 seconds:**
- User clicks prompt in sidebar
- Staggered animation shows content loading
- User sees editor with latest version populated
- User thinks: "This is organized, I understand the structure"

**15-25 seconds:**
- User edits prompt text
- User sees "Create New Version" button glow
- User clicks button
- Animation sequence: Press → Process → Celebrate
- User thinks: "That felt important, I accomplished something"

**25-30 seconds:**
- User sees new version at top of timeline
- Counter increments: "48 versions"
- User scrolls timeline, sees history
- User thinks: "This remembers. I'm building something. I won't lose this."

**Result after 30 seconds:**
"This tool is serious. It respects my work. I'm progressing. I don't want to go back."

---

## FINAL VALIDATION CHECKLIST

□ Timeline occupies right 35%, always visible
□ Only one saturated color (blue) for actions and latest version
□ Version counter visible and animates on increment
□ Latest version has glow + border distinction
□ Editor is muted (grays), not competing for attention
□ Sidebar is compressed (240px), navigation not content
□ Creating version has 350ms ceremony animation
□ Staggered animations (50ms cascade) on load
□ All spacing is 4px multiples
□ Focus states are 3px thick
□ Destructive actions are red + 2-step confirmation
□ Old versions show lock icon on hover
□ Health indicator pulses subtly (5s interval)
□ Modals slide up 20px on appear
□ Success states persist 2-3 seconds
□ No pure black or pure white anywhere
□ Monospace has background badge treatment
□ Change notes use italic (human voice)
□ System fonts for body (instant load)
□ Inter for display (async load)
□ All animations <400ms except celebrations
□ Hover responses <150ms
□ Button elevation on hover
□ Input focus ring with glow
□ Version aging through color intensity
□ Scroll shadows indicate more content

---

Every pixel serves psychology.
Every animation reinforces causality.
Every color reduces cognitive load.
Every interaction builds trust.

No gamification. No trends. Only intentional design.

The result: Users feel competent, protected, and accomplished.
They return because they've built something here.
They trust because the tool never hides history.
They progress because momentum is visible.

This is Chronicle.

---

# Phase-2 Walkthrough: Integration Test Suite & Targeted Changes

## Test Results

```
26 passed, 0 failed in 2.06s
```

## Files Created/Modified

| File | Action | Purpose |
|---|---|---|
| `test_chronicle_full.py` | **NEW** | 26 integration tests across 6 sections |
| `pyproject.toml` | **NEW** | pytest-asyncio config (auto mode, session-scoped loop) |
| `version_control/alias_history.py` | **NEW** | AliasHistory model for promotion audit trail |
| `execution/pricing.py` | **NEW** | MODEL_PRICING dict and calculate_cost() |
| `alembic/versions/add_alias_history.py` | **NEW** | Migration for alias_history table |
| `alembic/versions/add_cost_usd.py` | **NEW** | Migration for cost_usd column on runs |
| `version_control/routes.py` | **MODIFIED** | Promote endpoint inserts AliasHistory row |
| `version_control/models.py` | **MODIFIED** | Fixed ambiguous PromptVersion.prompt relationship |
| `execution/models.py` | **MODIFIED** | Added cost_usd column (Numeric(10,8), nullable) |
| `execution/routes.py` | **MODIFIED** | Pre-insert pending run with try/finally + cost calculation |
| `alembic/env.py` | **MODIFIED** | Added model imports for migration detection |

## Bug Fix Found During Testing

The `PromptVersion.prompt` relationship lacked `foreign_keys=[prompt_id]`. With multiple FK paths between `PromptVersion` and `Prompt` (via `prompt_id` and `production_version_id`), SQLAlchemy couldn't resolve the join. This was a latent bug that surfaced when all models were imported together.

```diff
-    prompt = relationship("Prompt", back_populates="versions")
+    prompt = relationship("Prompt", back_populates="versions", foreign_keys=[prompt_id])
```

## Test Coverage Summary

| Section | Tests | What's Verified |
|---|---|---|
| 1. Prompt Management | 4 | CRUD, duplicate rejection, 404 on missing |
| 2. Version Control | 4 | Ordinals, is_latest, history order, delete blocked |
| 3. Alias & Promotion | 4 | Valid/invalid promotions, alias_history DB rows |
| 4. Execution Boundary | 5 | 404/400/422 guards, variable validation before LLM, success flow |
| 5. Run Integrity | 4 | Pending→success/error via DB, cost_usd non-null, finally-block coverage |
| 6. Cost Calculation | 5 | Math correctness, unknown model→None, linearity |

## Three Targeted Changes — Verified

1. **Alias audit trail**: `test_sequential_promotions_and_alias_history` reads `alias_history` rows directly from DB, confirms `from_version_id`/`to_version_id` chain
2. **Pre-insert pending run**: `test_llm_error_run_db_state` and `test_generic_exception_run_db_state` confirm status is `"error"` (never `"pending"`) at the DB level after both `LLMError` and generic `Exception`
3. **Cost fields**: `test_successful_run_db_state` confirms `cost_usd` is non-null; `test_unknown_model_cost_null_but_success` confirms it's null for unlisted models
