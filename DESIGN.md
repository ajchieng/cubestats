---
name: Cubestats
description: A precise WCA analytics workspace for competitive speedcubers.
colors:
  background: "#f7f7f8"
  panel: "#ffffff"
  panel-soft: "#fafafa"
  field: "#ffffff"
  hover: "#f4f7fb"
  border: "#e2e5e9"
  border-soft: "#edf0f3"
  border-strong: "#d9dee5"
  heading: "#181b20"
  text: "#2d3239"
  label: "#5e6673"
  muted: "#626b77"
  muted-soft: "#6b7280"
  primary: "#2563eb"
  primary-bright: "#1d6fff"
  success: "#16a34a"
  success-text: "#166534"
  success-bg: "#eaf7ef"
  danger: "#dc2626"
  chart-blue: "#4a86e8"
  badge-bg: "#ecf3ff"
  segmented-bg: "#f2f5f9"
  heat-0: "#eceff3"
  heat-1: "#cfe0ff"
  heat-2: "#8fb8f5"
  heat-3: "#4f8ee8"
  heat-4: "#2563eb"
  dark-background: "#101216"
  dark-panel: "#171a20"
  dark-panel-soft: "#1c2027"
  dark-primary: "#6aa2ff"
  dark-text: "#d8dde4"
typography:
  display:
    fontFamily: "var(--font-geist-sans), Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "3.7rem"
    fontWeight: 760
    lineHeight: 0.95
    letterSpacing: "0"
  headline:
    fontFamily: "var(--font-geist-sans), Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "2.7rem"
    fontWeight: 760
    lineHeight: 1
    letterSpacing: "0"
  title:
    fontFamily: "var(--font-geist-sans), Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 760
    lineHeight: 1.2
    letterSpacing: "0"
  body:
    fontFamily: "var(--font-geist-sans), Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 620
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "var(--font-geist-sans), Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.74rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0"
  mono:
    fontFamily: "var(--font-geist-mono), SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace"
    fontSize: "0.86rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "0"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "42px"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "34px"
  input-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.heading}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
    height: "42px"
  surface-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "20px"
  metric-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.heading}"
    rounded: "{rounded.md}"
    padding: "18px"
  tab-active:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "32px"
---

# Design System: Cubestats

## 1. Overview

**Creative North Star: "The Competition Logbook"**

Cubestats should feel like a precise competition logbook made interactive: compact, factual, fast to scan, and built around official WCA evidence. It is not a business-intelligence dashboard wearing speedcubing labels; it is a specialist analysis surface where PBs, averages, ranks, dates, attempts, and DNF markers stay close to the user's hand.

The visual system is restrained product UI: cool light neutrals, a single blue action and selection color, low ambient elevation, 8px corners, dense grids, and stable native controls. Dark mode mirrors the same structure with deeper neutral panels and a softer blue accent. Personality comes from WCA-specific language, real competitor examples, tabular solve detail, and chart semantics, not decoration.

It explicitly rejects the PRODUCT.md anti-references: generic corporate dashboard, KPI reporting suite, gamified toy, obvious AI slop, decorative analytics cliches, inflated SaaS hero patterns, generic card grids, and vague "insights" language.

**Key Characteristics:**

- Restrained blue-on-neutral palette with semantic success and danger states.
- Dense but legible analytics cards, charts, tabs, tables, and heatmaps.
- One sans family for UI and one mono family for result values and WCA IDs.
- 8px geometry across controls, panels, tabs, chips, and empty states.
- Shadows are quiet and structural; data hierarchy carries the interface.

## 2. Colors

The palette is a restrained cool-neutral product system with one blue primary accent and a small set of semantic data colors.

### Primary

- **Competition Blue**: The primary action, selected tab, active segmented control, chart line, data points, heatmap high value, and rank accent. It must stay rare enough to mean "current", "action", or "selected".
- **Bright Focus Blue**: The hover and focus variant for outlines and active affordances. It sharpens interaction without changing the brand hue.

### Secondary

