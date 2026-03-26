"""Kafka consumer for AI Engine — processes agent.ai-engine.in messages."""
from __future__ import annotations

import json
import logging
import os
import threading
from typing import Any

logger = logging.getLogger(__name__)


def start_kafka_consumer() -> threading.Thread:
    """Start the Kafka consumer in a background thread and return the background thread."""
    kafka_brokers = os.getenv("KAFKA_BROKERS", "localhost:9092")

    def _run() -> None:
        import asyncio

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            from kafka import KafkaConsumer, KafkaProducer  # type: ignore

            consumer = KafkaConsumer(
                "agent.ai-engine.in",
                bootstrap_servers=kafka_brokers.split(","),
                group_id="ai-engine-group",
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                auto_offset_reset="latest",
                enable_auto_commit=True,
            )
            producer = KafkaProducer(
                bootstrap_servers=kafka_brokers.split(","),
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            )
            logger.info("AI Engine Kafka consumer started on agent.ai-engine.in")

            for message in consumer:
                try:
                    payload = message.value
                    intent = payload.get("intent")
                    data = payload.get("payload", {})
                    correlation_id = payload.get("correlation_id")
                    logger.info("AI Engine received intent: %s", intent)

                    result = _process_intent(intent, data)

                    response = {
                        "agent": "ai-engine",
                        "intent": intent,
                        "payload": result,
                        "correlation_id": correlation_id,
                        "priority": "normal",
                    }
                    producer.send("agent.ai-engine.out", response)
                    # Do not flush per-message — let the producer batch for throughput.
                    # Flushing happens on shutdown (finally block).
                except Exception as exc:
                    logger.error("AI Engine message processing error: %s", exc)

        except Exception as exc:
            logger.warning("AI Engine Kafka consumer failed to start: %s", exc)
        finally:
            try:
                producer.flush()
            except Exception:
                pass
            loop.close()

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return thread


def _process_intent(intent: str, data: dict[str, Any]) -> dict[str, Any]:
    """Dispatch intent to appropriate agent using the calling thread's event loop."""
    import asyncio

    loop = asyncio.get_event_loop()

    if intent == "generate_copy":
        from .agents.ad_copy_generator import AdCopyGenerator
        from .main import CopyRequest

        req = CopyRequest(
            product=data.get("product", ""),
            audience=data.get("audience", "general"),
            tone=data.get("tone", "professional"),
            platforms=data.get("platforms", []),
            variations=data.get("variations", 3),
        )
        generator = AdCopyGenerator()
        copies = loop.run_until_complete(generator.generate(req))
        return {"copies": copies, "model": generator.model_name}

    if intent == "match_audience":
        from .agents.audience_matcher import AudienceMatcher
        from .main import AudienceRequest

        req = AudienceRequest(
            campaignId=data.get("campaignId", ""),
            productDescription=data.get("productDescription", ""),
            existingCustomers=data.get("existingCustomers", []),
        )
        matcher = AudienceMatcher()
        result = loop.run_until_complete(matcher.match(req))
        return result.model_dump()

    if intent == "predict_performance":
        from .agents.performance_predictor import PerformancePredictor
        from .main import PredictionRequest

        req = PredictionRequest(
            campaignId=data.get("campaignId", ""),
            adCopy=data.get("adCopy", ""),
            audienceSegment=data.get("audienceSegment", {}),
            platform=data.get("platform", "instagram"),
            budget=float(data.get("budget", 1000)),
        )
        predictor = PerformancePredictor()
        result = loop.run_until_complete(predictor.predict(req))
        return result.model_dump()

    return {"error": f"unknown intent: {intent}"}
