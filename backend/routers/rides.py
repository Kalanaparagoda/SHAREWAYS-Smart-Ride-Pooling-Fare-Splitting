from fastapi import APIRouter, HTTPException, Depends, Query, Header, Request
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime, date as date_type
import uuid

from firebase_admin import firestore as fs_module
from firebase_admin_setup import get_db
from routers.auth import verify_token

# Rate limiting — limiter is set on app.state by main.py
try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    limiter = Limiter(key_func=get_remote_address)
except ImportError:
    limiter = None

router = APIRouter()


# --- Schemas ------------------------------------------------------------------

class RideCreateRequest(BaseModel):
    origin: str = Field(..., min_length=3, max_length=200)
    destination: str = Field(..., min_length=3, max_length=200)
    date: str  # ISO date string "YYYY-MM-DD"
    departure_time: str  # "HH:MM"
    total_seats: int = Field(..., ge=1, le=8)
    vehicle_category: str = Field(..., pattern="^(car|van|bike|tuktuk)$")
    vehicle_description: str = Field(..., min_length=3, max_length=300)
    fuel_cost_per_seat: float = Field(..., ge=0, le=50000)
    notes: Optional[str] = Field(None, max_length=500)

    @field_validator('date')
    @classmethod
    def date_must_be_future(cls, v: str) -> str:
        try:
            d = date_type.fromisoformat(v)
        except ValueError:
            raise ValueError('date must be in YYYY-MM-DD format')
        if d < date_type.today():
            raise ValueError('date must not be in the past')
        return v


class RideUpdateRequest(BaseModel):
    date: Optional[str] = None
    departure_time: Optional[str] = None
    fuel_cost_per_seat: Optional[float] = Field(None, ge=0, le=50000)
    notes: Optional[str] = Field(None, max_length=500)
    vehicle_category: Optional[str] = Field(None, pattern="^(car|van|bike|tuktuk)$")
    vehicle_description: Optional[str] = Field(None, min_length=3, max_length=300)


class RideStatusUpdateRequest(BaseModel):
    lifecycle: str  # "waiting" | "arriving" | "in_transit" | "completed"


class DriverLocationRequest(BaseModel):
    lat: float
    lng: float


class RideResponse(BaseModel):
    id: str
    driver_uid: str
    driver_name: str
    origin: str
    destination: str
    date: str
    departure_time: str
    total_seats: int
    seats_left: int
    vehicle_category: Optional[str] = None
    vehicle_description: str
    fuel_cost_per_seat: float
    notes: Optional[str] = None
    created_at: str
    status: Optional[str] = None         # "active" | "cancelled" | "completed"
    lifecycle: Optional[str] = None      # "waiting" | "arriving" | "in_transit" | "completed"
    driver_location: Optional[dict] = None  # { lat, lng, updated_at }
    waypoints: Optional[List[str]] = None   # ordered pickup stops from bookings


# --- Routes -------------------------------------------------------------------

def get_limiter_limit():
    return "5/minute" if limiter else None

@router.post("", response_model=RideResponse, status_code=201)
@limiter.limit("5/minute")
async def create_ride(request: Request, body: RideCreateRequest, user: dict = Depends(verify_token)):
    """Create a new ride offer. Only authenticated users can offer rides."""
    try:
        db = get_db()

        # Get driver display name from Firestore profile
        user_doc = db.collection("users").document(user["uid"]).get()
        user_profile = user_doc.to_dict() or {}
        driver_name = user_profile.get("display_name") or user.get("name") or "Driver"

        ride_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        ride_data = {
            "id": ride_id,
            "driver_uid": user["uid"],
            "driver_name": driver_name,
            "origin": body.origin.strip(),
            "destination": body.destination.strip(),
            "date": body.date,
            "departure_time": body.departure_time,
            "total_seats": body.total_seats,
            "seats_left": body.total_seats,
            "vehicle_description": body.vehicle_description,
            "vehicle_category": body.vehicle_category,
            "fuel_cost_per_seat": body.fuel_cost_per_seat,
            "notes": body.notes,
            "created_at": now,
            "status": "active",
            "lifecycle": "waiting",
            "driver_location": None,
            "waypoints": [],
        }

        db.collection("rides").document(ride_id).set(ride_data)
        return RideResponse(**ride_data)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create ride: {str(e)}"
        )