- **Solve Green**: Success, wins, fit lines, Kinch-positive markers, and milestone chips. It is semantic, not decorative.
- **Error Red**: Invalid WCA ID input, rejected fetches, and destructive or blocking errors. It should never be used for ordinary emphasis.

### Neutral

- **Workspace Grey**: The page background. It creates contrast against white panels without becoming beige, paper-like, or editorial.
- **White Panel**: Primary cards, form fields, buttons at rest, chart panels, metric cards, and result containers.
- **Soft Panel**: Example cards, milestone cards, and second-level surfaces inside a panel.
- **Ink Black**: Headings and primary data labels.
- **Body Ink**: Default body text and table values.
- **Control Grey**: Labels, captions, axis labels, muted help text, and inactive controls.
- **Grid Grey**: Chart grid lines, dividers, table row separators, and dashed empty-state borders.

### Named Rules

**The Blue Means Current Rule.** Use Competition Blue only for primary action, current selection, chart focus, and active data state. Do not wash the whole UI in blue.

**The No Beige Analytics Rule.** The workspace background is cool neutral, not cream, sand, ivory, or paper. Warm editorial backgrounds make the app feel generated and less analytical.

**The Semantic Color Rule.** Green means success or better performance; red means error. Do not use either as ornament.

## 3. Typography

**Display Font:** Geist Sans with system-ui fallback.
**Body Font:** Geist Sans with system-ui fallback.
**Label/Mono Font:** Geist Mono with SFMono-Regular, Consolas, Liberation Mono, and Menlo fallbacks.

**Character:** The type system is compact, technical, and familiar. It should read like a serious product interface, with mono reserved for result values, WCA IDs, attempts, and tabular numerals.

### Hierarchy

- **Display** (760, 3.7rem, 0.95): App name only. This is the one brand-scale moment; it should not be reused inside charts or cards.
- **Headline** (760, 2.7rem, 1): Competitor names and comparison names. On mobile it steps down to 2.2rem.
- **Title** (760, 1rem, 1.2): Panel titles, chart titles, table section titles, and compact card headings.
- **Body** (620-650, 1rem, 1.5): Landing prose, empty states, help text, and short explanatory copy. Keep long prose under 64ch.
- **Label** (760-820, 0.72rem-0.78rem, uppercase when categorical): Field labels, panel labels, table headers, rank keys, and metadata labels.
- **Data Mono** (650, 0.86rem, tabular): Results, attempts, ranks, WCA IDs, dates, and numeric dashboard values where alignment matters.

### Named Rules

**The Data Gets the Mono Rule.** Use mono for values that need scanning or comparison. Do not put navigation, buttons, or prose in mono for flavor.

**The Fixed Product Scale Rule.** Use fixed rem sizes and responsive breakpoints. Do not introduce fluid viewport typography for dashboard panels.

## 4. Elevation

Cubestats uses a hybrid of borders, tonal layering, and low ambient shadows. Panels are bordered first; shadows are shallow and quiet, used to separate dense surfaces from the cool workspace background. The app should never feel glassy, floaty, or card-heavy for decoration.

### Shadow Vocabulary

- **Panel Ambient** (`box-shadow: 0 1px 2px var(--shadow)`): Main panels, chart panels, metric cards, landing panels, results panels, and skeleton panels.
- **Control Ambient** (`box-shadow: 0 1px 2px var(--shadow)`): Lightweight emphasis such as head-to-head record panels.
- **Selected Control** (`box-shadow: 0 1px 3px var(--shadow-2)`): Active segmented buttons only.
- **Focus Ring** (`box-shadow: 0 0 0 3px var(--focus-ring)`): Form focus and validation focus states.

### Named Rules

**The Border First Rule.** Every analytical surface earns structure with a 1px border before it earns a shadow.

**The No Ghost Card Rule.** Do not combine bigger soft shadows with decorative borders. The existing shadow vocabulary is already the ceiling.

## 5. Components

### Buttons

- **Shape:** Gently squared controls (8px radius) with 42px minimum height for primary actions.
- **Primary:** Competition Blue background with white text, 760 weight, and `0 18px` horizontal padding.
- **Hover / Focus:** Primary buttons rely on state, disabled opacity, and form focus rings; secondary buttons shift border and text toward blue on hover.
- **Secondary / Utility:** Theme toggle, recent chips, pagination buttons, and event tabs use white panel backgrounds with 1px borders.

