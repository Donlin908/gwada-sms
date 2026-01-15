# Design Guidelines: Virtual SMS Number Service

## Design Approach

**System Selected:** Material Design 3 inspired, adapted for speed and utility
**Justification:** This is a utility-focused application where efficiency, clarity, and quick decision-making are paramount. Users need to select numbers and view SMS messages rapidly without visual distraction.

**Core Principles:**
- Speed-first interface with minimal friction
- Clear information hierarchy
- Trust-building through clean, professional aesthetics
- Mobile-first responsive design

## Typography

**Font Family:** Inter (Google Fonts)
- Primary: Inter 400 (body text, SMS content)
- Medium: Inter 500 (labels, secondary headers)
- Semibold: Inter 600 (primary headers, pricing)
- Bold: Inter 700 (hero headline only)

**Hierarchy:**
- Hero: text-5xl to text-7xl, font-bold
- Section Headers: text-3xl to text-4xl, font-semibold
- Card Titles: text-xl, font-semibold
- Body/SMS Messages: text-base, font-normal
- Labels/Meta: text-sm, font-medium
- Fine Print: text-xs, font-normal

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-4, p-6, p-8
- Section spacing: py-12, py-16, py-20
- Element gaps: gap-4, gap-6, gap-8
- Margins: m-2, m-4, m-8

**Container Widths:**
- Full-width sections: w-full with max-w-7xl
- Content areas: max-w-6xl
- Dashboard panels: max-w-4xl

## Component Library

### Navigation
- Fixed top navbar with logo, country selector toggle, pricing link
- Prominent "Get Number" CTA button in header
- Clean, minimal footer with links and trust indicators

### Hero Section (Landing Page)
- Compact hero (60vh) with bold headline
- Country flag toggles (France/USA) as primary CTAs
- Trust line: "10,000+ SMS received today" with live counter
- No background image - solid treatment with subtle gradient

### Number Selection Interface
- Grid layout: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Number cards with:
  - Large phone number display (text-2xl, monospace font)
  - Country flag icon
  - "Available Now" status badge
  - One-click copy button
  - "View Messages" link
- Real-time availability indicators

### SMS Dashboard
- Two-column layout: number list (left 30%) + message panel (right 70%)
- Message cards showing:
  - Sender number
  - Timestamp (relative: "2 mins ago")
  - Message preview/full text
  - Auto-refresh indicator
- Empty state: "Waiting for messages..." with animation

### Pricing Section
- Three-column pricing cards (stack on mobile)
- Cards show: duration, price, savings badge
- Clear feature bullets per plan
- Primary CTA on recommended plan (30-day)
- Visual hierarchy: recommended plan elevated with shadow

### Payment Flow
- Single-page checkout with Stripe integration
- Clear summary: selected number, plan, total
- Trust badges: secure payment icons
- Immediate confirmation with dashboard access

### Trust Elements
- "SMS received in < 30s" with clock icon
- "No signup required" badge
- "Auto-cancel, no hidden fees" guarantee
- Social proof counter

## Images

**Hero Section:** No large hero image - uses clean typography and gradient
**Trust Section:** Small icon illustrations for features (custom SVG or Heroicons)
**Payment Area:** Payment provider logos (Stripe, etc.)

## Animations

**Minimal Use Only:**
- Number copy: brief success checkmark animation
- New SMS arrival: subtle slide-in from top
- Loading states: simple spinner
- Page transitions: instant, no fancy effects

## Forms & Inputs

- Rounded corners (rounded-lg)
- Clear focus states with outline
- Labels always visible above inputs
- Error messages inline, below field
- Large touch targets (min-h-12)

## Responsive Behavior

- Mobile: Single column, stacked layout, bottom-fixed CTA
- Tablet: Two-column grids where appropriate
- Desktop: Three-column grids, side-by-side layouts

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation throughout
- Sufficient color contrast (WCAG AA minimum)
- Focus indicators on all clickable items
- Screen reader friendly number/message displays