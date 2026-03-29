import unittest
from fastapi.testclient import TestClient

from stock_strategy.api import app


class APITest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def test_health_endpoint(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_auth_status_safe_fallback(self) -> None:
        # Without a mocked database, the endpoint gracefully catches and returns unconnected
        response = self.client.get("/api/auth/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("is_connected", data)
        self.assertFalse(data["is_connected"])

    def test_signals_history_safe_fallback(self) -> None:
        response = self.client.get("/api/signals/history")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("signals", data)
        self.assertIsInstance(data["signals"], list)

    def test_kite_credentials_status(self) -> None:
        response = self.client.get("/kite/credentials-status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("api_key_present", data)
        self.assertIn("access_token_present", data)

if __name__ == "__main__":
    unittest.main()
