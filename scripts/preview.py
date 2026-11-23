"""Serve the compiled interface on loopback, with room for parallel browser assets."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys


class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128


root = Path(__file__).resolve().parent.parent / "out"
if not (root / "index.html").is_file():
    sys.exit("Execute npm run build:previa antes de abrir a prévia.")
port = int(sys.argv[1]) if len(sys.argv) > 1 else 4319
handler = partial(SimpleHTTPRequestHandler, directory=str(root))
with PreviewServer(("127.0.0.1", port), handler) as server:
    print(f"Sales Analyzer em http://127.0.0.1:{port}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
