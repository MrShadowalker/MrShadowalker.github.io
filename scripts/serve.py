#!/usr/bin/env python3
"""Serve a GitHub Pages artifact locally with its custom Pages 404 page."""

from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Optional


ROOT = Path(__file__).resolve().parents[1]


class PagesHandler(SimpleHTTPRequestHandler):
    """Match GitHub Pages' static-file behavior for local preview."""

    def __init__(self, *args, fallback_root: Path = ROOT, **kwargs):
        self.fallback_root = fallback_root
        super().__init__(*args, **kwargs)

    def send_error(self, code: int, message: Optional[str] = None, explain: Optional[str] = None) -> None:
        if code != 404:
            super().send_error(code, message, explain)
            return

        body = (self.fallback_root / "404.html").read_bytes()
        self.send_response(404, "File not found")
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", default="127.0.0.1", help="address to bind (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=4173, help="port to serve (default: 4173)")
    parser.add_argument("--root", type=Path, default=ROOT, help="directory to serve (default: repository root)")
    args = parser.parse_args()

    root = args.root.resolve()
    if not root.is_dir():
        parser.error(f"serve root does not exist: {root}")
    handler = partial(PagesHandler, directory=str(root), fallback_root=root)
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    print(f"Serving {root} at http://{args.bind}:{args.port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping local preview.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
