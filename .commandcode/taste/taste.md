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

# backend
- Cache external API data (RSS feeds, OSM coordinates) with TTL and populate on server startup via `@app.on_event('startup')` to eliminate cold-start delays for users. Confidence: 0.70
