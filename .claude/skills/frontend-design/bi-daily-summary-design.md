# Bi-Daily Summary Component - Design Documentation

## Aesthetic Direction: **Editorial Premium**

Inspired by high-end financial publications like Bloomberg Businessweek and The Economist, combined with the existing Terminal Noir dark aesthetic. The design emphasizes:

- **Magazine-quality typography** with clear hierarchies
- **Sophisticated spacing** that breathes luxury
- **Subtle animations** that feel refined, not flashy
- **Data visualization** that prioritizes clarity and elegance
- **Editorial layout** with asymmetric accents and decorative elements

## Key Design Features

### 1. **Masthead Header**
```
[Accent bar] —————— สรุปตลาดรายวัน —————— [Gradient fade]
```
- Thin teal accent bar on left (12px)
- Bold Sora font title
- Gradient fade extending to right edge
- Creates instant visual anchor

### 2. **Summary Cards - Magazine Layout**

Each card features:

**Top Badge Area:**
- Time emoji (🌅 morning / 🌆 evening)
- Monospace timestamp in corner
- Floating glass badge with backdrop blur

**Header Section:**
- Dual gradient accent lines framing "สรุปตลาดเช้า/เย็น"
- Thai date in Sora font
- Article count in corner (subtle)

**Content Hierarchy:**

1. **Analysis Text** - Editorial prose style
   - DM Sans font, generous line-height (1.6)
   - Foreground color at 95% opacity for readability
   - Full Thai text preserving all paragraphs

2. **Market Data Grid** - Two-column layout

   Left: **Coin Prices**
   - Vertical list with colored accent bars
   - Hover effect brightens the bar
   - Monospace typography (JetBrains Mono)
   - Green/red indicators based on change

   Right: **Market Metrics**
   - Large-format Market Cap display
   - Fear & Greed Index with:
     - Contextual emoji (🔴🟠🟡🟢)
     - Large number (2xl)
     - Animated gradient bar showing position
     - Color transitions: red → yellow → green

3. **Headlines Section** - Dual-column magazine grid
   - Numbered with leading zeros (01, 02, etc.)
   - Accent color on hover for both number and title
   - Source attribution in tiny mono caps
   - Click target extends full width
   - Max 8 headlines shown

### 3. **Micro-interactions**

- **Card hover**: Subtle shadow expansion + accent corner glow fade-in
- **Headline hover**: Number and title color shift to teal
- **Price bars**: Width transition on hover (30% → 60% opacity)
- **Load animation**: Staggered fade-up (60ms delay per card)
- **Shimmer skeleton**: For loading states

### 4. **Visual Details**

**Glass Morphism:**
- Background: `from-card/90 via-card/70 to-surface/80`
- Backdrop blur: 20px
- Border: `border/40` with hover state `accent/30`

**Decorative Elements:**
- Corner accent gradient (top-right)
- Bottom accent line (horizontal gradient)
- Vertical accent bars on price indicators
- Dual divider lines around section headers

**Typography Scale:**
- Section header: 2xl Sora (bold)
- Card time labels: 10px uppercase (0.2em tracking)
- Analysis text: Base DM Sans (leading-relaxed)
- Prices: Mono varying sizes (sm → 2xl)
- Headlines: sm DM Sans

### 5. **Responsive Behavior**

**Desktop (lg+):**
- Full two-column grid for prices/metrics
- Dual-column headline layout
- Generous padding (8)

**Mobile:**
- Single column stacking
- Reduced padding (6)
- Headlines remain in single column
- All data remains visible, just rearranged

## Color Palette Application

Using existing Terminal Noir variables:

- **Primary Accent**: `hsl(180 100% 45%)` - Teal for highlights
- **Background**: `hsl(240 10% 3.5%)` - Deep charcoal
- **Card**: `hsl(240 8% 7%)` - Slightly lighter charcoal
- **Surface**: `hsl(240 8% 10%)` - Mid-tone for nested areas
- **Border**: `hsl(240 8% 14%)` - Subtle separation
- **Bullish**: `hsl(160 90% 50%)` - Green
- **Bearish**: `hsl(0 85% 55%)` - Red

**Opacity Layers:**
- Text: 95% foreground for readability
- Borders: 40% → 30% for subtlety
- Accents: 40% → 60% on hover
- Backgrounds: 20% → 90% for depth

## Technical Implementation

**React Patterns:**
- Client component with `useEffect` data fetching
- Loading skeleton states
- Empty state handling
- Type-safe props from Prisma schema

**Performance:**
- CSS-only animations (no JS libraries)
- Backdrop blur supported by modern browsers
- Graceful degradation for older browsers
- respects `prefers-reduced-motion`

**Accessibility:**
- Semantic HTML structure
- Proper heading hierarchy
- Link targets with external indicators
- Color contrast ratios meet WCAG AA
- Keyboard navigation friendly

## Files Created

1. `/components/bi-daily-summary.tsx` - Main component
2. `/app/api/summaries/route.ts` - API endpoint
3. `/app/page.tsx` - Updated to include section
4. `/app/globals.css` - Added animations

## Visual Flow

```
Page Load
  ↓
Staggered fade-up (prices → overview → summaries → feed)
  ↓
Summary cards appear with 60ms stagger
  ↓
User hovers card
  ↓
Corner accent fades in + shadow expands
  ↓
User hovers headline
  ↓
Number and title color shift to teal
  ↓
User clicks → Opens in new tab
```

## Why This Works

1. **Fits the aesthetic**: Dark, premium, technical (Terminal Noir)
2. **Distinct but cohesive**: Magazine layout stands out but uses same design language
3. **Information density**: Shows all data without overwhelming
4. **Thai-first**: Respects Thai typography and language flow
5. **Delightful**: Subtle animations reward interaction
6. **Production-ready**: Type-safe, performant, accessible

The design elevates the crypto news feed from "data display" to "editorial publication" — exactly what premium users expect when checking market summaries.
