'use strict';

const { Kafka } = require('kafkajs');
const { generateCalendar } = require('./content-calendar');
require('dotenv').config();

const AGENT_ID = 'micro-creator-agent';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPIC_IN = `agent.${AGENT_ID}.in`;
const TOPIC_OUT = `agent.${AGENT_ID}.out`;

class MicroCreatorAgent {
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
        const payload = JSON.parse(message.value.toString());
        console.log(`[${AGENT_ID}] received:`, payload.intent);
        const result = await this.process(payload);
        await this.producer.send({ topic: TOPIC_OUT, messages: [{ value: JSON.stringify(result) }] });
      },
    });
    console.log(`[${AGENT_ID}] running`);
  }

  async process(message) {
    const { intent, payload } = message;
    if (intent === 'generate_calendar') {
      const calendar = generateCalendar(payload);
      return { agent: AGENT_ID, intent: 'calendar_generated', payload: { calendar }, priority: 'normal', timestamp: new Date().toISOString() };
    }
    return { agent: AGENT_ID, intent: 'noop', payload: {}, priority: 'low', timestamp: new Date().toISOString() };
  }

  async stop() {
    await this.consumer.disconnect();
    await this.producer.disconnect();
  }
}

const agent = new MicroCreatorAgent();
agent.start().catch(console.error);
process.on('SIGTERM', () => agent.stop().then(() => process.exit(0)));
process.on('SIGINT', () => agent.stop().then(() => process.exit(0)));
module.exports = MicroCreatorAgent;
