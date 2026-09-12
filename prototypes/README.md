# Prototypes

How RainCheck got to its current shape. These are static HTML files — open any of them
directly in a browser. None is part of the build.

| File | What it was |
| --- | --- |
| `dashboard.html` | The desktop dashboard the shipped app was built from. |
| `raincheck-mobile-weather.html` | Phone-first, weather metaphor. The original direction. |
| `safe-bet-gambling.html` | Casino theme, for the event's announced theme. |
| `table-stakes-poker.html` | Poker theme: blinds, raises, outs, the pot. |
| `design-canvas/` | The first screens as editable artboards (`.dc.html` plus `canvas.json`). |
| `figma-scripts/` | Figma Plugin API scripts that draw the same screens, for the Figma MCP `use_figma` tool. |

The engine in every prototype is the same idea as the shipped one: a day-by-day simulation
that everything on screen reads from.
