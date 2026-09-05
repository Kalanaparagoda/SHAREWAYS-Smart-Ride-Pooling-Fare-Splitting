from fastapi import APIRouter, HTTPException, Depends, Request, Form
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid
import hashlib
import os

from firebase_admin import firestore, messaging as fcm_messaging
from firebase_admin_setup import get_db
from routers.auth import verify_token

router = APIRouter()

# ---------------------------------------------------------------------------
# PayHere configuration (loaded from environment)
# ---------------------------------------------------------------------------
PAYHERE_MERCHANT_ID = os.getenv("PAYHERE_MERCHANT_ID", "")
PAYHERE_MERCHANT_SECRET = os.getenv("PAYHERE_MERCHANT_SECRET", "")
PAYHERE_LIVE = os.getenv("PAYHERE_LIVE", "False").lower() == "true"
PAYHERE_BASE_URL = "https://www.payhere.lk" if PAYHERE_LIVE else "https://sandbox.payhere.lk"


def _payhere_hash(merchant_id: str, order_id: str, amount: str, currency: str, secret: str) -> str:
    """Generate the MD5 hash required by PayHere Checkout API."""
    secret_hash = hashlib.md5(secret.encode()).hexdigest().upper()
    raw = f"{merchant_id}{order_id}{amount}{currency}{secret_hash}"
    return hashlib.md5(raw.encode()).hexdigest().upper()



# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class BookingCreateRequest(BaseModel):
    ride_id: str
    seats_requested: int = Field(1, ge=1, le=8)
    pickup_point: Optional[str] = Field(None, max_length=200)

class BookingUpdateRequest(BaseModel):
    seats_requested: Optional[int] = Field(None, ge=1, le=8)
    pickup_point: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=500)


class LocationUpdateRequest(BaseModel):
    lat: float
    lng: float


class BookingResponse(BaseModel):
    id: str
    ride_id: str
    passenger_uid: str
    passenger_name: str
    passenger_phone: Optional[str] = None
    driver_uid: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    seats_requested: int
    status: str  # "pending" | "confirmed" | "cancelled"
    payment_status: Optional[str] = "unpaid"  # "unpaid" | "paid"
    origin: str
    destination: str
    date: str
    departure_time: str
    fuel_cost_per_seat: float   # base cost set by driver
    total_cost: float           # dynamically recalculated shared cost
    shared_cost_per_seat: Optional[float] = None  # current dynamic fare
    created_at: str
    live_location: Optional[dict] = None
    pickup_point: Optional[str] = None
    notes: Optional[str] = None
    rated: Optional[bool] = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _send_fcm_push(db, uid: str, title: str, message: str):
    """Send an FCM push notification to a specific user if they have a token."""
    try:
        user_doc = db.collection("users").document(uid).get()
        if user_doc.exists:
            fcm_token = user_doc.to_dict().get("fcm_token")
            if fcm_token:
                msg = fcm_messaging.Message(
                    notification=fcm_messaging.Notification(
                        title=title,
                        body=message,
                    ),
                    token=fcm_token,
                )
                fcm_messaging.send(msg)
    except Exception as e:
        print(f"FCM push failed for user {uid}: {e}")

