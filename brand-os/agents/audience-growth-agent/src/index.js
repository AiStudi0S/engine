'use strict';

const { Kafka } = require('kafkajs');
require('dotenv').config();

const { optimizeSEO } = require('./growth/seo-optimizer');

const AGENT_ID = 'audience-growth-agent';
const AGENT_KEY = 'audience-growth';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPIC_IN = `agent.${AGENT_KEY}.in`;
const TOPIC_OUT = `agent.${AGENT_KEY}.out`;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function callOpenAI(prompt, jsonMode = false) {
  if (!OPENAI_API_KEY) return null;
  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: OPENAI_API_KEY });
    const opts = { model: 'gpt-4o', messages: [{ role: 'user', content: prompt }], max_tokens: 800, temperature: 0.7 };
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
        case 'optimize_seo': return { ...base, payload: await this.optimizeSEO(payload) };
        case 'find_keywords': return { ...base, payload: await this.findKeywords(payload) };
        case 'analyze_audience': return { ...base, payload: await this.analyzeAudience(payload) };
        case 'growth_recommendations': return { ...base, payload: await this.growthRecommendations(payload) };
        default:
          console.warn(`[${AGENT_ID}] unhandled intent: ${intent}`);
          return { ...base, intent: 'error', payload: { error: `unknown intent: ${intent}` } };
      }
    } catch (err) {
      console.error(`[${AGENT_ID}] error:`, err.message);
      return { ...base, intent: 'error', payload: { error: err.message } };
    }
  }

  async optimizeSEO({ content, targetKeywords = [], platform = 'web' }) {
    if (!content) throw new Error('content is required');
    const ruleBasedResult = optimizeSEO({ content, targetKeywords, platform });

    const aiSuggestions = await callOpenAI(
      `Analyze this content for SEO and provide 3-5 specific improvement suggestions:\n\nContent: "${content.slice(0, 500)}"\nTarget Keywords: ${targetKeywords.join(', ')}\nPlatform: ${platform}\n\nFormat: numbered list of actionable suggestions.`
    );

    return { ...ruleBasedResult, aiSuggestions, platform, analyzedAt: new Date().toISOString() };
  }

  async findKeywords({ topic, niche, count = 10 }) {
    if (!topic) throw new Error('topic is required');

    const defaultKeywords = [topic, `best ${topic}`, `${topic} guide`, `how to ${topic}`, `${topic} tips`];

    const aiResult = await callOpenAI(
      `Generate ${count} high-value SEO keywords for the topic "${topic}" in the "${niche || 'general'}" niche. Return JSON: { keywords: [{ keyword, search_volume_estimate: "low|medium|high", difficulty: "low|medium|high", intent: "informational|transactional|navigational" }] }`,
      true
    );

    const keywords = aiResult?.keywords || defaultKeywords.map((k) => ({ keyword: k, search_volume_estimate: 'medium', difficulty: 'medium', intent: 'informational' }));
    return { topic, niche, keywords, generatedAt: new Date().toISOString() };
  }

  async analyzeAudience({ description, demographics = {}, interests = [], platform }) {
    if (!description && !interests.length) throw new Error('description or interests are required');

    const prompt = `Analyze this audience and provide detailed insights:
Description: ${description || 'not provided'}
Demographics: ${JSON.stringify(demographics)}
Interests: ${interests.join(', ')}
Platform: ${platform || 'all platforms'}

Return JSON: { segments: [], characteristics: [], best_content_types: [], optimal_post_times: [], growth_potential: "low|medium|high" }`;

    const aiResult = await callOpenAI(prompt, true);

    const fallback = {
      segments: [{ name: 'Primary', size: 'medium', characteristics: [description || 'general audience'] }],
      characteristics: interests.length ? interests : ['broad interest'],
      best_content_types: ['video', 'infographics', 'blog posts'],
      optimal_post_times: ['9am-11am', '7pm-9pm'],
      growth_potential: 'medium',
    };

    return { ...(aiResult || fallback), analyzedAt: new Date().toISOString() };
  }

  async growthRecommendations({ currentMetrics = {}, targetAudience, industry, goals = [] }) {
    const prompt = `Provide 5 actionable growth strategy recommendations for:
Industry: ${industry || 'general'}
Target Audience: ${JSON.stringify(targetAudience || {})}
Goals: ${goals.join(', ') || 'grow audience'}
Current Metrics: ${JSON.stringify(currentMetrics)}

Return JSON: { recommendations: [{ title, description, priority: "high|medium|low", estimated_impact: "low|medium|high", timeframe }] }`;

    const aiResult = await callOpenAI(prompt, true);

    const fallback = {
      recommendations: [
        { title: 'Consistent Content Calendar', description: 'Post 3-5 times per week on primary platforms', priority: 'high', estimated_impact: 'high', timeframe: '30 days' },
        { title: 'Engage With Comments', description: 'Respond to all comments within 2 hours', priority: 'high', estimated_impact: 'medium', timeframe: '7 days' },
        { title: 'Hashtag Strategy', description: 'Use 5-10 targeted hashtags per post', priority: 'medium', estimated_impact: 'medium', timeframe: '14 days' },
      ],
    };

    return { ...(aiResult || fallback), generatedAt: new Date().toISOString() };
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
