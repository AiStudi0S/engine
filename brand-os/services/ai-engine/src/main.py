"""AI Automation Engine — FastAPI application."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    """Application lifespan handler."""
    print("AI Engine starting up...")
    yield
    print("AI Engine shutting down...")


app = FastAPI(
    title="Brand OS AI Engine",
    description="AI Automation Engine for ad copy, audience matching, and performance prediction",
    version="1.0.0",
    lifespan=lifespan,
)


class CopyRequest(BaseModel):
    product: str
    audience: str
    tone: str = "professional"
    platforms: list[str] = []
    variations: int = 3


class CopyResponse(BaseModel):
    copies: list[str]
    metadata: dict[str, Any] = {}


class AudienceRequest(BaseModel):
    campaign_id: str
    product_description: str
    existing_customers: list[dict[str, Any]] = []


class AudienceResponse(BaseModel):
    segments: list[dict[str, Any]]
    recommended_targeting: dict[str, Any]


class PredictionRequest(BaseModel):
    campaign_id: str
    ad_copy: str
    audience_segment: dict[str, Any]
    platform: str
    budget: float


class PredictionResponse(BaseModel):
    predicted_ctr: float
    predicted_conversions: int
    predicted_roi: float
    confidence: float


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-engine"}


@app.post("/api/copy/generate", response_model=CopyResponse)
async def generate_ad_copy(req: CopyRequest) -> CopyResponse:
    """Generate ad copy variations using LLM."""
    from .agents.ad_copy_generator import AdCopyGenerator

    generator = AdCopyGenerator()
    copies = await generator.generate(req)
    return CopyResponse(copies=copies, metadata={"model": generator.model_name})


@app.post("/api/audience/match", response_model=AudienceResponse)
async def match_audience(req: AudienceRequest) -> AudienceResponse:
    """Match campaign to optimal audience segments."""
    from .agents.audience_matcher import AudienceMatcher

    matcher = AudienceMatcher()
    result = await matcher.match(req)
    return result


@app.post("/api/performance/predict", response_model=PredictionResponse)
async def predict_performance(req: PredictionRequest) -> PredictionResponse:
    """Predict campaign performance metrics."""
    from .agents.performance_predictor import PerformancePredictor

    predictor = PerformancePredictor()
    result = await predictor.predict(req)
    return result