def _recalculate_and_notify_fares(db, ride_id: str, ride_data: dict, new_passenger_name: str = None, joined: bool = True):
    """
    After a booking is confirmed or cancelled, recalculate the shared fare
    for all remaining confirmed passengers and push a notification to each.

    Formula:
      total_fuel_cost = fuel_cost_per_seat (driver-set) * total_seats
      shared_cost_per_seat = total_fuel_cost / total_confirmed_seats
      each passenger's total_cost = shared_cost_per_seat * their seats_requested
    """
    try:
        ride = ride_data
        total_seats = ride.get("total_seats", 1)
        base_cost_per_seat = ride.get("fuel_cost_per_seat", 0)
        total_fuel_cost = base_cost_per_seat * total_seats

        confirmed_bookings = list(
            db.collection("bookings")
            .where("ride_id", "==", ride_id)
            .where("status", "==", "confirmed")
            .stream()
        )

        if not confirmed_bookings:
            return

        total_confirmed_seats = sum(b.to_dict().get("seats_requested", 1) for b in confirmed_bookings)
        if total_confirmed_seats <= 0:
            return

        new_shared_per_seat = round(total_fuel_cost / total_confirmed_seats, 2)
        now = datetime.utcnow().isoformat()
        origin = ride.get("origin", "")
        destination = ride.get("destination", "")

        for bdoc in confirmed_bookings:
            b = bdoc.to_dict()
            new_total = round(new_shared_per_seat * b.get("seats_requested", 1), 2)
            old_total = b.get("total_cost", 0)

            bdoc.reference.update({
                "shared_cost_per_seat": new_shared_per_seat,
                "total_cost": new_total,
            })

            # Only notify if fare actually changed and we have a passenger uid
            passenger_uid = b.get("passenger_uid")
            if passenger_uid and abs(new_total - old_total) > 0.5:
                direction = "decreased" if new_total < old_total else "increased"
                if joined and new_passenger_name:
                    msg = (
                        f"🎉 {new_passenger_name} just joined your ride from {origin} to {destination}! "
                        f"Your fare has {direction} to LKR {new_total:,.0f}."
                    )
                    title = f"Fare {'Dropped' if direction == 'decreased' else 'Updated'} 💰"
                else:
                    msg = (
                        f"A co-passenger cancelled their booking on your ride from {origin} to {destination}. "
                        f"Your fare has {direction} to LKR {new_total:,.0f}."
                    )
                    title = f"Fare {'Increased' if direction == 'increased' else 'Updated'} 💸"

                notif_id = str(uuid.uuid4())
                db.collection("notifications").document(notif_id).set({
                    "id": notif_id,
                    "recipient_uid": passenger_uid,
                    "type": "fare_updated",
                    "title": title,
                    "message": msg,
                    "read": False,
                    "created_at": now,
                })
                _send_fcm_push(db, passenger_uid, title, msg)
    except Exception as e:
        # Non-fatal — log but don't break the main request
        print(f"[fare_recalc] warning: {e}")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.put("/{booking_id}/payment", response_model=BookingResponse)
async def update_payment_status(booking_id: str, user: dict = Depends(verify_token)):
    """Toggle payment status. Driver only."""
    db = get_db()
    booking_ref = db.collection("bookings").document(booking_id)
    booking_snap = booking_ref.get()

    if not booking_snap.exists:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking = booking_snap.to_dict()
    if booking.get("driver_uid") != user["uid"]:
        raise HTTPException(status_code=403, detail="Only the driver can update payment status")

    new_status = "paid" if booking.get("payment_status") != "paid" else "unpaid"
    booking_ref.update({"payment_status": new_status})
    booking["payment_status"] = new_status
    return BookingResponse(**booking)

@router.post("/{booking_id}/mark-paid", response_model=BookingResponse)
async def mark_booking_paid(booking_id: str, user: dict = Depends(verify_token)):
    """Driver marks booking as paid and completed."""
    db = get_db()
    booking_ref = db.collection("bookings").document(booking_id)
    booking_snap = booking_ref.get()
    if not booking_snap.exists:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_snap.to_dict()
    if booking.get("driver_uid") != user["uid"]:
        raise HTTPException(status_code=403, detail="Only the driver can mark as paid")
    # Set payment_status to paid and status to completed
    updates = {"payment_status": "paid", "status": "completed"}
    booking_ref.update(updates)
    booking.update(updates)
    return BookingResponse(**booking)