@router.get("/search", response_model=List[RideResponse])
async def search_rides(
    origin: Optional[str] = Query(None),
    destination: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    seats: int = Query(1, ge=1),
):
    """Search for available rides by origin, destination, and date."""
    db = get_db()
    query = db.collection("rides")

    # Filter by date first (most selective)
    if date:
        query = query.where("date", "==", date)

    docs = query.stream()
    results = []

    for doc in docs:
        ride = doc.to_dict()
        # Skip cancelled rides
        if ride.get("status") == "cancelled":
            continue
        # Case-insensitive partial match on origin/destination
        if origin and origin.lower() not in ride.get("origin", "").lower():
            continue
        if destination and destination.lower() not in ride.get("destination", "").lower():
            continue
        if ride.get("seats_left", 0) < seats:
            continue
        results.append(RideResponse(**ride))

    # Sort by departure time
    results.sort(key=lambda r: (r.date, r.departure_time))
    return results


@router.get("/my", response_model=List[RideResponse])
async def get_my_rides(user: dict = Depends(verify_token)):
    """Get all rides offered by the authenticated user."""
    db = get_db()
    docs = db.collection("rides").where("driver_uid", "==", user["uid"]).stream()
    rides = [RideResponse(**doc.to_dict()) for doc in docs]
    rides.sort(key=lambda r: (r.date, r.departure_time), reverse=True)
    return rides


@router.post("/cleanup", status_code=200)
async def cleanup_expired_rides(x_cleanup_secret: Optional[str] = Header(None)):
    """
    Delete rides whose date has already passed (expired rides).
    Should be called by Cloud Scheduler. Protected by a secret header.
    Also deletes all bookings associated with expired rides.
    """
    import os
    expected_secret = os.getenv("CLEANUP_SECRET", "shareways-cleanup-2026")
    if x_cleanup_secret != expected_secret:
        raise HTTPException(status_code=403, detail="Invalid cleanup secret")

    db = get_db()
    today_str = date_type.today().isoformat()  # "YYYY-MM-DD"

    # Query rides with date < today
    expired_docs = db.collection("rides").where("date", "<", today_str).stream()
    expired_ride_ids = []
    deleted_rides = 0

    for doc in expired_docs:
        ride_data = doc.to_dict()
        expired_ride_ids.append(ride_data.get("id", doc.id))
        doc.reference.delete()
        deleted_rides += 1

    # Delete all bookings for expired rides
    deleted_bookings = 0
    for ride_id in expired_ride_ids:
        booking_docs = (
            db.collection("bookings")
            .where("ride_id", "==", ride_id)
            .stream()
        )
        for bdoc in booking_docs:
            bdoc.reference.delete()
            deleted_bookings += 1

    return {
        "status": "ok",
        "deleted_rides": deleted_rides,
        "deleted_bookings": deleted_bookings,
        "cleaned_before": today_str,
    }


