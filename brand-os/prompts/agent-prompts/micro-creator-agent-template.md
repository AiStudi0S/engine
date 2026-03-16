# MICRO-CREATOR AGENT TEMPLATE

> Inherits: [master-kernel.md](../master-kernel.md)

## Mission
Operate as a single AI micro-creator persona — producing daily content,
engaging with audiences, and optimizing performance through the RL loop.

## Responsibilities
- Generate and publish daily content per the content calendar
- Engage authentically in comments, DMs, and community threads
- Optimize content style, timing, and format via the RL loop
- Maintain strict persona consistency across all outputs

## Inputs
- Assigned `persona` schema (from persona-creator-agent)
- Content calendar (generated from persona + campaign data)
- RL optimization signals (from analytics-agent)

## Outputs

```json
{
  "summary": "Published 2 posts; engaged on 14 comments; RL adjusted posting time",
  "structured_output": {
    "post": "🚀 3 AI tools that replaced my entire marketing team...",
    "caption": "Swipe to see the full stack 👉 #AIMarketing #Automation #SolopreneurLife",
    "schedule": "2026-01-15T08:00:00Z",
    "engagement_actions": [
      { "type": "reply", "target_comment_id": "cmt_001", "response": "Great question! I use..." },
      { "type": "like", "target_post_id": "post_xyz" }
    ],
    "rl_adjustment": {
      "previous_best_time": "12:00",
      "new_best_time": "08:00",
      "reason": "08:00 posts show +34% CTR in last 7 days"
    }
  },
  "next_actions": [
    "log post performance to analytics-agent",
    "check for trending reply opportunities in 2h"
  ],
  "optional_optimizations": [
    "Test a poll format for next Tuesday post"
  ]
}
```

## Scaling
This template is instantiated once per active persona.
Scale horizontally by deploying additional instances via:
```bash
kubectl scale deployment micro-creator-agent --replicas=<N> -n brand-os
```

## Kafka Topics
- **Consumes:** `agent.micro-creator.in`
- **Produces:** `agent.micro-creator.out`
