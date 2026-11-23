"""Read-only local API fixture. Run with a private Web bundle directory as the argument."""
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
import json
import sys


workspace = {"id": "10000000-0000-4000-8000-000000000001", "name": "Empresa de teste", "role": "manager"}
session = {"user": {"id": "20000000-0000-4000-8000-000000000001", "name": "Gestor de teste", "email": "gestor@example.test"},
           "workspace": workspace, "workspaces": [workspace]}
line = {"id": "30000000-0000-4000-8000-000000000001", "name": "Linha de teste", "source": "synthetic"}
job = {"id": "40000000-0000-4000-8000-000000000001", "connectionId": line["id"],
       "createdAt": "2026-01-10T12:00:00Z", "status": "failed", "progress": 0,
       "error": "ai_input_count_unavailable", "report": None}


def usage(period):
    now = datetime.now(timezone.utc)
    age = (now.year - int(period[:4])) * 12 + now.month - int(period[5:])
    blocked = age == 0
    mode = "provider_metered" if age in (0, 1) else "local_simulated"
    cost = {"currency": "USD", "limitMicros": "10000000", "settledMicros": "2500123",
            "reservedMicros": "1234567", "indeterminateMicros": "234567",
            "availableMicros": "0" if blocked else "6265310",
            "authorizedCount": 2, "indeterminateCount": 1, "settledCount": 11}
    if blocked:
        cost["blockedReason"] = "provider_usage_above_cap"
    # The tariff is the current policy even when the requested month was simulated.
    return {"workspaceId": workspace["id"], "period": period, "scope": "diagnostic_analysis", "mode": mode,
            "commercial": {"limitCalls": 100 if not age else None, "consumedCalls": 11, "reservedCalls": 3},
            "cost": cost, "currentTariff": {"model": "modelo-de-teste", "version": "controle-v3",
            "tokenizer": "responses-input-count-v1", "tier": "default", "maxInputTokens": 8192,
            "maxOutputTokens": 1024, "inputMicrosPerMillion": "1000000", "outputMicrosPerMillion": "2000000"}}


class Fixture(SimpleHTTPRequestHandler):
    def do_GET(self):
        url = urlsplit(self.path)
        if url.path == "/healthz":
            value = {"fixture": True, "revision": revision}
        elif not url.path.startswith("/api/v2/"):
            return super().do_GET()
        else:
            path = url.path.removeprefix("/api/v2/")
            if path == "session":
                value = session
            elif path == "budget/usage":
                period = parse_qs(url.query).get("period", [""])[0]
                try:
                    datetime.strptime(period, "%Y-%m")
                except ValueError:
                    return self.send_error(400)
                value = usage(period)
            elif path in ("diagnostics", "connections"):
                value = {"items": [job if path == "diagnostics" else line], "nextCursor": None}
            elif path == "diagnostics/" + job["id"]:
                value = job
            else:
                return self.send_error(404)
        raw = json.dumps(value).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128


if __name__ == "__main__":
    bundle = Path(sys.argv[1]).resolve()
    revision = (bundle / "REVISION").read_text().strip()
    assert (bundle / "site/index.html").is_file()
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 4399
    with PreviewServer(("127.0.0.1", port), partial(Fixture, directory=str(bundle / "site"))) as server:
        server.serve_forever()
