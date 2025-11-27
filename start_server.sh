#!/bin/bash
# Simple HTTP server startup script for StarCrewGame

cd "$(dirname "$0")"

# Kill any existing server on port 8000
lsof -ti:8000 | xargs kill -9 2>/dev/null

# Start Python HTTP server
echo "Starting server on http://localhost:8000"
echo "Open this URL in your browser: http://localhost:8000"
echo "Press Ctrl+C to stop the server"
python3 -m http.server 8000


