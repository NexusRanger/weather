"""
Ambient Weather & Stargazing TV Dashboard Server
Serves index.html to your local network for Nvidia Shield, TV, or laptop browser.
"""

import http.server
import socket
import socketserver
import os
import sys

PORT = 8080

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Prevent caching so edits or updates apply immediately
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    local_ip = get_local_ip()

    print("\n" + "=" * 60)
    print("  NAILSWORTH & STROUD AMBIENT WEATHER DASHBOARD")
    print("=" * 60)
    print(f"\n  [Laptop View]  http://localhost:{PORT}")
    print(f"\n  [TV / Nvidia Shield View] Type this into TV Bro or Samsung Browser:")
    print(f"    -> http://{local_ip}:{PORT}")
    print("\n" + "-" * 60)
    print("  * Fullscreen: Press 'F' on keyboard or click top-right icon.")
    print("  * Weather auto-refreshes every 15 minutes.")
    print("  * Press Ctrl+C to stop the server.")
    print("=" * 60 + "\n")

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nDashboard server stopped.")
            sys.exit(0)

if __name__ == '__main__':
    main()
