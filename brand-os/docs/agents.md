# Brand OS Agent Swarm

## Overview

Brand OS runs a multi-agent swarm where specialized AI agents collaborate
via Kafka message passing to autonomously manage the full marketing lifecycle.

## Agents

### Brand Intelligence Agent
Continuously monitors market trends, competitor activity, and platform signals.

**Triggers:** Scheduled (every 4h) + on-demand
**Consumes:** `agent.brand-intelligence.in`
**Produces:** `agent.brand-intelligence.out`

### Content Studio Agent
Generates all content assets from trend inputs.

**Triggers:** `trends_analyzed` event from Brand Intelligence Agent
**Consumes:** `agent.content-studio.in`
**Produces:** `agent.content-studio.out`

### Campaign Strategy Agent
Designs multi-platform campaign strategies and budgets.

**Triggers:** `content_generated` event
**Consumes:** `agent.campaign-strategy.in`
**Produces:** `agent.campaign-strategy.out`

### Distribution Agent
Handles multi-platform publishing with rate limiting and compliance.

**Triggers:** `campaign_approved` event
**Consumes:** `agent.distribution.in`
**Produces:** `agent.distribution.out`

### Compliance Agent
Reviews all content and spend for policy compliance.

**Triggers:** Pre-publication (blocks distribution until approved)
**Consumes:** `agent.compliance.in`
**Produces:** `agent.compliance.out`

### Persona Creator Agent
Generates and manages AI micro-creator personas.

**Schema:** `/specs/persona-schema.json`

### Micro Creator Agent (×N)
Each instance manages a single AI persona's content calendar and posting.

**Scales:** Horizontally, one instance per active persona

## Running Agents

```bash
cd brand-os/agents/brand-intelligence-agent
npm install
npm start
```
