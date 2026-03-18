'use strict';

const { Kafka } = require('kafkajs');
require('dotenv').config();

const { optimizeBudget } = require('./strategies/budget-optimizer');
const { selectPlatforms, PLATFORM_SCORES } = require('./strategies/platform-selector');

const AGENT_ID = 'campaign-strategy-agent';
const AGENT_KEY = 'campaign-strategy';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPIC_IN = `agent.${AGENT_KEY}.in`;
const TOPIC_OUT = `agent.${AGENT_KEY}.out`;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function callOpenAI(prompt) {
  if (!OPENAI_API_KEY) return null;
  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.7,
    });
    return response.choices[0].message.content;
  } catch (err) {
    console.error(`[${AGENT_ID}] OpenAI error:`, err.message);
    return null;
  }
}

class Agent {
  constructor() {
    this.kafka = new Kafka({ clientId: AGENT_ID, brokers: KAFKA_BROKERS });
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: `${AGENT_ID}-group` });
  }

  async start() {
    await this.producer.connect();
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: TOPIC_IN, fromBeginning: false });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        let payload;
        try {
          payload = JSON.parse(message.value.toString());
        } catch (parseErr) {
          console.error(`[${AGENT_ID}] failed to parse message:`, parseErr.message);
          return;
        }
        console.log(`[${AGENT_ID}] received:`, payload.intent);
        const result = await this.process(payload);
        await this.producer.send({ topic: TOPIC_OUT, messages: [{ value: JSON.stringify(result) }] });
      },
    });
    console.log(`[${AGENT_ID}] running`);
  }

  async process(message) {
    const { intent, payload, correlation_id } = message;
    const base = { agent: AGENT_ID, intent, correlation_id, priority: 'normal', timestamp: new Date().toISOString() };

    try {
      switch (intent) {
        case 'plan_campaign':
          return { ...base, payload: await this.planCampaign(payload) };
        case 'optimize_budget':
          return { ...base, payload: this.optimizeBudgetHandler(payload) };
        case 'analyze_performance':
          return { ...base, payload: await this.analyzePerformance(payload) };
        case 'recommend_platforms':
          return { ...base, payload: this.recommendPlatforms(payload) };
        default:
          console.warn(`[${AGENT_ID}] unhandled intent: ${intent}`);
          return { ...base, intent: 'error', payload: { error: `unknown intent: ${intent}` } };
      }
    } catch (err) {
      console.error(`[${AGENT_ID}] process error:`, err.message);
      return { ...base, intent: 'error', payload: { error: err.message } };
    }
  }

  async planCampaign({ brand = 'Unknown Brand', objectives = [], budget = 1000, targetAudience = {}, duration = 30 }) {
    const platforms = selectPlatforms({ targetAudience, budget, objectives });
    const budgetAllocation = optimizeBudget({ totalBudget: budget, platforms });

    const contentCadence = {};
    platforms.forEach((p) => {
      const postsPerWeek = p === 'tiktok' ? 7 : p === 'instagram' ? 5 : p === 'x' ? 10 : 3;
      contentCadence[p] = { postsPerWeek, totalPosts: Math.round(postsPerWeek * (duration / 7)) };
    });

    let strategicRecommendations = `Focus on ${platforms.slice(0, 2).join(' and ')} for maximum reach within the $${budget} budget.`;

    const aiPrompt = `You are a marketing strategist. Create a brief campaign plan for:
Brand: ${brand}
Objectives: ${objectives.join(', ') || 'brand awareness'}
Budget: $${budget}
Target Audience: ${JSON.stringify(targetAudience)}
Duration: ${duration} days
Platforms selected: ${platforms.join(', ')}

Provide 3-4 concise strategic recommendations. Be specific and actionable.`;

    const aiResponse = await callOpenAI(aiPrompt);
    if (aiResponse) strategicRecommendations = aiResponse;

    return {
      brand,
      objectives,
      budget,
      duration,
      platforms,
      budgetAllocation,
      contentCadence,
      strategicRecommendations,
      estimatedReach: Math.round(budget * 150),
    };
  }

  optimizeBudgetHandler({ budget, platforms = [], performanceHistory = {} }) {
    if (!budget || !platforms.length) throw new Error('budget and platforms are required');
    const allocation = optimizeBudget({ totalBudget: budget, platforms, performanceHistory });
    const recommendations = platforms.map((p) => {
      const history = performanceHistory[p];
      if (history && history.roi < 0.5) return `Consider reducing spend on ${p} (ROI: ${history.roi})`;
      if (history && history.roi > 2) return `Increase investment in ${p} (high ROI: ${history.roi})`;
      return null;
    }).filter(Boolean);

    return { budget, allocation, recommendations, optimizedAt: new Date().toISOString() };
  }

  async analyzePerformance({ campaignId, metrics = {} }) {
    if (!campaignId) throw new Error('campaignId is required');

    const { impressions = 0, clicks = 0, conversions = 0, spend = 0, revenue = 0 } = metrics;
    const ctr = impressions > 0 ? (clicks / impressions * 100).toFixed(2) : 0;
    const conversionRate = clicks > 0 ? (conversions / clicks * 100).toFixed(2) : 0;
    const roi = spend > 0 ? ((revenue - spend) / spend * 100).toFixed(2) : 0;
    const cpc = clicks > 0 ? (spend / clicks).toFixed(2) : 0;
    const cpa = conversions > 0 ? (spend / conversions).toFixed(2) : 0;

    const insights = [];
    if (parseFloat(ctr) < 1) insights.push({ type: 'warning', message: 'CTR below 1% — consider refreshing ad creative' });
    if (parseFloat(conversionRate) < 2) insights.push({ type: 'warning', message: 'Conversion rate below 2% — review landing page' });
    if (parseFloat(roi) > 100) insights.push({ type: 'success', message: `Excellent ROI of ${roi}% — scale this campaign` });
    if (parseFloat(roi) < 0) insights.push({ type: 'alert', message: 'Negative ROI — pause and review targeting' });

    const aiPrompt = `Analyze these campaign metrics and provide 3 actionable insights:
Campaign ID: ${campaignId}
Impressions: ${impressions}
Clicks: ${clicks} (CTR: ${ctr}%)
Conversions: ${conversions} (CVR: ${conversionRate}%)
Spend: $${spend}
Revenue: $${revenue} (ROI: ${roi}%)
CPC: $${cpc}, CPA: $${cpa}

Be specific and actionable.`;

    const aiInsights = await callOpenAI(aiPrompt);

    return { campaignId, metrics: { impressions, clicks, conversions, spend, revenue }, computed: { ctr, conversionRate, roi, cpc, cpa }, insights, aiInsights };
  }

  recommendPlatforms({ targetAudience = {}, budget = 0, objectives = [] }) {
    const platforms = selectPlatforms({ targetAudience, budget, objectives });
    const recommendations = platforms.map((name) => ({
      platform: name,
      score: PLATFORM_SCORES[name] || {},
      rationale: `${name} offers strong ${PLATFORM_SCORES[name]?.engagement > 0.7 ? 'engagement' : 'reach'} for your target audience`,
    }));
    return { platforms, recommendations, budget, objectives };
  }

  async stop() {
    await this.consumer.disconnect();
    await this.producer.disconnect();
  }
}

const agent = new Agent();
agent.start().catch(console.error);
process.on('SIGTERM', () => agent.stop().then(() => process.exit(0)));
process.on('SIGINT', () => agent.stop().then(() => process.exit(0)));
module.exports = Agent;
