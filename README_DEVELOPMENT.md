# Development Setup

## Running Locally

ES modules require an HTTP server - you cannot open `index.html` directly with `file://` protocol due to CORS restrictions.

### Option 1: Python HTTP Server (Recommended)
```bash
# Python 3
python3 -m http.server 8000

# Then open: http://localhost:8000
```

### Option 2: Node.js http-server
```bash
# Install globally (one time)
npm install -g http-server

# Run server
http-server -p 8000

# Then open: http://localhost:8000
```

### Option 3: VS Code Live Server
If using VS Code, install the "Live Server" extension and click "Go Live"

### Option 4: npx serve
```bash
npx serve -p 8000
```

## Vercel Deployment

The game is ready for Vercel deployment. All files use relative paths and ES modules work correctly when served over HTTP/HTTPS.

### Deploy to Vercel
```bash
# Install Vercel CLI (one time)
npm install -g vercel

# Deploy
vercel

# Or connect your GitHub repo to Vercel for automatic deployments
```

## Troubleshooting

### CORS Error
If you see "Access to script... has been blocked by CORS policy":
- **Solution**: Use an HTTP server (see options above)
- **Never use**: `file://` protocol for ES modules

### Module Not Found
If you see "Failed to resolve module specifier":
- Check that all import paths use relative paths (`./` or `../`)
- Ensure all files exist in the correct locations
- Verify you're using an HTTP server, not `file://`

### WebGL Not Working
- Check browser console for WebGL errors
- Game will automatically fall back to Canvas 2D if WebGL unavailable
- Verify your browser supports WebGL: https://get.webgl.org/