@router.put("/{booking_id}", response_model=BookingResponse)
async def update_booking(
    booking_id: str,
    body: BookingUpdateRequest,
    user: dict = Depends(verify_token),
):
    """Edit an existing booking's seats, pickup point, and notes."""
    db = get_db()
    booking_ref = db.collection("bookings").document(booking_id)
    booking_snap = booking_ref.get()

    if not booking_snap.exists:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking = booking_snap.to_dict()

    if booking["passenger_uid"] != user["uid"]:
        raise HTTPException(status_code=403, detail="Not authorized to edit this booking")

    update_data = {}
    if body.pickup_point is not None:
        update_data["pickup_point"] = body.pickup_point.strip()
    if body.notes is not None:
        update_data["notes"] = body.notes.strip()

    # Handle seats_requested change
    if body.seats_requested is not None and body.seats_requested != booking["seats_requested"]:
        if booking["status"] != "pending":
            raise HTTPException(status_code=400, detail="Cannot change seats for non-pending bookings")
        
        ride_ref = db.collection("rides").document(booking["ride_id"])
        transaction = db.transaction()
        
        @firestore.transactional
        def _update_seats(transaction, ride_ref, booking_ref):
            r_snap = ride_ref.get(transaction=transaction)
            if not r_snap.exists:
                raise ValueError("RIDE_NOT_FOUND")
            
            ride = r_snap.to_dict()
            seat_diff = body.seats_requested - booking["seats_requested"]
            
            try:
                seats_left = int(ride.get("seats_left", 0))
            except (ValueError, TypeError):
                seats_left = 0

            if seat_diff > 0 and seats_left < seat_diff:
                raise ValueError(f"SEATS_INSUFFICIENT:{seats_left}")
                
            new_total_cost = float(ride.get("fuel_cost_per_seat", 0)) * body.seats_requested
            
            update_data["seats_requested"] = body.seats_requested
            update_data["total_cost"] = new_total_cost
            
            transaction.update(booking_ref, update_data)
            transaction.update(ride_ref, {
                "seats_left": seats_left - seat_diff
            })
            return update_data
            
        try:
            applied_updates = _update_seats(transaction, ride_ref, booking_ref)
            booking.update(applied_updates)
            return booking
        except ValueError as e:
            msg = str(e)
            if msg == "RIDE_NOT_FOUND":
                raise HTTPException(status_code=404, detail="Ride not found")
            elif msg.startswith("SEATS_INSUFFICIENT"):
                left = msg.split(":")[1] if ":" in msg else "0"
                raise HTTPException(status_code=400, detail=f"Only {left} seat(s) available")
            raise HTTPException(status_code=500, detail="Update failed")

    # If only notes/pickup changed, no transaction needed
    if update_data:
        booking_ref.update(update_data)
        booking.update(update_data)

    return booking


@router.post("", response_model=BookingResponse, status_code=201)
async def create_booking(
    body: BookingCreateRequest,
    user: dict = Depends(verify_token),
):
    """Book seat(s) on a ride. Sets status to 'pending' and decrements seats."""
    db = get_db()

    user_doc = db.collection("users").document(user["uid"]).get()
    user_profile = user_doc.to_dict() or {}
    passenger_name = user_profile.get("display_name") or user.get("name") or "Passenger"
    passenger_phone = user_profile.get("phone")

    ride_ref = db.collection("rides").document(body.ride_id)
    transaction = db.transaction()

    @firestore.transactional
    def _book(transaction, ride_ref):
        ride_snap = ride_ref.get(transaction=transaction)
        if not ride_snap.exists:
            raise ValueError("RIDE_NOT_FOUND")

        ride = ride_snap.to_dict()

        if ride.get("driver_uid") == user["uid"]:
            raise ValueError("OWN_RIDE")

        try:
            seats_left = int(ride.get("seats_left", 0))
        except (ValueError, TypeError):
            seats_left = 0

        if seats_left <= 0:
            raise ValueError("NO_SEATS_AVAILABLE")

        if seats_left < body.seats_requested:
            raise ValueError(f"SEATS_INSUFFICIENT:{seats_left}")

        booking_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        cost_per_seat = float(ride.get("fuel_cost_per_seat", 0))
        total_cost = cost_per_seat * body.seats_requested
        driver_uid = ride.get("driver_uid", "")
        driver_name = ride.get("driver_name", "Driver")
        driver_phone = None

        if driver_uid:
            driver_doc = db.collection("users").document(driver_uid).get()
            if driver_doc.exists:
                driver_profile = driver_doc.to_dict() or {}
                driver_phone = driver_profile.get("phone")

        pickup = (body.pickup_point or "").strip() or ride.get("origin", "")

        booking_data = {
            "id": booking_id,
            "ride_id": body.ride_id,
            "passenger_uid": user["uid"],
            "passenger_name": passenger_name,
            "passenger_phone": passenger_phone,
            "driver_uid": driver_uid,
            "driver_name": driver_name,
            "driver_phone": driver_phone,
            "seats_requested": body.seats_requested,
            "status": "pending",
            "payment_status": "unpaid",
            "origin": ride.get("origin", ""),
            "destination": ride.get("destination", ""),
            "date": ride.get("date", ""),
            "departure_time": ride.get("departure_time", ""),
            "fuel_cost_per_seat": cost_per_seat,
            "shared_cost_per_seat": cost_per_seat,
            "total_cost": total_cost,
            "created_at": now,
            "pickup_point": pickup,
            "rated": False,
        }

        booking_ref = db.collection("bookings").document(booking_id)
        transaction.set(booking_ref, booking_data)
        
        ride_updates = {
            "seats_left": seats_left - body.seats_requested
        }
        if pickup and pickup != ride.get("origin") and pickup != ride.get("destination"):
            ride_updates["waypoints"] = firestore.ArrayUnion([pickup])
            
        transaction.update(ride_ref, ride_updates)
        return booking_data

    try:
        booking_data = _book(transaction, ride_ref)
    except ValueError as e:
        msg = str(e)
        if msg == "RIDE_NOT_FOUND":
            raise HTTPException(status_code=404, detail="Ride not found")
        elif msg == "OWN_RIDE":
            raise HTTPException(status_code=400, detail="You cannot book your own ride")
        elif msg == "NO_SEATS_AVAILABLE":
            raise HTTPException(status_code=400, detail="No seats available")
        elif msg.startswith("SEATS_INSUFFICIENT"):
            left = msg.split(":")[1] if ":" in msg else "0"
            raise HTTPException(status_code=400, detail=f"Only {left} seat(s) available")
        else:
            raise HTTPException(status_code=500, detail="Booking failed")

    # Notify driver of pending request
    try:
        driver_uid = booking_data.get("driver_uid")
        if driver_uid:
            notif_id = str(uuid.uuid4())
            db.collection("notifications").document(notif_id).set({
                "id": notif_id,
                "recipient_uid": driver_uid,
                "type": "booking_request",
                "title": "New Booking Request",
                "message": (
                    f"{passenger_name} wants to book {body.seats_requested} seat"
                    f"{'s' if body.seats_requested > 1 else ''} on your ride from "
                    f"{booking_data.get('origin')} to {booking_data.get('destination')}."
                ),
                "read": False,
                "created_at": datetime.utcnow().isoformat(),
            })
            _send_fcm_push(
                db, 
                driver_uid, 
                "New Booking Request", 
                f"{passenger_name} wants to book {body.seats_requested} seat(s)."
            )
    except Exception:
        pass

    return BookingResponse(**booking_data)


