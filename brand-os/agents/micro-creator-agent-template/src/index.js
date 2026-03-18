'use strict';

const { Kafka } = require('kafkajs');
require('dotenv').config();

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const PERSONA_ID = process.env.PERSONA_ID;

if (!PERSONA_ID) {
  console.error('FATAL: PERSONA_ID environment variable is not set. Each micro-creator instance requires a unique PERSONA_ID.');
  process.exit(1);
}

const AGENT_ID = `micro-creator-agent-${PERSONA_ID}`;

/**
 * MicroCreatorAgentTemplate
 *
 * Instantiate one copy of this agent per active persona.
 * Set PERSONA_ID env var to the persona's registry ID.
 */
class MicroCreatorAgentTemplate {
  constructor() {
    this.kafka = new Kafka({ clientId: AGENT_ID, brokers: KAFKA_BROKERS });
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: `${AGENT_ID}-group` });
    this.persona = null;
  }

  async start() {
    await this.producer.connect();
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: 'agent.micro-creator.in', fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        let msg;
        try {
          msg = JSON.parse(message.value.toString());
        } catch (parseErr) {
          console.error(`[${AGENT_ID}] failed to parse message:`, parseErr.message);
          return;
        }
        if (!this._isMessageForThisPersona(msg)) return;
        const result = await this.process(msg);
        if (result) await this.emit(result);
      },
    });

    console.log(`[${AGENT_ID}] running`);
  }

  _isMessageForThisPersona(msg) {
    // Require explicit persona_id targeting; ignore broadcasts without one
    // to prevent all instances from processing the same message.
    if (!msg.payload || !msg.payload.persona_id) return false;
    return msg.payload.persona_id === PERSONA_ID;
  }

  async process(message) {
    const { intent, payload } = message;
    switch (intent) {
      case 'load_persona':
        this.persona = payload.persona;
        console.log(`[${AGENT_ID}] loaded persona: ${this.persona.name}`);
        return null;
      case 'publish_post':
        return this.publishPost(payload);
      case 'engage':
        return this.engage(payload);
      case 'optimize':
        return this.optimize(payload);
      default:
        console.warn(`[${AGENT_ID}] unknown intent: ${intent}`);
        return null;
    }
  }

  async publishPost(payload) {
    const { post, caption, schedule, platform } = payload;
    // TODO: delegate to distribution-agent via Kafka
    console.log(`[${AGENT_ID}] Publishing to ${platform}: ${(post || '').slice(0, 50)}...`);
    return {
      agent: AGENT_ID,
      intent: 'post_published',
      payload: {
        persona_id: PERSONA_ID,
        platform,
        post,
        caption,
        schedule,
        engagement_actions: [],
        published_at: new Date().toISOString(),
      },
      priority: 'normal',
      timestamp: new Date().toISOString(),
    };
  }

  async engage(payload) {
    const { actions = [] } = payload;
    console.log(`[${AGENT_ID}] Executing ${actions.length} engagement actions`);
    return {
      agent: AGENT_ID,
      intent: 'engagement_complete',
      payload: { persona_id: PERSONA_ID, actions_executed: actions.length },
      priority: 'low',
      timestamp: new Date().toISOString(),
    };
  }

  async optimize(payload) {
    const { rl_signal } = payload;
    console.log(`[${AGENT_ID}] Applying RL optimization:`, rl_signal);
    return {
      agent: AGENT_ID,
      intent: 'optimization_applied',
      payload: { persona_id: PERSONA_ID, rl_signal },
      priority: 'low',
      timestamp: new Date().toISOString(),
    };
  }

  async emit(message) {
    await this.producer.send({
      topic: 'agent.micro-creator.out',
      messages: [{ value: JSON.stringify(message) }],
    });
  }

  async stop() {
    await this.consumer.disconnect();
    await this.producer.disconnect();
  }
}

const agent = new MicroCreatorAgentTemplate();
agent.start().catch(console.error);

process.on('SIGTERM', () => agent.stop().then(() => process.exit(0)));
process.on('SIGINT', () => agent.stop().then(() => process.exit(0)));

module.exports = MicroCreatorAgentTemplate;
