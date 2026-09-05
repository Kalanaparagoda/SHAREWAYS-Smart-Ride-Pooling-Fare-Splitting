"""
test_auth.py — backend tests for /api/auth endpoints
"""
import pytest
from unittest.mock import patch, MagicMock


class TestHealthCheck:
    """Basic API health — always runs first to confirm app boots."""

    def test_root_health(self, client):
        resp = client.get('/')
        assert resp.status_code == 200
        data = resp.json()
        assert data['status'] == 'ok'

    def test_api_health(self, client):
        resp = client.get('/api/health')
        assert resp.status_code == 200


class TestProfile:
    """Tests for /api/auth/profile"""

    def test_get_profile_authenticated(self, client, auth_headers):
        resp = client.get('/api/auth/profile', headers=auth_headers)
        # With mock verify_token, should succeed
        assert resp.status_code == 200

    def test_update_profile_display_name(self, client, auth_headers):
        resp = client.put(
            '/api/auth/profile',
            json={'display_name': 'Kamal Silva'},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    def test_update_profile_rejects_too_short_name(self, client, auth_headers):
        resp = client.put(
            '/api/auth/profile',
            json={'display_name': 'A'},  # min_length=2 → should fail
            headers=auth_headers,
        )
        assert resp.status_code == 422

    def test_update_profile_with_emergency_contact(self, client, auth_headers):
        resp = client.put(
            '/api/auth/profile',
            json={'emergency_contact': {'name': 'Mum', 'phone': '0771234567'}},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    def test_store_fcm_token(self, client, auth_headers):
        resp = client.post(
            '/api/auth/profile/fcm-token',
            json={'token': 'fcm-test-token-abc123'},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()['status'] == 'ok'

    def test_unauthenticated_profile_fails(self, client):
        from main import app
        app.dependency_overrides.clear()
        resp = client.get('/api/auth/profile')
        # Should fail with 401 or 403 (no auth token)
        assert resp.status_code in (401, 403, 422)
