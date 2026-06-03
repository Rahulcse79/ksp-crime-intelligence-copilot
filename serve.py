#!/usr/bin/env python3
"""Minimal static server for the KSP Crime Copilot demo.
Serves an explicit absolute directory so it never calls os.getcwd()
(works in restricted/sandboxed environments). Run: python3 serve.py [port]"""
import sys
import functools
import http.server
import socketserver

DIRECTORY = "/Users/rahulsingh/Desktop/Datathon"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("[serve] " + (fmt % args) + "\n")


def main():
    handler = functools.partial(Handler, directory=DIRECTORY)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), handler) as httpd:
        sys.stderr.write(f"[serve] KSP Copilot on http://127.0.0.1:{PORT}\n")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
