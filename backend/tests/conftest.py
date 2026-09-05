"""
Backend pytest conftest — provides fixtures for all test modules.
Firebase Admin SDK is mocked so tests run without real Firebase credentials.
"""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def mock_firebase():
    """
    Auto-use fixture: patches Firebase Admin SDK before any test runs.
    This prevents 'firebase_admin not initialized' errors in tests.
    """
    with patch('firebase_admin_setup.initialize_firebase'), \
         patch('firebase_admin_setup.get_db') as mock_get_db:
        
        # Build a chainable Firestore mock
        mock_db = MagicMock()
        mock_collection = MagicMock()
        mock_document = MagicMock()
        mock_doc_snap = MagicMock()
        
        mock_doc_snap.exists = True
        mock_doc_snap.to_dict.return_value = {
            'display_name': 'Test User',
            'phone': '0771234567',
            'email': 'test@example.com',
            'joined_at': '2024-01-01T00:00:00',
        }
        
        mock_document.get.return_value = mock_doc_snap
        mock_document.set.return_value = None
        mock_document.update.return_value = None
        mock_document.delete.return_value = None
        
        mock_collection.document.return_value = mock_document
        mock_collection.where.return_value = mock_collection
        mock_collection.stream.return_value = []
        mock_collection.get.return_value = []
        
        mock_db.collection.return_value = mock_collection
        mock_get_db.return_value = mock_db
        
        yield mock_db


@pytest.fixture()
def client(mock_firebase):
    """Provides a FastAPI TestClient with Firebase already mocked."""
    from main import app
    from routers.auth import verify_token
    
    app.dependency_overrides[verify_token] = lambda: {'uid': 'test-uid', 'email': 'test@example.com', 'name': 'Test User'}
    
    with TestClient(app) as test_client:
        yield test_client
        
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers():
    """Returns Authorization headers used in authenticated requests."""
    return {'Authorization': 'Bearer mock-test-token'}
