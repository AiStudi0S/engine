'use strict';

const { Kafka } = require('kafkajs');
const axios = require('axios');
require('dotenv').config();

const AGENT_ID = 'analytics-agent';
const AGENT_KEY = 'analytics';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPIC_IN = `agent.${AGENT_KEY}.in`;
const TOPIC_OUT = `agent.${AGENT_KEY}.out`;
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3004';

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
        case 'track_event':
          return { ...base, payload: await this.trackEvent(payload) };
        case 'generate_report':
          return { ...base, payload: await this.generateReport(payload) };
        case 'get_metrics':
          return { ...base, payload: await this.getMetrics(payload) };
        case 'compare_campaigns':
          return { ...base, payload: await this.compareCampaigns(payload) };
        default:
          console.warn(`[${AGENT_ID}] unhandled intent: ${intent}`);
          return { ...base, intent: 'error', payload: { error: `unknown intent: ${intent}` } };
      }
    } catch (err) {
      console.error(`[${AGENT_ID}] process error:`, err.message);
      return { ...base, intent: 'error', payload: { error: err.message } };
    }
  }

  async trackEvent({ campaignId, eventType, platform, value = 1, metadata = {} }) {
    if (!campaignId || !eventType) throw new Error('campaignId and eventType are required');
    const response = await axios.post(`${ANALYTICS_SERVICE_URL}/api/analytics/events`, {
      campaignId, eventType, platform: platform || 'unknown', value, metadata,
    }, { timeout: 10000 });
    return response.data;
  }

  async generateReport({ campaignId, days = 30 }) {
    if (!campaignId) throw new Error('campaignId is required');
    const [metricsRes, perfRes] = await Promise.all([
      axios.get(`${ANALYTICS_SERVICE_URL}/api/analytics/campaigns/${campaignId}/metrics`, { timeout: 10000 }),
      axios.get(`${ANALYTICS_SERVICE_URL}/api/analytics/campaigns/${campaignId}/performance?days=${days}`, { timeout: 10000 }),
    ]);
    const metrics = metricsRes.data;
    const performance = perfRes.data;
    const summary = {
      campaignId,
      period: `Last ${days} days`,
      totalImpressions: metrics.impressions || 0,
      totalClicks: metrics.clicks || 0,
      totalConversions: metrics.conversions || 0,
      totalRevenue: metrics.revenue || 0,
      totalSpend: metrics.spend || 0,
      ctr: metrics.ctr || 0,
      roi: metrics.roi || 0,
      trend: performance.timeSeries?.length > 0 ? 'data available' : 'insufficient data',
    };
    return { campaignId, report: summary, rawMetrics: metrics, timeSeries: performance.timeSeries };
  }

  async getMetrics({ campaignId }) {
    if (!campaignId) throw new Error('campaignId is required');
    const response = await axios.get(`${ANALYTICS_SERVICE_URL}/api/analytics/campaigns/${campaignId}/metrics`, { timeout: 10000 });
    return response.data;
  }

  async compareCampaigns({ campaignIds = [] }) {
    if (!campaignIds.length) throw new Error('campaignIds array is required');
    const results = await Promise.all(
      campaignIds.map(async (id) => {
        try {
          const r = await axios.get(`${ANALYTICS_SERVICE_URL}/api/analytics/campaigns/${id}/metrics`, { timeout: 10000 });
          return { campaignId: id, metrics: r.data };
        } catch {
          return { campaignId: id, metrics: null, error: 'failed to fetch metrics' };
        }
      })
    );
    const valid = results.filter((r) => r.metrics);
    let winner = null;
    if (valid.length > 0) {
      winner = valid.reduce((best, curr) => (curr.metrics.roi > (best.metrics.roi || 0) ? curr : best)).campaignId;
    }
    return { campaigns: results, winner, comparedAt: new Date().toISOString() };
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
