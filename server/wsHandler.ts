import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { dockerManager } from './dockerManager.js';
import { db } from './database.js';

interface ClientSubscription {
  ws: WebSocket;
  currentServerId?: string;
  unsubscribeLogs?: () => void;
  unsubscribeStats?: () => void;
}

export function setupWebSocket(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/console' });
  const clients = new Map<WebSocket, ClientSubscription>();

  wss.on('connection', (ws: WebSocket) => {
    const sub: ClientSubscription = { ws };
    clients.set(ws, sub);

    // Send initial system info
    ws.send(JSON.stringify({
      type: 'docker_info',
      info: dockerManager.getDockerStatus(),
    }));

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'subscribe') {
          const { serverId } = data;
          if (!serverId) return;

          // Unsubscribe from previous
          if (sub.unsubscribeLogs) sub.unsubscribeLogs();
          if (sub.unsubscribeStats) sub.unsubscribeStats();

          sub.currentServerId = serverId;

          // Subscribe to logs
          sub.unsubscribeLogs = dockerManager.subscribeLogs(serverId, (log) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'log', data: log }));
            }
          });

          // Subscribe to stats
          sub.unsubscribeStats = dockerManager.subscribeStats(serverId, (stats) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'stats', data: stats }));
            }
          });

          const server = db.getServer(serverId);
          if (server && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'server_state',
              data: { id: server.id, status: server.status }
            }));
          }
        }

        if (data.type === 'command') {
          const { serverId, command } = data;
          if (!serverId || !command) return;
          const server = db.getServer(serverId);
          if (server) {
            dockerManager.sendCommand(server, command);
          }
        }

        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }

      } catch (err) {
        console.error('Error handling WS message:', err);
      }
    });

    ws.on('close', () => {
      if (sub.unsubscribeLogs) sub.unsubscribeLogs();
      if (sub.unsubscribeStats) sub.unsubscribeStats();
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('WS client error:', err);
    });
  });

  return wss;
}
