"""
KRONOS ARENA backend tests
- Root health endpoint
- /api/rounds POST + persistence via /api/leaderboard
- /api/status legacy POST/GET
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://glow-outbreak.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ============ Root ============
class TestRoot:
    def test_root(self, client):
        r = client.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("message") == "KRONOS ARENA online"


# ============ Legacy status ============
class TestStatus:
    def test_create_status(self, client):
        r = client.post(f"{API}/status", json={"client_name": "TEST_kronos_client"})
        assert r.status_code == 200
        data = r.json()
        assert data["client_name"] == "TEST_kronos_client"
        assert "id" in data and isinstance(data["id"], str)
        assert "timestamp" in data

    def test_get_status(self, client):
        r = client.get(f"{API}/status")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert any(d.get("client_name") == "TEST_kronos_client" for d in data)


# ============ Rounds + Leaderboard ============
class TestRounds:
    nick = f"TEST_NICK_{int(time.time())}"

    def test_submit_round_min(self, client):
        payload = {
            "nickname": self.nick,
            "survived": True,
            "won": True,
            "role": "survivor",
            "survived_seconds": 45.5,
            "bots_count": 3,
            "survivors_left": 2,
        }
        r = client.post(f"{API}/rounds", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data and isinstance(data["id"], str)
        assert "timestamp" in data
        assert data["nickname"] == self.nick
        assert data["survived"] is True
        assert data["won"] is True
        assert data["role"] == "survivor"
        assert data["survived_seconds"] == 45.5

    def test_submit_round_loss(self, client):
        payload = {
            "nickname": self.nick,
            "survived": False,
            "won": False,
            "role": "infected",
            "survived_seconds": 12.0,
            "bots_count": 3,
            "survivors_left": 0,
        }
        r = client.post(f"{API}/rounds", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["won"] is False and d["role"] == "infected"

    def test_submit_round_win_2(self, client):
        payload = {
            "nickname": self.nick,
            "survived": True,
            "won": True,
            "role": "survivor",
            "survived_seconds": 90.0,
            "bots_count": 5,
            "survivors_left": 3,
        }
        r = client.post(f"{API}/rounds", json=payload)
        assert r.status_code == 200

    def test_submit_invalid_payload(self, client):
        # missing required fields
        r = client.post(f"{API}/rounds", json={"nickname": "x"})
        assert r.status_code == 422

    def test_leaderboard(self, client):
        r = client.get(f"{API}/leaderboard")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        ours = [e for e in data if e["nickname"] == self.nick]
        # We posted 3 rounds with this nick
        assert len(ours) == 1, f"Expected aggregated entry for {self.nick}, got {data}"
        entry = ours[0]
        assert entry["games"] == 3
        assert entry["wins"] == 2
        assert entry["best_time"] == 90.0

    def test_leaderboard_limit(self, client):
        r = client.get(f"{API}/leaderboard", params={"limit": 1})
        assert r.status_code == 200
        assert len(r.json()) <= 1
