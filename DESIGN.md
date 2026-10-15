---
name: All About That Bounce
description: Playful, saturated, bubbly and clean rental application.
colors:
  ink: "#252047"
  paper: "#fffdf5"
  purple: "#5632bc"
  pink: "#c51d60"
  yellow: "#ffcf32"
  aqua: "#64ded5"
  soft: "#f0ebff"
  white: "white"
  purple-hover: "#3d218d"
  danger: "#a5163f"
  disabled-bg: "#e2deea"
  disabled-text: "#615c70"
  header-border: "#e8e2f1"
  image-bg: "#e8f9f7"
  muted: "#544c6c"
  review-border: "#afa0d0"
  demo-bg: "#fff1c1"
  field-border: "#8b819e"
  divider: "#ddd5ed"
  calendar-disabled-bg: "#efedf1"
  calendar-disabled-text: "#706879"
typography:
  body:
    fontFamily: "ui-rounded,'Trebuchet MS',Arial,sans-serif"
    fontSize: "17px"
    lineHeight: 1.6
  display:
    fontSize: "clamp(2.6rem,6.5vw,5rem)"
    fontWeight: 900
    lineHeight: 1.12
    letterSpacing: "-.025em"
  page-headline:
    fontSize: "clamp(2.3rem,5vw,3.6rem)"
    fontWeight: 900
    lineHeight: 1.12
    letterSpacing: "-.025em"
  headline:
    fontSize: "clamp(1.8rem,4vw,2.7rem)"
    lineHeight: 1.12
    letterSpacing: "-.025em"
  title:
    fontSize: "1.4rem"
    lineHeight: 1.12
    letterSpacing: "-.025em"
  label:
    fontWeight: 700
rounded:
  radius: "20px"
  button: "30px"
  navigation: "24px"
  field: "10px"
  notice: "14px"
  tag: "16px"
  hero-art: "60px 24px 60px 24px"
spacing:
  compact: "8px"
  action-gap: "12px"
  group-gap: "16px"
  form-gap: "18px"
  mobile-panel: "20px"
  card-panel: "24px"
  booking-gap: "28px"
  hero-gap: "36px"
  section: "54px"
components:
  button-primary:
    backgroundColor: "{colors.purple}"
    textColor: "{colors.white}"
    rounded: "{rounded.button}"
    padding: "12px 22px"
  button-primary-hover:
    backgroundColor: "{colors.purple-hover}"
  button-secondary:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "12px 22px"
  button-quiet:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "12px 22px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.white}"
    rounded: "{rounded.button}"
    padding: "12px 22px"
  field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px"
  card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.radius}"
  panel:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.radius}"
    padding: "24px"
  tag:
    backgroundColor: "{colors.soft}"
    rounded: "{rounded.tag}"
    padding: "5px 10px"
  navigation:
    textColor: "{colors.ink}"
    rounded: "{rounded.navigation}"
    padding: "10px 15px"
  calendar-day:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0"
---

# Design System: All About That Bounce

## Overview

**Creative North Star: "The Party Invitation"**

The Party Invitation is the working metaphor for this playful, saturated, bubbly and clean system. Bold rounded-feeling system type, pill actions, warm paper, purple emphasis, yellow bands and aqua artwork framing carry the invitation into a readable request flow and simple owner tools.

This design record began with the scoped frontend demo, sampled from public/styles.css and public/index.html, public/book.html and public/admin.html. Purple, yellow and aqua remain provisional brand choices; the working logo, artwork and palette remain provisional, and catalog details require owner approval. Source review was followed by scoped visual and functional demo verification: five public routes at 360px had no overflow or page errors, mobile route screenshots and desktop Home were inspected, and the demo was approved to ship after two spacing fixes. This evidence covers the reviewed demo surfaces, not production readiness or every device and state.

**Key Characteristics:**

- Saturated accents on warm paper and white surfaces.
- Bold headings, pill actions and softly rounded forms.
- Mobile-first stacked content with one desktop breakpoint.
- Centralized CSS color variables and a local system font stack.