### Chips

- **Recent Search Chips:** White background, 8px radius, 1px strong border, 30px minimum height, tabular WCA ID text.
- **Rank Badges:** Soft blue background, 6px radius, compact padding, bold key-value layout.
- **Barrier Chips:** Green semantic background, 8px radius, bold barrier label with muted date detail.

### Cards / Containers

- **Corner Style:** 8px radius across panels, cards, controls, empty states, and tabs. Small internal badges may use 4px or 6px.
- **Background:** Main surfaces use White Panel; nested or example surfaces use Soft Panel.
- **Shadow Strategy:** Main analytical panels use Panel Ambient. Nested cards generally avoid extra shadow.
- **Border:** 1px neutral border for every panel and card; table rows use soft divider borders.
- **Internal Padding:** 20px on analytical panels, 18px on metrics, 28px on the landing panel, reduced to 16px under 760px.

### Inputs / Fields

- **Style:** White field background, 1px strong border, 8px radius, uppercase WCA ID entry, and `12px 14px` padding.
- **Focus:** Bright Focus Blue border plus a 3px translucent blue focus ring.
- **Error / Disabled:** Invalid fields use Error Red border and red focus ring. Disabled buttons drop to 0.56 opacity and use not-allowed cursor.
- **Clear Button:** Small transparent 30px square inside the input; hover uses the neutral hover background.

### Navigation

- **Event Tabs:** Wrapped tab row with bottom divider. Inactive tabs are bordered white buttons; active tabs are solid Competition Blue with white text.
- **Segmented Control:** Four-part compact grid on a soft neutral tray. Active segment uses panel background, Competition Blue text, and selected-control shadow.
- **Theme Toggle:** Compact bordered utility button in the header. It changes the whole token set but not the app structure.

### Signature Components

**Metric Grid:** A dense 6-column desktop grid collapsing to 3, then 2, then 1 column. Each metric uses a panel card, compact label, large value, optional mono detail, and rank badges.

**Chart Panel:** Bordered panel with a title row, unit label, optional controls, SVG chart, neutral axes, blue data line, translucent area fill, green fit line, and accessible `role="img"` labeling.

**Results Table:** Horizontally scrollable table with 1080px minimum width, uppercase headers, soft row dividers, hover row background, mono result values, dropped-attempt styling, and pagination controls.

**Activity Heatmap:** 26px square cells with 6px radius and a five-step blue heat scale. It must remain data-first; the legend and summary carry meaning alongside color.

**Skeleton State:** Panel skeletons use the neutral base and highlight shimmer. Reduced motion disables the animation.

## 6. Do's and Don'ts

### Do:

- **Do** keep Cubestats in the product register: fast lookup, comparison, event drilldown, and data inspection come before presentation.
- **Do** use Competition Blue for primary action, selected state, and chart focus only.
- **Do** preserve dense analytics where density helps speedcubers compare official results.
- **Do** keep tables and charts readable on small screens with horizontal scrolling and structural breakpoints.
- **Do** use WCA-specific terms directly: PB, Ao5, DNF, WCA ID, Kinch, Sum of Ranks, single, average, round, attempt.
- **Do** keep 8px as the default radius for controls and panels.
- **Do** use skeleton loading for dashboard content instead of centered spinners.

### Don't:

- **Don't** make Cubestats feel like a generic corporate dashboard.
- **Don't** make it feel like a KPI reporting suite.
- **Don't** make it feel like a gamified toy.
- **Don't** ship obvious AI slop: decorative analytics cliches, inflated SaaS hero patterns, generic card grids, vague "insights" language, or ornamental gradients.
- **Don't** use gradient text, glassmorphism, decorative side stripes, oversized rounded cards, or repeating stripe backgrounds.
- **Don't** invent non-standard form controls, tabs, tables, or modals for flavor.
- **Don't** use green, red, or blue as decoration when they are not carrying state or data meaning.