@router.post("/{booking_id}/confirm", response_model=BookingResponse)
async def confirm_booking(booking_id: str, user: dict = Depends(verify_token)):
    """Driver confirms a pending booking. Triggers dynamic fare recalculation."""
    db = get_db()
    booking_ref = db.collection("bookings").document(booking_id)
    booking_snap = booking_ref.get()

    if not booking_snap.exists:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking = booking_snap.to_dict()
    if booking.get("driver_uid") != user["uid"]:
        raise HTTPException(status_code=403, detail="Only the driver can confirm bookings")

    if booking.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Only pending bookings can be confirmed")

    booking_ref.update({"status": "confirmed"})
    booking["status"] = "confirmed"

    # Notify passenger
    try:
        notif_id = str(uuid.uuid4())
        db.collection("notifications").document(notif_id).set({
            "id": notif_id,
            "recipient_uid": booking.get("passenger_uid"),
            "type": "booking_confirmed",
            "title": "Booking Confirmed! 🎉",
            "message": f"Your booking from {booking.get('origin')} to {booking.get('destination')} has been confirmed by the driver.",
            "read": False,
            "created_at": datetime.utcnow().isoformat(),
        })
        _send_fcm_push(
            db, 
            booking.get("passenger_uid"), 
            "Booking Confirmed! 🎉", 
            f"Your booking to {booking.get('destination')} has been confirmed."
        )
    except Exception:
        pass

    # --- Dynamic fare recalculation ---
    try:
        ride_snap = db.collection("rides").document(booking["ride_id"]).get()
        if ride_snap.exists:
            _recalculate_and_notify_fares(
                db, booking["ride_id"], ride_snap.to_dict(),
                new_passenger_name=booking.get("passenger_name"),
                joined=True,
            )
    except Exception:
        pass

    # Reload to get updated fare
    booking = booking_ref.get().to_dict()
    return BookingResponse(**booking)


