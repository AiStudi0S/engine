'use strict';

const { Kafka } = require('kafkajs');
const axios = require('axios');
require('dotenv').config();

const AGENT_ID = 'distribution-agent';
const AGENT_KEY = 'distribution';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPIC_IN = `agent.${AGENT_KEY}.in`;
const TOPIC_OUT = `agent.${AGENT_KEY}.out`;
const DISTRIBUTION_SERVICE_URL = process.env.DISTRIBUTION_SERVICE_URL || 'http://distribution-service:3005';

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
        case 'publish_content':
          return { ...base, payload: await this.publishContent(payload) };
        case 'schedule_content':
          return { ...base, payload: await this.scheduleContent(payload) };
        case 'retry_failed':
          return { ...base, payload: await this.retryFailed(payload) };
        case 'get_status':
          return { ...base, payload: await this.getStatus(payload) };
        default:
          console.warn(`[${AGENT_ID}] unhandled intent: ${intent}`);
          return { ...base, intent: 'error', payload: { error: `unknown intent: ${intent}` } };
      }
    } catch (err) {
      console.error(`[${AGENT_ID}] process error:`, err.message);
      return { ...base, intent: 'error', payload: { error: err.message } };
    }
  }

  async publishContent({ campaignId, content, platforms }) {
    if (!campaignId || !content || !platforms?.length) {
      throw new Error('campaignId, content, and platforms are required');
    }
    const response = await axios.post(`${DISTRIBUTION_SERVICE_URL}/api/distribute`, { campaignId, content, platforms }, { timeout: 30000 });
    return response.data;
  }

  async scheduleContent({ campaignId, content, platforms, scheduledAt }) {
    if (!campaignId || !content || !platforms?.length || !scheduledAt) {
      throw new Error('campaignId, content, platforms, and scheduledAt are required');
    }
    const schedulerUrl = process.env.SCHEDULER_SERVICE_URL || 'http://scheduler-service:3003';
    const response = await axios.post(`${schedulerUrl}/api/schedules`, {
      type: 'publish_campaign',
      payload: { campaignId, content, platforms },
      scheduledAt,
    }, { timeout: 15000 });
    return { scheduled: true, job: response.data, campaignId, platforms, scheduledAt };
  }

  async retryFailed({ campaignId, platforms, content }) {
    if (!campaignId) throw new Error('campaignId is required');
    if (!content || typeof content !== 'object' || Object.keys(content).length === 0) {
      throw new Error('content is required for retry — provide the original post content');
    }
    const targetPlatforms = platforms || [];
    const results = [];
    for (const platform of targetPlatforms) {
      try {
        const r = await axios.post(`${DISTRIBUTION_SERVICE_URL}/api/distribute`, {
          campaignId, content, platforms: [platform],
        }, { timeout: 30000 });
        results.push({ platform, status: 'retried', result: r.data });
      } catch (err) {
        results.push({ platform, status: 'retry_failed', error: err.message });
      }
    }
    return { campaignId, retryResults: results };
  }

  async getStatus({ postId }) {
    if (!postId) throw new Error('postId is required');
    const response = await axios.get(`${DISTRIBUTION_SERVICE_URL}/api/distribute/${postId}/status`, { timeout: 10000 });
    return response.data;
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
