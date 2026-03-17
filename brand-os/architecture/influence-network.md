# AI Influence Network

## Overview

The Brand OS AI Influence Network consists of thousands of AI micro-creator
personas, each operating autonomously to grow a niche audience and funnel
traffic back to brand assets.

## Network Architecture

```
Persona Registry (PostgreSQL)
        │
        ├── Persona A (AI Productivity) ──▶ micro-creator-agent instance A
        ├── Persona B (Fitness)          ──▶ micro-creator-agent instance B
        ├── Persona C (Finance)          ──▶ micro-creator-agent instance C
        └── ... (×N)
```

Each persona instance is:
- Horizontally scaled in Kubernetes
- Isolated with its own RL optimization loop
- Publishing to its own platform accounts
- Feeding conversion traffic to shared brand funnels

## Persona Schema

```json
{
  "name": "string",
  "bio": "string (max 160 chars)",
  "style": "string",
  "tone": "professional|casual|humorous|inspirational|educational",
  "niche": "string",
  "platforms": ["tiktok", "instagram", "youtube", "x", "linkedin"],
  "contentTypes": ["short-video", "image-post", "reel", "article", "thread", "newsletter"],
  "postingFrequency": "daily|3x/week|weekly|bi-weekly",
  "engagementStyle": "replies-only|proactive|community-focused|minimal",
  "rlOptimizationEnabled": true
}
```

## Content Calendar

Each persona generates a 4-week rolling content calendar:

| Day | Platform | Content Type | Status |
|---|---|---|---|
| Mon | TikTok | Short video | scheduled |
| Mon | Instagram | Carousel | scheduled |
| Tue | YouTube | Short | pending |
| ... | ... | ... | ... |

Calendars are regenerated weekly by `persona-creator-agent` using:
- Current trend clusters (from brand-intelligence-agent)
- RL performance history (from analytics-agent)
- Campaign alignment (from campaign-strategy-agent)

## RL Loop per Persona

Each persona runs its own independent RL optimization loop:

```
publish post
    → observe: views, likes, comments, follows, click-throughs
    → reward: CTR + engagement - cost
    → adjust: posting time, content format, caption style
    → deploy: next post with updated parameters
```

## Scaling

The influence network scales horizontally. To add 100 new personas:

1. Generate 100 personas via `persona-creator-agent`
2. Kubernetes auto-scales `micro-creator-agent` deployment
3. Each instance picks up a persona from the registry queue

```bash
kubectl scale deployment micro-creator-agent --replicas=100 -n brand-os
```

## Compliance

All influence network content passes through `compliance-agent` before
publication. Personas cannot post without a `compliance_approved` signal.
