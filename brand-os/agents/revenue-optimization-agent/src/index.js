'use strict';

const { Kafka } = require('kafkajs');
require('dotenv').config();

const { analyzeFunnel } = require('./optimizers/funnel-analyzer');

const AGENT_ID = 'revenue-optimization-agent';
const AGENT_KEY = 'revenue-optimization';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPIC_IN = `agent.${AGENT_KEY}.in`;
const TOPIC_OUT = `agent.${AGENT_KEY}.out`;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TIME_DECAY_FACTOR = 0.7;

async function callOpenAI(prompt, jsonMode = false) {
  if (!OPENAI_API_KEY) return null;
  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: OPENAI_API_KEY });
    const opts = { model: 'gpt-4o', messages: [{ role: 'user', content: prompt }], max_tokens: 800, temperature: 0.6 };
    if (jsonMode) opts.response_format = { type: 'json_object' };
    const response = await client.chat.completions.create(opts);
    const text = response.choices[0].message.content;
    return jsonMode ? JSON.parse(text) : text;
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
        try { payload = JSON.parse(message.value.toString()); }
        catch (parseErr) { console.error(`[${AGENT_ID}] parse error:`, parseErr.message); return; }
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
        case 'analyze_funnel': return { ...base, payload: await this.analyzeFunnelHandler(payload) };
        case 'optimize_pricing': return { ...base, payload: await this.optimizePricing(payload) };
        case 'identify_upsells': return { ...base, payload: await this.identifyUpsells(payload) };
        case 'attribution_report': return { ...base, payload: this.attributionReport(payload) };
        default:
          console.warn(`[${AGENT_ID}] unhandled intent: ${intent}`);
          return { ...base, intent: 'error', payload: { error: `unknown intent: ${intent}` } };
      }
    } catch (err) {
      console.error(`[${AGENT_ID}] error:`, err.message);
      return { ...base, intent: 'error', payload: { error: err.message } };
    }
  }

  async analyzeFunnelHandler({ stages = [], campaignId }) {
    if (!stages.length) throw new Error('stages array is required');
    const analysis = analyzeFunnel({ stages });

    let aiInsights = null;
    if (analysis.dropOffPoints.length > 0) {
      aiInsights = await callOpenAI(
        `Analyze this marketing funnel and suggest improvements:\nConversion Rate: ${analysis.conversionRate}%\nDrop-off Points: ${JSON.stringify(analysis.dropOffPoints)}\n\nProvide 3 specific optimization strategies.`
      );
    }

    return { campaignId, ...analysis, aiInsights, analyzedAt: new Date().toISOString() };
  }

  async optimizePricing({ currentPrice, competitorPrices = [], conversionRate, elasticity, productType }) {
    if (currentPrice == null || typeof currentPrice !== 'number' || Number.isNaN(currentPrice)) {
      throw new Error('currentPrice must be a valid number');
    }

    const avgCompetitor = competitorPrices.length > 0
      ? competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length
      : currentPrice;

    const prompt = `Recommend optimal pricing strategy for:
Current Price: $${currentPrice}
Competitor Average: $${avgCompetitor}
Conversion Rate: ${conversionRate || 'unknown'}%
Price Elasticity: ${elasticity || 'unknown'}
Product Type: ${productType || 'general'}

Return JSON: { recommended_price, price_range: { min, max }, strategy, rationale, expected_impact }`;

    const aiResult = await callOpenAI(prompt, true);

    const fallback = {
      recommended_price: avgCompetitor * 0.95,
      price_range: { min: avgCompetitor * 0.8, max: avgCompetitor * 1.1 },
      strategy: 'competitive',
      rationale: 'Price slightly below competitor average to gain market share',
      expected_impact: 'Estimated 10-15% conversion lift',
    };

    return { currentPrice, competitorAverage: avgCompetitor, ...(aiResult || fallback), analyzedAt: new Date().toISOString() };
  }

  async identifyUpsells({ productId, purchaseHistory = [], customerSegment, averageOrderValue }) {
    if (!productId) throw new Error('productId is required');

    const prompt = `Identify upsell and cross-sell opportunities for:
Product ID: ${productId}
Customer Segment: ${customerSegment || 'general'}
Average Order Value: $${averageOrderValue || 0}
Purchase History: ${JSON.stringify(purchaseHistory.slice(0, 5))}

Return JSON: { upsells: [{ type, title, description, estimated_value, priority }], cross_sells: [], bundle_opportunities: [] }`;

    const aiResult = await callOpenAI(prompt, true);

    const fallback = {
      upsells: [
        { type: 'premium_upgrade', title: 'Premium Plan', description: 'Upgrade to premium for advanced features', estimated_value: averageOrderValue * 2 || 100, priority: 'high' },
      ],
      cross_sells: [],
      bundle_opportunities: [],
    };

    return { productId, ...(aiResult || fallback), analyzedAt: new Date().toISOString() };
  }

  attributionReport({ campaignId, touchpoints = [], conversionValue = 0 }) {
    if (!campaignId) throw new Error('campaignId is required');
    if (!touchpoints.length) return { campaignId, message: 'No touchpoints provided', attribution: {} };

    const totalTouchpoints = touchpoints.length;
    const attribution = {
      first_touch: {},
      last_touch: {},
      linear: {},
      time_decay: {},
    };

    attribution.first_touch[touchpoints[0].channel] = conversionValue;
    attribution.last_touch[touchpoints[totalTouchpoints - 1].channel] = conversionValue;

    const linearValue = conversionValue / totalTouchpoints;
    touchpoints.forEach((tp) => {
      attribution.linear[tp.channel] = (attribution.linear[tp.channel] || 0) + linearValue;
    });

    // Time-decay: more weight to recent touchpoints
    const weights = touchpoints.map((_, i) => Math.pow(TIME_DECAY_FACTOR, totalTouchpoints - i - 1));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    touchpoints.forEach((tp, i) => {
      const value = (weights[i] / totalWeight) * conversionValue;
      attribution.time_decay[tp.channel] = (attribution.time_decay[tp.channel] || 0) + value;
    });

    const topChannel = Object.entries(attribution.linear)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'unknown';

    return { campaignId, conversionValue, totalTouchpoints, attribution, topChannel, generatedAt: new Date().toISOString() };
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
