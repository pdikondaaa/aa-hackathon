"""Parking controller — parking sticker request management."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.auth.auth_handler import get_current_user
from app.api.services.parking_service import (
    get_parking_request,
    submit_parking_request,
    submit_deactivation_request,
)

router = APIRouter(prefix="/api/parking", tags=["Parking"])


class ParkingRequestBody(BaseModel):
    employee_id: str
    employee_name: str
    location: str
    category: str
    parking_option: Optional[str] = None   # monthly_aaspl | daily_fountainhead | monthly_fountainhead
    owner_name: str
    vehicle_reg_no: str
    vehicle_make: str
    vehicle_model: str
    sticker_required_date: str
    vehicle_photo_b64: Optional[str] = None


class DeactivationBody(BaseModel):
    request_id: int
    deactivation_date: str


@router.get("/request")
async def get_my_parking_request(current_user: dict = Depends(get_current_user)):
    """Return the employee's latest parking sticker request."""
    try:
        result = get_parking_request(current_user["email"])
        return result or {}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/request")
async def create_parking_request(
    req: ParkingRequestBody,
    current_user: dict = Depends(get_current_user),
):
    """Submit a new parking sticker application."""
    try:
        return submit_parking_request(current_user["email"], req.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/deactivate")
async def deactivate_parking(
    req: DeactivationBody,
    current_user: dict = Depends(get_current_user),
):
    """Submit a parking sticker / RFID deactivation request."""
    try:
        return submit_deactivation_request(
            current_user["email"], req.request_id, req.deactivation_date
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
