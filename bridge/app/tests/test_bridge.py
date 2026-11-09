"""Unit tests of MQVault Bridge (no MT5, no network). Run: python -I -m unittest discover -s tests -t ."""
from __future__ import annotations

import base64
import json
import pathlib
import sys
import tempfile
import time
import unittest
from collections import namedtuple

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT.parent / "prototype"))

from cryptography.hazmat.primitives import hashes, serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import ec  # noqa: E402

from mqvault_bridge import config, signing  # noqa: E402
from mqvault_bridge.api import Response  # noqa: E402
from mqvault_bridge.mt5_reader import deal_row, live_offset_minutes, order_row, week_starts_ms  # noqa: E402
from mqvault_bridge.outbox import Outbox  # noqa: E402
from mqvault_bridge.sender import backoff, decide  # noqa: E402
from mqvault_bridge.state import StateFile  # noqa: E402
from mqvault_bridge.worker import batches, heartbeat_terminal  # noqa: E402
import check_readonly  # noqa: E402

VECTOR = json.loads((ROOT / "tests" / "vector.json").read_text(encoding="utf-8"))
# Fields src/lib/bridge/device-payload.ts accepts (it rejects anything else).
SERVER_DEAL_KEYS = {"ticket", "order", "position_id", "time_msc", "type", "entry", "symbol", "volume", "price", "profit", "commission", "swap", "fee", "reason", "magic"}
SERVER_ORDER_KEYS = {"ticket", "position_id", "time_setup_msc", "sl", "tp"}
SERVER_TERMINAL_KEYS = {"server", "login", "company", "trade_mode", "currency", "balance", "equity", "server_offset_minutes", "week_starts"}


class ReadOnlyTest(unittest.TestCase):
    def test_package_cannot_trade_or_take_credentials(self):
        problems = [p for f in sorted((ROOT / "mqvault_bridge").rglob("*.py")) for p in check_readonly.violations(f)]
        self.assertEqual(problems, [])


class SigningTest(unittest.TestCase):
    def test_canonical_string_and_signature_match_the_shared_vector(self):
        message = signing.canonical(VECTOR["method"], VECTOR["path"], VECTOR["time_ms"], VECTOR["seq"], VECTOR["body"].encode())
        self.assertEqual(message.decode(), VECTOR["canonical"])
        key = serialization.load_der_public_key(base64.b64decode(VECTOR["public_key"]))
        key.verify(base64.b64decode(VECTOR["signature_der"]), message, ec.ECDSA(hashes.SHA256()))  # raises if invalid

    def test_headers(self):
        self.assertEqual(signing.headers("d", 5, 7, "s"), {"X-MQV-Device": "d", "X-MQV-Seq": "5", "X-MQV-Time": "7", "X-MQV-Sig": "s"})


class ConfigTest(unittest.TestCase):
    def test_only_https_origins_except_localhost(self):
        self.assertEqual(config.check_server("https://journal.example.com/"), "https://journal.example.com")
        self.assertEqual(config.check_server("http://localhost:3000"), "http://localhost:3000")
        for bad in ["http://journal.example.com", "https://user:x@example.com", "https://example.com/api", "https://example.com/?a=1", "ftp://example.com", "example.com"]:
            with self.assertRaises(ValueError, msg=bad):
                config.check_server(bad)


class StateTest(unittest.TestCase):
    def test_seq_strictly_increases_and_survives_a_lost_state_file(self):
        with tempfile.TemporaryDirectory() as folder:
            path = pathlib.Path(folder) / "state.json"
            state = StateFile(path)
            first, second = state.next_seq(), state.next_seq()
            self.assertGreater(second, first)
            self.assertEqual(StateFile(path).state.last_seq, second)
            path.unlink()
            self.assertGreater(StateFile(path).next_seq(), first, "time-based floor")
            self.assertLess(second, 2 ** 53, "safe integer on the server")
            self.assertLessEqual(len(str(second)), 16, "server accepts up to 16 digits")


class ReaderHelpersTest(unittest.TestCase):
    def test_rows_have_exactly_the_fields_the_server_accepts(self):
        Deal = namedtuple("Deal", "ticket order position_id time_msc type entry symbol volume price profit commission swap fee reason magic comment external_id time")
        deal = Deal(1, 2, 3, 1762600000000, 0, 0, "EURUSD.raw", 1.0, 1.1, 0.0, -3.5, 0.0, 0.0, 0, 77, "[sl 1.098]", "x", 1762600000)
        row = deal_row(deal)
        self.assertLessEqual(set(row), SERVER_DEAL_KEYS)
        self.assertNotIn("comment", row)
        Order = namedtuple("Order", "ticket position_id time_setup_msc sl tp comment")
        self.assertEqual(set(order_row(Order(9, 3, 1762600000000, 1.09, 0.0, "note"))), SERVER_ORDER_KEYS)

    def test_week_starts_and_live_offset(self):
        hour = 3600
        bars = [0, hour, 2 * hour, 2 * hour + 50 * hour, 3 * hour + 50 * hour]
        self.assertEqual(week_starts_ms(bars), [52 * hour * 1000])
        now = 1_762_600_000.0
        self.assertEqual(live_offset_minutes(int(now + 120 * 60 + 30), now), 120)
        self.assertIsNone(live_offset_minutes(int(now - 2441 * 60), now), "stale weekend tick")