## Colors

The palette uses lively purple, sunny yellow and fresh aqua against warm paper; pink marks focus rather than taking over content. The frontmatter records CSS values exactly, including literal colors not yet centralized as custom properties.

### Primary

- **Party Purple** (`purple`): links, primary actions, emphasized hero words, selected calendar dates and selection outlines. `purple-hover` darkens primary actions.

### Secondary

- **Sunny Yellow** (`yellow`): secondary actions, logo tile, ribbon and text selection.

### Tertiary

- **Fresh Aqua** (`aqua`): the hero artwork frame.
- **Focus Pink** (`pink`): global keyboard focus outline.

### Neutral

- **Deep Ink** (`ink`): body text and dark footer.
- **Warm Paper** (`paper`): page background; `white` serves headers, fields, cards and panels.
- **Soft Lavender** (`soft`): tinted sections, notices, tags, quiet actions and available calendar days.
- **Muted Ink** (`muted`): supporting copy. Header, review, field and divider colors keep distinct structural roles.
- **Demo Yellow** (`demo-bg`): explicit demo notices. Danger and disabled colors communicate state, with separate calendar disabled tones.

## Typography

All text inherits the body font stack recorded in frontmatter. Native form controls explicitly inherit it too. There is no font download. Heavy headings provide the cheerful character; body copy stays plain and legible.

- **Display:** homepage heading; fluid size, weight and tight tracking in frontmatter.
- **Page headline:** request and owner page headings use the smaller fluid scale.
- **Headline / title:** section and card headings; CSS leaves h2/h3 weight to the browser's heading defaults rather than declaring a custom weight.
- **Body:** paragraphs have a maximum measure of 65ch. No formal scale ratio is declared.
- **Supporting roles:** hero and review copy (1.15rem); step titles (1.25rem); prices (1.45rem, 900); grand total (1.3rem, 900); muted copy and errors (.9rem); demo copy (.85rem); tags and calendar weekdays (.8rem). The hero caption declares .85rem, but the more specific hero paragraph rule makes its source-effective size 1.15rem.
- **Labels:** bold, with a bottom margin (7px); brand uses weight 900 and line-height 1.1, with a small placeholder label (11px, 400).

## Layout

The centered container is `min(1120px,calc(100% - 36px))`, giving side gutters of 18px. Content grids are single-column by default. Below 700px, the header wraps, the toggled navigation stacks at full width, links gain 14px padding, hero top padding becomes 38px, and panel/card-body padding becomes 20px. Calendar navigation moves beneath its centered month label.

At 700px, hero columns become `1.1fr 1fr`; content cards use three equal columns; fields, general two-column content and the three-step list expand. Booking uses `1fr 340px` with a 28px gap and a sticky estimate at top 20px. The menu toggle hides; desktop navigation displays even when its hidden attribute is present.

Spacing combines the repeated steps in frontmatter with source-specific values: hero padding 58px 0 46px, page heading 48px 0 24px, field group gap 18px, card grid gap 24px, hero grid gap 36px, desktop steps gap 38px and two-column gap 40px. Sections use 54px vertical padding. Buttons and ordinary fields have a minimum height of 48px; calendar days are 44px. The calendar is capped at 420px. The reviewed 360px public routes had no horizontal overflow or page errors. Mobile general two-column sections now stack with a 36px gap; contact-form field groups use 16px vertical margins, excluding the status area. These two adjustments followed visual review.

## Elevation & Depth

Tonal layering does most of the work. Cards use `0 8px 24px #2520470c`; panels use `0 8px 24px #2520470a`. These restrained resting shadows separate white surfaces from paper or lavender. The source contains no hover lift or transition vocabulary.

Hero artwork arrives from translateY(12px) to translateY(0) over .65s ease-out only under `prefers-reduced-motion:no-preference`. Keep this limited entrance treatment rather than introducing motion into the request form.

## Shapes