@router.post("/{booking_id}/reject", response_model=BookingResponse)
async def reject_booking(booking_id: str, user: dict = Depends(verify_token)):
    """Driver rejects a pending booking."""
    db = get_db()
    booking_ref = db.collection("bookings").document(booking_id)
    booking_snap = booking_ref.get()

    if not booking_snap.exists:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking = booking_snap.to_dict()
    if booking.get("driver_uid") != user["uid"]:
        raise HTTPException(status_code=403, detail="Only the driver can reject bookings")

    if booking.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Only pending bookings can be rejected")

    ride_ref = db.collection("rides").document(booking["ride_id"])
    transaction = db.transaction()

    @firestore.transactional
    def _reject(transaction, ride_ref, booking_ref):
        transaction.update(booking_ref, {"status": "cancelled"})
        ride_snap = ride_ref.get(transaction=transaction)
        if ride_snap.exists:
            ride_data = ride_snap.to_dict()
            current_left = ride_data.get("seats_left", 0)
            total = ride_data.get("total_seats", 0)
            new_left = min(current_left + booking.get("seats_requested", 1), total)
            # Remove pickup from waypoints
            pickup = booking.get("pickup_point", "")
            updates = {"seats_left": new_left}
            if pickup:
                updates["waypoints"] = firestore.ArrayRemove([pickup])
            transaction.update(ride_ref, updates)

    _reject(transaction, ride_ref, booking_ref)
    booking["status"] = "cancelled"

    # Notify passenger
    try:
        notif_id = str(uuid.uuid4())
        db.collection("notifications").document(notif_id).set({
            "id": notif_id,
            "recipient_uid": booking.get("passenger_uid"),
            "type": "booking_rejected",
            "title": "Booking Request Declined",
            "message": f"Unfortunately, the driver declined your booking request from {booking.get('origin')} to {booking.get('destination')}.",
            "read": False,
            "created_at": datetime.utcnow().isoformat(),
        })
        _send_fcm_push(
            db, 
            booking.get("passenger_uid"), 
            "Booking Request Declined", 
            f"The driver declined your booking from {booking.get('origin')}."
        )
    except Exception:
        pass

    return BookingResponse(**booking)


@router.put("/{booking_id}/payment", response_model=BookingResponse)
async def update_payment_status(booking_id: str, user: dict = Depends(verify_token)):
    """Toggle payment status. Driver only."""
    db = get_db()
    booking_ref = db.collection("bookings").document(booking_id)
    booking_snap = booking_ref.get()

    if not booking_snap.exists:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking = booking_snap.to_dict()
    if booking.get("driver_uid") != user["uid"]:
        raise HTTPException(status_code=403, detail="Only the driver can update payment status")

    new_status = "paid" if booking.get("payment_status") != "paid" else "unpaid"
    booking_ref.update({"payment_status": new_status})
    booking["payment_status"] = new_status
    return BookingResponse(**booking)


@router.get("/my", response_model=List[BookingResponse])
async def get_my_bookings(user: dict = Depends(verify_token)):
    """Get all bookings made by the authenticated user."""
    db = get_db()
    docs = db.collection("bookings").where("passenger_uid", "==", user["uid"]).stream()
    bookings = []
    for doc in docs:
        data = doc.to_dict()
        bookings.append(BookingResponse(**data))
    bookings.sort(key=lambda b: b.created_at, reverse=True)
    return bookings


@router.get("/ride/{ride_id}", response_model=List[BookingResponse])
async def get_ride_bookings(ride_id: str, user: dict = Depends(verify_token)):
    """Get all bookings for a specific ride. Driver only."""
    db = get_db()
    ride_doc = db.collection("rides").document(ride_id).get()
    if not ride_doc.exists:
        raise HTTPException(status_code=404, detail="Ride not found")

    ride_data = ride_doc.to_dict()
    if ride_data.get("driver_uid") != user["uid"]:
        raise HTTPException(status_code=403, detail="Only the driver can view all bookings for this ride")

    docs = db.collection("bookings").where("ride_id", "==", ride_id).stream()
    bookings = [BookingResponse(**doc.to_dict()) for doc in docs]
    return bookings