class WorkerTest(unittest.TestCase):
    def test_batches_split_deals_and_carry_only_their_orders(self):
        deals = [{"ticket": i, "position_id": 100 + i // 2, "time_msc": 1762600000000 + i} for i in range(5)]
        orders = [{"ticket": 900 + p, "position_id": p} for p in (100, 101, 102, 555)]
        result = batches("S", "1", list(reversed(deals)), orders, size=2)
        self.assertEqual([[d["ticket"] for d in b["deals"]] for b in result], [[0, 1], [2, 3], [4]])
        self.assertEqual([[o["position_id"] for o in b["orders"]] for b in result], [[100], [101], [102]])
        self.assertEqual(result[0]["account"], {"server": "S", "login": "1"})

    def test_heartbeat_terminal_has_only_server_fields(self):
        account = {"server": "S", "login": "1", "company": "C", "trade_mode": "demo", "currency": "USD", "balance": 1.0, "equity": 1.0}
        self.assertEqual(set(heartbeat_terminal(account, [1], None)), SERVER_TERMINAL_KEYS)


class OutboxTest(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.box = Outbox(pathlib.Path(self.folder.name) / "outbox.sqlite")

    def tearDown(self):
        self.box.close()
        self.folder.cleanup()

    def test_heartbeat_is_replaced_in_place_and_keeps_its_place_before_deals(self):
        self.box.put_heartbeat("a", {"n": 1})
        self.box.put_deals("a", [{"d": 1}])
        self.box.put_heartbeat("a", {"n": 2})
        item = self.box.next_ready()
        self.assertEqual((item[1], json.loads(item[3])), ("heartbeat", {"n": 2}))
        self.box.done(item[0])
        self.assertEqual(self.box.next_ready()[1], "deals")
        self.assertEqual(self.box.pending(), 1)

    def test_identical_deal_window_is_not_queued_twice(self):
        self.assertEqual(self.box.put_deals("a", [{"d": 1}, {"d": 2}]), 2)
        self.assertEqual(self.box.put_deals("a", [{"d": 1}, {"d": 2}]), 0)
        self.assertEqual(self.box.put_deals("a", [{"d": 1}, {"d": 3}]), 2)
        self.assertEqual(self.box.put_deals("b", [{"d": 1}, {"d": 2}]), 2, "per account")

    def test_retry_blocks_later_items_and_bury_moves_on(self):
        self.box.put_deals("a", [{"d": 1}, {"d": 2}])
        first = self.box.next_ready()
        self.box.retry(first[0], 60)
        self.assertIsNone(self.box.next_ready(), "order is kept: nothing overtakes a waiting item")
        self.box.bury(first[0], 400)
        self.assertEqual(json.loads(self.box.next_ready()[3]), {"d": 2})
        self.assertEqual(self.box.db.execute("SELECT count(*) FROM dead").fetchone()[0], 1)

    def test_account_progress(self):
        self.assertFalse(self.box.account_state("a")["full_done"])
        self.box.mark_full_done("a")
        self.box.save_week_starts("a", [1, 2])
        state = self.box.account_state("a")
        self.assertTrue(state["full_done"])
        self.assertEqual(state["week_starts"], [1, 2])
        self.assertLessEqual(state["week_starts_at"], time.time())


class SenderTest(unittest.TestCase):
    def test_server_replies_map_to_local_actions_only(self):
        cases = {
            (200, None): "done", (201, None): "done", (202, "sync_failed"): "done",
            (401, "clock_skew"): "clock", (401, "unauthorized"): "revoked", (409, "replay"): "replay",
            (409, "unknown_account"): "later", (400, "invalid_request"): "bury", (413, "too_large"): "bury",
            (429, "rate_limited"): "retry", (503, "unavailable"): "retry", (0, "network"): "retry",
        }
        for (status, error), expected in cases.items():
            self.assertEqual(decide(Response(status, {"error": error} if error else {})), expected, (status, error))

    def test_sender_uses_its_own_outbox_connection_in_its_thread(self):
        """Regression (e2e 2026-11-08): the connection was made in the supervisor thread and the sender thread crashed."""
        import threading
        from mqvault_bridge.sender import Sender

        class FakeClient:
            def __init__(self, state):
                self.state, self.sent = state, []

            def signed(self, method, path, payload, signer_id):
                self.sent.append(path)
                return Response(200, {})

        with tempfile.TemporaryDirectory() as folder:
            path = pathlib.Path(folder) / "outbox.sqlite"
            box = Outbox(path)
            box.put_heartbeat("a", {"n": 1})
            box.put_deals("a", [{"d": 1}])
            box.close()
            state = StateFile(pathlib.Path(folder) / "state.json")
            state.state.device_id = "d"
            client, stop = FakeClient(state), threading.Event()
            sender = Sender(client, path, stop)
            sender.start()
            deadline = time.time() + 10
            while len(client.sent) < 2 and time.time() < deadline:
                time.sleep(0.05)
            stop.set()
            sender.join(5)
            self.assertEqual(client.sent, ["/api/bridge/device/heartbeat", "/api/bridge/device/deals"])
            self.assertEqual(sender.status, "online")

    def test_backoff_is_bounded(self):
        self.assertLessEqual(max(backoff(n) for n in range(50)), 300)
        self.assertGreater(backoff(0), 0)


if __name__ == "__main__":
    unittest.main()