Shared surfaces use the centralized radius token. Pills distinguish actions; smaller rounded rectangles distinguish fields and calendar cells. The hero frame has alternating generous and compact corners, while contained artwork uses 16px corners. The yellow logo tile uses 14px corners. Cards clip their images to the surface silhouette and use a 4:3 image ratio. Reviews use a thin left border rather than a card shell.

## Components

### Buttons

Confident and touch-friendly: inline-flex, centered, bold, minimum 48px high. Primary, secondary, quiet and danger variants use frontmatter assignments. Hover sets the generic purple-hover background, but secondary/quiet/danger variant selectors override it; those variants have no distinct implemented hover color. Disabled buttons use disabled background/text tokens and a not-allowed cursor. Focus uses a pink 3px outline with 4px offset. No active style or transition is declared.

### Chips

Small soft-lavender tags use bold .8rem type and the tag primitive. They are descriptive, not interactive filters.

### Cards / Containers

White cards clip imagery, use a restrained shadow and a 24px body inset (20px on mobile). Panels use a related lighter shadow, 24px margins vertically and the same responsive inset. A selected item has a purple 3px outline with 3px offset. Demo banners stay visibly distinct from ordinary notices.

### Inputs / Fields

White fields use a 1px field-border stroke, 12px padding, ink text and a purple caret. Textareas resize vertically and start at 120px height. Checkboxes use 24px dimensions. Global focus remains visible; aria-invalid fields receive a 2px danger border and error text uses .9rem danger color. No separate disabled-field style is declared.

### Navigation

Bold ink links use rounded padding, with soft lavender and purple for the aria-current page. The same pink focus outline applies. There is no distinct navigation hover treatment in the source. Mobile navigation is menu-controlled and vertically stacked; desktop navigation is horizontal.

### Calendar and owner rows

The seven-column calendar uses 4px gaps, soft day buttons, purple selected dates and crossed-out disabled dates. Selection is communicated through aria-pressed; source-specific disabled colors remain separate from general buttons. Owner rows wrap their contents with 16px gaps, 18px vertical padding and a divider, keeping actions simple rather than using a dense table.

## Do's and Don'ts

### Do:

- Do reuse public/styles.css variables for shared colors, the font stack and the shared surface radius.
- Do preserve the 360px phone target, stacked mobile flow, wrapping actions and visible keyboard focus.
- Do keep marketing playful while forms and owner tools remain readable.
- Do label provisional imagery, demo data and request-only behavior honestly.

### Don't:

- Don't add unnecessary third-party fonts or scripts.
- Don't extend scoped demo verification into claims of production readiness or exhaustive device coverage.
- Don't treat the provisional palette or placeholder logo as approved final identity.

## Current Application Context

The frontend now calls the Cloudflare Worker API through `public/api.js`; requests and inventory persist in D1, and unit photos use R2. The owner dashboard is protected by Cloudflare Access. Historical visual checks above describe the original demo and do not verify current production interactions. See `TEST-RESULTS.md` for current automated and live checks. Do not reintroduce localStorage/demo-success copy. Owner approval of the working logo and palette remains pending.

## Booking Page

`public/book.html` is one page with five numbered steps: choose an inflatable, pick a date, your details, delivery address and price, and a live review panel with the Send button. The review panel sits beside the form on desktop and below it on phones. Steps 2 to 5 appear after an inflatable is chosen. The page has distinct states for loading, an empty catalog (contact options, no form), a failed catalog load (retry plus contact options), a failed calendar load (retry), a delivery quote that is loading, free, priced, outside the area or failed, and a pending-request acknowledgement.

Rules this page keeps: no motion or spinners in the form; no inline `style` attributes (the CSP uses `style-src 'self'`, which blocks them, including on the honeypot); the delivery quote is invalidated whenever the address changes and a request is never sent without a quote for the current address; the success panel says the request is pending and that the date is not held, and describes the receipt email as queued, never as delivered. Copy names Rena as the direct contact and avoids pronouns for her. Calendar days use arrow keys with a single tab stop. Browser-side rendering of the estimate is informational; the Worker recalculates price and delivery.
