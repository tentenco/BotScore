# Result Experience Design System

## Product intent

The result route is a durable, shareable product surface: `/{canonical-domain}`. It should answer three questions in order: What is the verdict? Which dimension caused it? What evidence should be acted on next?

## Visual language

- Atmosphere: calm diagnostic workspace, not a marketing dashboard. Warm off-white canvas, white evidence surfaces, black type, and restrained status colors.
- Typography: inherit the product's Inter and Noto Sans TC UI kit. Use large type only for the domain and overall score; supporting labels stay compact and direct.
- Shape: 12–20px radii for grouped surfaces, pills only for statuses and actions, 1px borders instead of ornamental shadows.
- Status color: green means strong, blue means stable, amber means a gap needs attention, red means a blocking issue, gray means insufficient evidence. Color never carries meaning without text or a number.

## Information hierarchy

1. Canonical domain, scan time, and share action.
2. One overall semicircle gauge with a named readiness level and evidence coverage.
3. Four circular pillar indicators with score, purpose, evaluated checks, and coverage.
4. Pass, review, issue, and unknown counts.
5. Narrative diagnosis, prioritized findings, and the complete evidence report.

## Interaction and responsive rules

- Share uses the native share sheet where available and clipboard fallback elsewhere.
- Interactive targets are at least 44px tall and have visible keyboard focus.
- Charts use one-time SVG progress reveals with synchronized number count-up; important values remain selectable text and have accessible final-value labels.
- Desktop keeps the overall verdict beside the four pillars. Tablet stacks the verdict above a 2×2 pillar grid. Mobile uses a single-column pillar list without horizontal scrolling.
- Overall score begins first, followed by pillar scores in a 110ms cascade. The motion uses a weighted ease-out, runs once, and never delays access to the underlying result.
- Live scans show a moving evidence pulse, eased progress changes, completed-stage confirmation, and one clearly marked active stage.
- `prefers-reduced-motion` bypasses all count-up and stroke animation, rendering final values immediately.
- Avoid looping score animation, gradients, fake interactivity, decorative widgets, and separate cards for every small metric.
