# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/


# code-style
- Do not use emojis in code, comments, or UI strings. Confidence: 0.85
- Code comments should explain why, not what. Confidence: 0.80

# ui
- Avoid AI buzzwords in UI text (e.g., "seamlessly integrates" → "shows", "leverage" → "use"). Confidence: 0.80

# domain
- Use Indian Rupees (₹) for all cost estimations. EV battery cost baseline is ₹15,000 per kWh. Confidence: 0.90

# llm
- LLM tool-calling agents must use strict data-routing prompts with `tool_choice='required'` and never generate conversational filler, personality, or hallucinated data. Confidence: 0.80

# ui-design
- Use monochrome premium visual design: `bg-gray-50/80 rounded-xl` cards without borders, `font-mono` for all numeric metrics, `text-[11px] uppercase tracking-wider` for labels, `tracking-tight` for headings. Use blue only for active states. Confidence: 0.75
- Prefer `divide-y divide-gray-50` list rows (`px-5 py-3.5 hover:bg-gray-50/50 transition-colors`) over spaced card layouts. Numeric risk/status badges with `font-mono px-2 py-0.5 rounded-full` are cleaner than inline progress bars inside list items. Confidence: 0.60

# backend
- Cache external API data (RSS feeds, OSM coordinates) with TTL and populate on server startup via `@app.on_event('startup')` to eliminate cold-start delays for users. Confidence: 0.70
- Use dedicated module files (e.g., analytics.py, operations.py, scheduler.py) for distinct backend concerns rather than bloating main.py; each module handles its own models, logic, and state with thread-safe locks when needed. Confidence: 0.65

# architecture
- Extract large inline JSX blocks (500+ lines) from App.tsx into separate component files. Use a navigable tab system with `role="tablist"`, `role="tab"`, and `aria-selected` for accessibility. Confidence: 0.70

# workflow
- After applying fixes, run `npm run build` to verify zero TypeScript errors before pushing. Confidence: 0.80
