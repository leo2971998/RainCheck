# RainCheck weather-themed UI overhaul

## Goal
Turn the uploaded finance prototype into the working first screen of this project, preserving its forecasting, filtering, editing, comparison, and planning interactions while giving every screen a cohesive playful weather identity.

## Visual direction
- Use a bright “daily forecast” system: sky blue, cloud white, rain blue, sunshine yellow, mint green, and coral alerts.
- Replace the dark generic sidebar with a compact weather-station rail and recognizable RainCheck cloud/umbrella branding.
- Use friendly rounded typography, crisp financial numerals, small weather illustrations, and restrained motion.
- Keep data dense and trustworthy; weather language supports financial meaning rather than obscuring it.
- Make desktop and mobile layouts deliberate, including a compact bottom navigation on phones.

## Implementation
1. Port the uploaded sample household data and forecasting/option logic into client-safe TypeScript modules.
2. Build shared interface pieces for buttons, status labels, metric summaries, navigation, toggles, charts, alerts, and slide-over panels.
3. Recreate all six working views inside the home screen:
   - Dashboard: financial weather summary, balance outlook, detected changes, goal, alerts, income, and cash flow.
   - Forecast: interactive daily balance chart, event table, assumptions, and editable income.
   - Transactions: functional category/review filters and transaction table.
   - Recurring: bill overview, changed bill review, and electric-bill scenario controls.
   - Cash flow: monthly comparison and allowance bars.
   - Goals: progress, projections, contribution schedule, and option comparison.
4. Preserve the uploaded interactions: navigation, transaction filters, income editing, bill review, bill increase editing, protected allowances, option previews, plan confirmation, dismissible findings, and immediate forecast recalculation.
5. Add responsive table handling, accessible labels/focus states, reduced-motion behavior, and route metadata specific to RainCheck.
6. Verify the finished dashboard and key interactions at desktop and phone sizes.

## Technical details
- Keep TanStack Start routing and render RainCheck at `/`.
- Use the existing Tailwind v4 setup with semantic OKLCH tokens in the global stylesheet.
- Use Lucide icons and inline React/SVG charts; no backend is required because the upload uses sample data.
- Do not copy the archive’s `.git` metadata or unsupported Vite entry files.
