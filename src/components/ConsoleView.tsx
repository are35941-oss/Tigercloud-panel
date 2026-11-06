import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Trash2, Copy, Check, ArrowDownCircle, 
  Terminal as TerminalIcon, Sparkles, RefreshCw, Zap
} from 'lucide-react';
import { MinecraftServer, ConsoleLogMessage, ServerStats } from '../types';

interface ConsoleViewProps {
  server: MinecraftServer;
  onSendCommand: (command: string) => Promise<void>;
  stats: ServerStats | null;
}

export const ConsoleView: React.FC<ConsoleViewProps> = ({ server, onSendCommand, stats }) => {
  const [logs, setLogs] = useState<ConsoleLogMessage[]>([]);
  const [inputCommand, setInputCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket Connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/console`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      // Subscribe to this server
      ws.send(JSON.stringify({ type: 'subscribe', serverId: server.id }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'log' && msg.data?.serverId === server.id) {
          setLogs((prev) => [...prev, msg.data]);
        }
      } catch (err) {
        // ignore
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [server.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cmd = inputCommand.trim();
    if (!cmd) return;

    // Send via WebSocket or HTTP fallback
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'command',
        serverId: server.id,
        command: cmd,
      }));
    } else {
      await onSendCommand(cmd);
    }

    setHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setInputCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInputCommand(history[nextIndex] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(-1);
        setInputCommand('');
      } else {
        setHistoryIndex(nextIndex);
        setInputCommand(history[nextIndex] || '');
      }
    }
  };

  const handleCopyLogs = () => {
    const text = logs.map((l) => `[${l.timestamp}] ${l.line}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setLogs([]);
  };

  const renderLogLine = (log: ConsoleLogMessage, idx: number) => {
    let colorClass = 'text-slate-300';
    if (log.level === 'error' || log.line.includes('ERROR') || log.line.includes('Exception')) {
      colorClass = 'text-rose-400 font-semibold';
    } else if (log.level === 'warn' || log.line.includes('WARN')) {
      colorClass = 'text-amber-300';
    } else if (log.level === 'command') {
      colorClass = 'text-emerald-400 font-bold';
    } else if (log.level === 'system') {
      colorClass = 'text-sky-400 font-medium';
    } else if (log.line.includes('Done (') || log.line.includes('ONLINE')) {
      colorClass = 'text-emerald-300 font-semibold';
    }

    // Clean up Minecraft legacy section color codes (§a, §f, etc.) if present
    const cleanLine = log.line.replace(/§[0-9a-fk-or]/gi, '');

    return (
      <div key={idx} className="flex items-start gap-2 py-0.5 leading-relaxed hover:bg-slate-900/40 px-1 rounded">
        <span className="text-slate-600 select-none text-[11px] font-mono shrink-0 tabular-nums">
          {log.timestamp}
        </span>
        <span className={`font-mono text-xs break-all whitespace-pre-wrap ${colorClass}`}>
          {cleanLine}
        </span>
      </div>
    );
  };

  const quickCommands = [
    { label: '/list', cmd: '/list' },
    { label: '/tps', cmd: '/tps' },
    { label: '/time set day', cmd: '/time set day' },
    { label: '/say Hello!', cmd: '/say Welcome to the server!' },
    { label: '/help', cmd: '/help' },
  ];

  return (
    <div className="flex flex-col h-[650px] bg-[#0c0f17] border border-slate-800 rounded-lg overflow-hidden shadow-xl">
      {/* Console Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#111622] border-b border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50' : 'bg-rose-500'
              }`}
            />
            <span className="font-mono font-medium text-slate-300">
              {isConnected ? 'Terminal Stream Connected' : 'Reconnecting WebSocket...'}
            </span>
          </div>

          {stats && (
            <div className="hidden sm:flex items-center gap-2 text-slate-400 font-mono text-[11px] border-l border-slate-800 pl-3">
              <span>TPS: <b className="text-emerald-400">{stats.tps.toFixed(1)}</b></span>
              <span>·</span>
              <span>Online: <b className="text-white">{stats.onlinePlayers}/{stats.maxPlayers}</b></span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              autoScroll ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Auto-scroll {autoScroll ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={handleCopyLogs}
            title="Copy console output"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleClear}
            title="Clear console view"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className="flex-1 overflow-y-auto p-4 space-y-0.5 font-mono select-text bg-[#090c13]">
        {logs.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-xs font-mono">
            Waiting for server container logs stream...
            <div className="text-[11px] text-slate-600 mt-1">
              Start the server or run commands to view live stdout/stderr.
            </div>
          </div>
        ) : (
          logs.map((log, idx) => renderLogLine(log, idx))
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Quick Command Suggestions */}
      <div className="px-3 py-1.5 bg-[#111622]/60 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto">
        <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap pl-1">Quick:</span>
        {quickCommands.map((q) => (
          <button
            key={q.cmd}
            onClick={() => {
              setInputCommand(q.cmd);
            }}
            className="px-2 py-0.5 text-[11px] font-mono text-slate-400 hover:text-emerald-300 hover:bg-slate-800 border border-slate-800 rounded whitespace-nowrap transition-colors"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Command Input Prompt */}
      <form onSubmit={handleSubmit} className="p-3 bg-[#111622] border-t border-slate-800 flex items-center gap-2">
        <span className="text-emerald-400 font-mono font-bold text-sm select-none pl-1">&gt;</span>
        <input
          type="text"
          value={inputCommand}
          onChange={(e) => setInputCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={server.status === 'RUNNING' ? 'Type a Minecraft command (e.g. /say, /op, /time set day)...' : 'Server is offline. Start server to execute commands.'}
          disabled={server.status !== 'RUNNING'}
          className="flex-1 bg-transparent text-sm font-mono text-white placeholder-slate-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputCommand.trim() || server.status !== 'RUNNING'}
          className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 disabled:hover:bg-emerald-400 rounded transition-colors flex items-center gap-1"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Execute</span>
        </button>
      </form>
    </div>
  );
};
