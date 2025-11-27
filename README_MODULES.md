# Running the Game

The game now uses ES6 modules, which requires it to be served from a web server (not opened directly as a file).

## Quick Start

1. **Using Python (recommended):**
   ```bash
   python3 -m http.server 8000
   ```
   Then open: http://localhost:8000

2. **Using Node.js:**
   ```bash
   npx http-server -p 8000
   ```
   Then open: http://localhost:8000

3. **Using VS Code:**
   - Install "Live Server" extension
   - Right-click on `index.html` and select "Open with Live Server"

## Troubleshooting

If the game doesn't load:
- Make sure you're accessing it via `http://localhost:8000` (not `file://`)
- Check the browser console for errors (F12)
- Ensure all module files are in the correct locations under `src/`



