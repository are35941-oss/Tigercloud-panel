import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiRouter } from './server/routes.js';
import { setupWebSocket } from './server/wsHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// One-click raw script serving for VPS curl commands
app.get('/install.sh', (_req, res) => {
  const filePath = path.resolve(__dirname, 'install.sh');
  res.setHeader('Content-Type', 'text/x-shellscript; charset=utf-8');
  res.sendFile(filePath);
});

app.get('/install-node.sh', (_req, res) => {
  const filePath = path.resolve(__dirname, 'install-node.sh');
  res.setHeader('Content-Type', 'text/x-shellscript; charset=utf-8');
  res.sendFile(filePath);
});

app.get('/install-panel.sh', (_req, res) => {
  const filePath = path.resolve(__dirname, 'install-panel.sh');
  res.setHeader('Content-Type', 'text/x-shellscript; charset=utf-8');
  res.sendFile(filePath);
});

// Mount REST API
app.use('/api', apiRouter);

// Attach WebSocket server for live terminal and metrics
setupWebSocket(server);

async function startServer() {
  if (!isProd) {
    // Development mode: attach Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[ObsidianNode] Vite middleware integrated in development mode.');
  } else {
    // Production mode: serve static dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log(`[ObsidianNode] Serving production build from ${distPath}`);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[ObsidianNode] Minecraft Server Control Panel listening on http://0.0.0.0:${PORT}`);
    console.log(`[ObsidianNode] WebSocket Console endpoint active on ws://0.0.0.0:${PORT}/ws/console`);
  });
}

startServer().catch((err) => {
  console.error('[ObsidianNode] Fatal startup error:', err);
  process.exit(1);
});
