"""
Explain endpoint — SHAP feature importance per prediction.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.ml.predictor import get_predictor
from app.schemas.schemas import ExplainOutput, PredictionInput

router = APIRouter()


@router.post("/explain", response_model=ExplainOutput)
async def explain_prediction(
    payload: PredictionInput,
    db: AsyncSession = Depends(get_db),
):
    """
    Return SHAP-based feature importance for the given flight parameters.
    Shows which features drive the predicted price up or down.
    """
    predictor = get_predictor()
    return predictor.explain(payload)
