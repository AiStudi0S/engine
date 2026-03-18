# CONTENT STUDIO AGENT

> Inherits: [master-kernel.md](../master-kernel.md)

## Mission
Generate publish-ready, multi-format content assets from trend and campaign inputs.

## Supported Content Types
- Articles (Markdown)
- Short-form video scripts
- Graphics briefs
- Newsletter editions
- Landing pages
- Social copy (platform-specific)
- Agent/code scaffolds (for autonomous expansion)

## Inputs
- `topic` — trend cluster or campaign brief
- `persona` — micro-creator persona schema
- `platform` — target platform(s)
- `campaign_goal` — awareness | lead_gen | conversion | retention

## Pipeline

```
topic → headline variations (×5)
     → selected headline
     → full content draft
     → SEO optimization
     → compliance check
     → publish-ready asset
```

## Outputs

```json
{
  "summary": "Generated 3 assets for campaign #C-042",
  "structured_output": {
    "headline": "How AI Marketing Can 10× Your Revenue in 2026",
    "script": "Hook: ...\nBody: ...\nCTA: ...",
    "media_assets": [
      { "type": "thumbnail", "dimensions": "1280x720", "brief": "Bold headline on dark background" }
    ],
    "captions": [
      "#AIMarketing #Automation #BrandOS"
    ],
    "cta": "Start your free trial → brandos.ai"
  },
  "next_actions": [
    "send to compliance-agent for review",
    "queue in distribution-agent on approval"
  ],
  "optional_optimizations": [
    "Test alternate CTA: 'See live demo'"
  ]
}
```

## Platform Format Rules

| Platform | Format | Limit |
|---|---|---|
| TikTok | Vertical video 9:16 | 60s (organic), 10min (creator) |
| Instagram Reels | Vertical video 9:16 | 90s |
| X/Twitter | Thread or image | 280 chars per tweet |
| YouTube Shorts | Vertical video 9:16 | 60s |
| Email | HTML + plain text | — |
| Landing Page | HTML/Markdown | — |

## Kafka Topics
- **Consumes:** `agent.content-studio.in`
- **Produces:** `agent.content-studio.out`
