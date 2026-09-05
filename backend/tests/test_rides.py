"""
test_rides.py — backend tests for /api/rides
Verifies Pydantic validations, rate limiting, and normal operations.
"""
from datetime import date, timedelta

def get_tomorrow_date():
    return (date.today() + timedelta(days=1)).isoformat()


def test_create_ride_success(client, auth_headers):
    # Should succeed with valid data
    resp = client.post(
        '/api/rides',
        json={
            'origin': 'Colombo',
            'destination': 'Kandy',
            'date': get_tomorrow_date(),
            'departure_time': '08:00',
            'total_seats': 4,
            'vehicle_description': 'Honda Fit',
            'fuel_cost_per_seat': 1000
        },
        headers=auth_headers
    )
    assert resp.status_code == 201


def test_create_ride_invalid_date(client, auth_headers):
    # Past dates should fail validation
    past_date = (date.today() - timedelta(days=1)).isoformat()
    resp = client.post(
        '/api/rides',
        json={
            'origin': 'Colombo',
            'destination': 'Kandy',
            'date': past_date,
            'departure_time': '08:00',
            'total_seats': 4,
            'vehicle_description': 'Honda Fit',
            'fuel_cost_per_seat': 1000
        },
        headers=auth_headers
    )
    assert resp.status_code == 422
    assert "date must not be in the past" in resp.text


def test_create_ride_invalid_seats(client, auth_headers):
    resp = client.post(
        '/api/rides',
        json={
            'origin': 'Colombo',
            'destination': 'Kandy',
            'date': get_tomorrow_date(),
            'departure_time': '08:00',
            'total_seats': 10,  # Max is 8
            'vehicle_description': 'Van',
            'fuel_cost_per_seat': 1000
        },
        headers=auth_headers
    )
    assert resp.status_code == 422


def test_create_ride_rate_limit(client, auth_headers):
    # Fire off multiple requests rapidly to hit the 5/minute limit
    payload = {
        'origin': 'Colombo',
        'destination': 'Kandy',
        'date': get_tomorrow_date(),
        'departure_time': '08:00',
        'total_seats': 4,
        'vehicle_description': 'Honda Fit',
        'fuel_cost_per_seat': 1000
    }
    
    # Send 5 requests (should pass)
    for _ in range(5):
        resp = client.post('/api/rides', json=payload, headers=auth_headers)
        assert resp.status_code == 201
        
    # The 6th request should hit the 429 rate limit
    resp = client.post('/api/rides', json=payload, headers=auth_headers)
    assert resp.status_code == 429