@router.get("/{ride_id}", response_model=RideResponse)
async def get_ride(ride_id: str):
    """Get details for a specific ride."""
    db = get_db()
    doc = db.collection("rides").document(ride_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Ride not found")
    return RideResponse(**doc.to_dict())


@router.put("/{ride_id}", response_model=RideResponse)
async def update_ride(ride_id: str, body: RideUpdateRequest, user: dict = Depends(verify_token)):
    """
    Update a ride offer. Only the driver who created it can update it.
    Sends targeted notifications to all confirmed/pending passengers about the change.
    Also syncs updated date/time/cost to their booking documents.
    """
    db = get_db()
    doc_ref = db.collection("rides").document(ride_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Ride not found")

    ride_data = doc.to_dict()
    if ride_data.get("driver_uid") != user["uid"]:
        raise HTTPException(status_code=403, detail="You can only edit your own rides")

    # Build update payload — only include fields that were provided
    update_fields = {}
    notification_changes = []

    if body.date is not None and body.date != ride_data.get("date"):
        update_fields["date"] = body.date
        notification_changes.append(f"date changed to {body.date}")
    if body.departure_time is not None and body.departure_time != ride_data.get("departure_time"):
        update_fields["departure_time"] = body.departure_time
        notification_changes.append(f"departure time updated to {body.departure_time}")
    if body.fuel_cost_per_seat is not None and body.fuel_cost_per_seat != ride_data.get("fuel_cost_per_seat"):
        update_fields["fuel_cost_per_seat"] = body.fuel_cost_per_seat
        notification_changes.append(f"fare updated to LKR {body.fuel_cost_per_seat:.0f}/seat")
    if body.notes is not None:
        update_fields["notes"] = body.notes
    if body.vehicle_description is not None:
        update_fields["vehicle_description"] = body.vehicle_description
    if body.vehicle_category is not None:
        update_fields["vehicle_category"] = body.vehicle_category

    if not update_fields:
        # Nothing changed — return as-is
        return RideResponse(**ride_data)

    # Apply updates to the ride document
    doc_ref.update(update_fields)
    ride_data.update(update_fields)

    # Notify all active passengers
    now = datetime.utcnow().isoformat()
    booking_docs = (
        db.collection("bookings")
        .where("ride_id", "==", ride_id)
        .where("status", "in", ["confirmed", "pending"])
        .stream()
    )

    notified_count = 0
    change_summary = " and ".join(notification_changes) if notification_changes else "details updated"
    origin = ride_data.get("origin", "")
    destination = ride_data.get("destination", "")

    for bdoc in booking_docs:
        booking = bdoc.to_dict()
        passenger_uid = booking.get("passenger_uid")

        # Sync updated date/time/cost onto booking document
        booking_update = {}
        if "date" in update_fields:
            booking_update["date"] = update_fields["date"]
        if "departure_time" in update_fields:
            booking_update["departure_time"] = update_fields["departure_time"]
        if "fuel_cost_per_seat" in update_fields:
            new_fare = update_fields["fuel_cost_per_seat"]
            seats = booking.get("seats_requested", 1)
            booking_update["fuel_cost_per_seat"] = new_fare
            booking_update["total_cost"] = new_fare * seats
        if booking_update:
            bdoc.reference.update(booking_update)

        # Write notification for passenger
        if passenger_uid:
            notif_id = str(uuid.uuid4())
            db.collection("notifications").document(notif_id).set({
                "id": notif_id,
                "recipient_uid": passenger_uid,
                "type": "ride_updated",
                "title": "Ride Updated ✏️",
                "message": (
                    f"Your ride from {origin} to {destination} has been updated by the driver: "
                    f"{change_summary}."
                ),
                "read": False,
                "created_at": now,
            })
            notified_count += 1

    return RideResponse(**ride_data)


@router.delete("/{ride_id}", status_code=200)
async def delete_ride(ride_id: str, user: dict = Depends(verify_token)):
    """
    Cancel/delete a ride offer. Only the driver who created it can cancel it.
    Also marks all confirmed bookings as 'cancelled' and writes a
    notification document for each affected passenger.
    """
    db = get_db()
    doc_ref = db.collection("rides").document(ride_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Ride not found")

    ride_data = doc.to_dict()
    if ride_data.get("driver_uid") != user["uid"]:
        raise HTTPException(status_code=403, detail="You can only cancel your own rides")

    # Find all confirmed bookings for this ride and notify passengers
    booking_docs = (
        db.collection("bookings")
        .where("ride_id", "==", ride_id)
        .where("status", "==", "confirmed")
        .stream()
    )

    notified_count = 0
    now = datetime.utcnow().isoformat()

    for bdoc in booking_docs:
        booking = bdoc.to_dict()
        passenger_uid = booking.get("passenger_uid")

        # Mark booking as cancelled
        bdoc.reference.update({"status": "cancelled"})

        # Write a real-time notification for the passenger
        if passenger_uid:
            notif_id = str(uuid.uuid4())
            db.collection("notifications").document(notif_id).set({
                "id": notif_id,
                "recipient_uid": passenger_uid,
                "type": "ride_cancelled",
                "title": "Ride Cancelled",
                "message": (
                    f"Your ride from {ride_data.get('origin')} to "
                    f"{ride_data.get('destination')} on {ride_data.get('date')} "
                    f"at {ride_data.get('departure_time')} has been cancelled by the driver."
                ),
                "read": False,
                "created_at": now,
            })
            notified_count += 1

    # Delete the ride document
    doc_ref.delete()

    return {"status": "ok", "notified_passengers": notified_count}


# ---- Lifecycle Status Transition ----------------------------------------

LIFECYCLE_TRANSITIONS = {
    "waiting": "arriving",
    "arriving": "in_transit",
    "in_transit": "completed",
}

LIFECYCLE_LABELS = {
    "waiting": "Waiting for Passengers",
    "arriving": "Driver is Arriving",
    "in_transit": "In Transit",
    "completed": "Completed",
}


@router.put("/{ride_id}/status", response_model=RideResponse)
async def update_ride_lifecycle(ride_id: str, body: RideStatusUpdateRequest, user: dict = Depends(verify_token)):
    """
    Advance the ride lifecycle state. Only the driver who owns the ride can call this.
    Valid transitions: waiting → arriving → in_transit → completed.
    Sends notifications to all confirmed passengers on each transition.
    """
    db = get_db()
    doc_ref = db.collection("rides").document(ride_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Ride not found")

    ride_data = doc.to_dict()
    if ride_data.get("driver_uid") != user["uid"]:
        raise HTTPException(status_code=403, detail="Only the driver can update ride status")

    allowed = ["waiting", "arriving", "in_transit", "completed"]
    if body.lifecycle not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid lifecycle value. Must be one of: {allowed}")

    current = ride_data.get("lifecycle", "waiting")
    # Allow setting completed from in_transit only, but be lenient for arriving/in_transit to allow resetting
    expected_next = LIFECYCLE_TRANSITIONS.get(current)
    if body.lifecycle != expected_next and body.lifecycle != current:
        # Strict: must advance in order (unless re-sending same state)
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{current}' to '{body.lifecycle}'. Next valid state is '{expected_next}'."
        )

    update_payload = {"lifecycle": body.lifecycle}
    if body.lifecycle == "completed":
        update_payload["status"] = "completed"

    doc_ref.update(update_payload)
    ride_data.update(update_payload)

    # Notify all confirmed passengers
    try:
        now = datetime.utcnow().isoformat()
        label = LIFECYCLE_LABELS.get(body.lifecycle, body.lifecycle)
        booking_docs = (
            db.collection("bookings")
            .where("ride_id", "==", ride_id)
            .where("status", "==", "confirmed")
            .stream()
        )
        for bdoc in booking_docs:
            b = bdoc.to_dict()
            passenger_uid = b.get("passenger_uid")
            if passenger_uid:
                notif_id = str(uuid.uuid4())
                db.collection("notifications").document(notif_id).set({
                    "id": notif_id,
                    "recipient_uid": passenger_uid,
                    "type": f"ride_{body.lifecycle}",
                    "title": f"Ride Update: {label}",
                    "message": f"Your ride from {ride_data.get('origin')} to {ride_data.get('destination')} is now: {label}.",
                    "read": False,
                    "created_at": now,
                })
    except Exception:
        pass

    return RideResponse(**ride_data)


# ---- Driver Live Location -----------------------------------------------


@router.put("/{ride_id}/driver-location", status_code=200)
async def update_driver_location(ride_id: str, body: DriverLocationRequest, user: dict = Depends(verify_token)):
    """
    Push driver's live GPS coordinates into the ride document.
    Only the ride's driver can call this.
    """
    db = get_db()
    doc_ref = db.collection("rides").document(ride_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Ride not found")

    ride_data = doc.to_dict()
    if ride_data.get("driver_uid") != user["uid"]:
        raise HTTPException(status_code=403, detail="Only the driver can update their location")

    location_data = {
        "lat": body.lat,
        "lng": body.lng,
        "updated_at": datetime.utcnow().isoformat(),
    }
    doc_ref.update({"driver_location": location_data})

    return {"status": "ok", "driver_location": location_data}