@router.delete("/{booking_id}", status_code=200)
async def cancel_booking(booking_id: str, user: dict = Depends(verify_token)):
    """Cancel a booking. Passenger only. Triggers fare recalculation for remaining passengers."""
    db = get_db()
    booking_ref = db.collection("bookings").document(booking_id)
    booking_snap = booking_ref.get()

    if not booking_snap.exists:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking = booking_snap.to_dict()
    if booking.get("passenger_uid") != user["uid"]:
        raise HTTPException(status_code=403, detail="You can only cancel your own bookings")

    if booking.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="Booking is already cancelled")

    ride_ref = db.collection("rides").document(booking["ride_id"])
    transaction = db.transaction()

    @firestore.transactional
    def _cancel(transaction, ride_ref, booking_ref):
        transaction.update(booking_ref, {"status": "cancelled"})
        ride_snap = ride_ref.get(transaction=transaction)
        if ride_snap.exists:
            ride_data = ride_snap.to_dict()
            current_left = ride_data.get("seats_left", 0)
            total = ride_data.get("total_seats", 0)
            new_left = min(current_left + booking.get("seats_requested", 1), total)
            pickup = booking.get("pickup_point", "")
            updates = {"seats_left": new_left}
            if pickup:
                updates["waypoints"] = firestore.ArrayRemove([pickup])
            transaction.update(ride_ref, updates)

    _cancel(transaction, ride_ref, booking_ref)

    # Notify driver
    try:
        driver_uid = booking.get("driver_uid")
        if driver_uid:
            notif_id = str(uuid.uuid4())
            db.collection("notifications").document(notif_id).set({
                "id": notif_id,
                "recipient_uid": driver_uid,
                "type": "booking_cancelled",
                "title": "Booking Cancelled",
                "message": (
                    f"Passenger {booking.get('passenger_name')} cancelled their booking "
                    f"on your ride from {booking.get('origin')} to {booking.get('destination')}."
                ),
                "read": False,
                "created_at": datetime.utcnow().isoformat(),
            })
            _send_fcm_push(
                db, 
                driver_uid, 
                "Booking Cancelled", 
                f"{booking.get('passenger_name')} cancelled their booking on your ride."
            )
    except Exception:
        pass

    # --- Dynamic fare recalculation for remaining passengers ---
    try:
        ride_snap = db.collection("rides").document(booking["ride_id"]).get()
        if ride_snap.exists:
            _recalculate_and_notify_fares(
                db, booking["ride_id"], ride_snap.to_dict(),
                new_passenger_name=booking.get("passenger_name"),
                joined=False,
            )
    except Exception:
        pass

    return {"status": "ok"}


@router.put("/{booking_id}/location", response_model=BookingResponse)
async def update_live_location(booking_id: str, body: LocationUpdateRequest, user: dict = Depends(verify_token)):
    """Update passenger's live location for tracking by the driver."""
    db = get_db()
    booking_ref = db.collection("bookings").document(booking_id)
    booking_snap = booking_ref.get()

    if not booking_snap.exists:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking = booking_snap.to_dict()
    if booking.get("passenger_uid") != user["uid"]:
        raise HTTPException(status_code=403, detail="Only the passenger can update their location")

    location_data = {
        "lat": body.lat,
        "lng": body.lng,
        "updated_at": datetime.utcnow().isoformat()
    }

    booking_ref.update({"live_location": location_data})
    booking["live_location"] = location_data

    return BookingResponse(**booking)


# ---------------------------------------------------------------------------
# Payment — PayHere integration
# ---------------------------------------------------------------------------

