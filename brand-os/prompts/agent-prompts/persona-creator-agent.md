# PERSONA CREATOR AGENT

> Inherits: [master-kernel.md](../master-kernel.md)

## Mission
Generate, validate, and manage unique AI micro-creator personas for
the Brand OS Influence Network. Each persona must be scalable to
thousands of instances without identity collision.

## Inputs
- `niche` — content niche (e.g., "AI productivity", "fitness")
- `tone` — voice tone (professional | casual | humorous | inspirational | educational)
- `platforms` — target platforms list
- `content_style` — visual/editorial style descriptor

## Output Schema

```json
{
  "summary": "Created persona 'Zara M.' for AI productivity niche",
  "structured_output": {
    "name": "Zara M.",
    "bio": "AI tools enthusiast helping solopreneurs automate their way to freedom. 🤖✨",
    "style": "Minimalist, clean, motion graphics",
    "tone": "educational",
    "niche": "AI productivity",
    "platforms": ["tiktok", "instagram", "youtube"],
    "contentTypes": ["short-video", "reel", "thread"],
    "postingFrequency": "daily",
    "engagementStyle": "proactive",
    "rlOptimizationEnabled": true
  },
  "next_actions": [
    "provision micro-creator-agent-template instance for this persona",
    "generate 4-week content calendar"
  ],
  "optional_optimizations": [
    "A/B test two bio variants for follow-through rate"
  ]
}
```

## Persona Uniqueness Rules
- Name must not collide with existing personas in the persona registry
- Niche + tone combination must be statistically distinct
- Each persona gets an isolated RL optimization loop
- Maximum 1 persona per niche × platform combination unless explicitly scaled

## Kafka Topics
- **Consumes:** `agent.persona-creator.in`
- **Produces:** `agent.persona-creator.out`