@router.post("/{booking_id}/initiate-payment")
async def initiate_payment(booking_id: str, user: dict = Depends(verify_token)):
    """
    Generate PayHere checkout parameters for a confirmed booking.
    The frontend uses these to redirect the passenger to PayHere's hosted checkout page.
    """
    if not PAYHERE_MERCHANT_ID or not PAYHERE_MERCHANT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Payment gateway not configured. Contact the administrator."
        )

    db = get_db()
    booking_snap = db.collection("bookings").document(booking_id).get()
    if not booking_snap.exists:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking = booking_snap.to_dict()
    if booking.get("passenger_uid") != user["uid"]:
        raise HTTPException(status_code=403, detail="Only the passenger can pay for this booking")
    if booking.get("status") != "confirmed":
        raise HTTPException(status_code=400, detail="Only confirmed bookings can be paid")
    if booking.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="This booking is already paid")

    # Fetch passenger profile for checkout form pre-fill
    passenger_doc = db.collection("users").document(user["uid"]).get()
    passenger = passenger_doc.to_dict() or {} if passenger_doc.exists else {}

    amount = f"{booking.get('total_cost', 0):.2f}"
    currency = "LKR"
    order_id = booking_id  # use booking ID as the PayHere order ID

    payment_hash = _payhere_hash(
        PAYHERE_MERCHANT_ID, order_id, amount, currency, PAYHERE_MERCHANT_SECRET
    )

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

    return {
        "checkout_url": f"{PAYHERE_BASE_URL}/pay/checkout",
        "params": {
            "merchant_id": PAYHERE_MERCHANT_ID,
            "return_url": f"{frontend_url}/my-rides?payment=success&booking={booking_id}",
            "cancel_url": f"{frontend_url}/my-rides?payment=cancelled&booking={booking_id}",
            "notify_url": f"{os.getenv('BACKEND_URL', 'https://shareways-backend-942119664963.asia-south1.run.app')}/api/bookings/payhere-webhook",
            "order_id": order_id,
            "items": f"ShareWays Ride: {booking.get('origin')} → {booking.get('destination')}",
            "currency": currency,
            "amount": amount,
            "first_name": (passenger.get("display_name") or "Passenger").split()[0],
            "last_name": (passenger.get("display_name") or "Passenger").split()[-1],
            "email": user.get("email", ""),
            "phone": passenger.get("phone", "0000000000"),
            "address": "Sri Lanka",
            "city": booking.get("origin", "Colombo"),
            "country": "Sri Lanka",
            "hash": payment_hash,
        },
        "sandbox": not PAYHERE_LIVE,
    }


@router.post("/payhere-webhook")
async def payhere_webhook(request: Request):
    """
    PayHere server-to-server payment notification webhook.
    PayHere POSTs form data here after a payment completes.
    This endpoint must be publicly accessible (no Authorization header).

    Setup: configure this URL in PayHere merchant portal:
      https://<your-cloud-run-url>/api/bookings/payhere-webhook
    """
    form = await request.form()
    merchant_id = form.get("merchant_id", "")
    order_id = form.get("order_id", "")
    payhere_amount = form.get("payhere_amount", "")
    payhere_currency = form.get("payhere_currency", "")
    status_code = str(form.get("status_code", ""))
    md5sig = str(form.get("md5sig", "")).upper()

    # Verify the webhook signature to prevent spoofed notifications
    if PAYHERE_MERCHANT_SECRET:
        expected = _payhere_hash(
            merchant_id, order_id, payhere_amount, payhere_currency, PAYHERE_MERCHANT_SECRET
        )
        if md5sig != expected:
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    # status_code 2 = success, 0 = pending, -1 = cancelled, -2 = failed
    if status_code != "2":
        return {"status": "ignored", "status_code": status_code}

    db = get_db()
    booking_ref = db.collection("bookings").document(order_id)
    booking_snap = booking_ref.get()
    if not booking_snap.exists:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking_ref.update({
        "payment_status": "paid",
        "payment_method": "payhere",
        "payment_completed_at": datetime.utcnow().isoformat(),
    })

    # Notify the passenger
    booking = booking_snap.to_dict()
    try:
        notif_id = str(uuid.uuid4())
        db.collection("notifications").document(notif_id).set({
            "id": notif_id,
            "recipient_uid": booking.get("passenger_uid"),
            "type": "payment_confirmed",
            "title": "Payment Confirmed ✅",
            "message": (
                f"Your payment of LKR {payhere_amount} for the ride to "
                f"{booking.get('destination')} has been confirmed."
            ),
            "read": False,
            "created_at": datetime.utcnow().isoformat(),
        })
    except Exception:
        pass

    return {"status": "ok"}


@router.put("/{booking_id}/mark-paid")
async def mark_paid(booking_id: str, user: dict = Depends(verify_token)):
    """
    Manual cash payment fallback — driver marks a booking as paid.
    Only the driver of the ride can use this endpoint.
    """
    db = get_db()
    booking_snap = db.collection("bookings").document(booking_id).get()
    if not booking_snap.exists:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking = booking_snap.to_dict()
    if booking.get("driver_uid") != user["uid"]:
        raise HTTPException(status_code=403, detail="Only the driver can manually mark a booking as paid")

    db.collection("bookings").document(booking_id).update({
        "payment_status": "paid",
        "payment_method": "cash",
        "payment_completed_at": datetime.utcnow().isoformat(),
    })

    return {"status": "ok", "payment_status": "paid", "method": "cash"}
