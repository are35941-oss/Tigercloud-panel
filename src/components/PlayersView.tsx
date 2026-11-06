import React, { useState, useEffect } from 'react';
import { 
  Users, UserCheck, Shield, Skull, MessageSquare, 
  Send, RefreshCw, Heart, Wifi, Check, AlertCircle, Ban 
} from 'lucide-react';
import { OnlinePlayer, MinecraftServer } from '../types';
import { api } from '../services/api';

interface PlayersViewProps {
  server: MinecraftServer;
}

export const PlayersView: React.FC<PlayersViewProps> = ({ server }) => {
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [whisperPlayer, setWhisperPlayer] = useState<string | null>(null);
  const [whisperMsg, setWhisperMsg] = useState('');
  const [sendingWhisper, setSendingWhisper] = useState(false);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const data = await api.getOnlinePlayers(server.id);
      setPlayers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlayers();
    const interval = setInterval(loadPlayers, 4000);
    return () => clearInterval(interval);
  }, [server.id]);

  const handleAction = async (playerName: string, action: string, reason?: string) => {
    try {
      await api.playerAction(server.id, playerName, action, reason);
      await loadPlayers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleKickPrompt = (player: OnlinePlayer) => {
    const reason = prompt(`Enter kick reason for ${player.name}:`, 'Kicked by administrator');
    if (reason !== null) {
      handleAction(player.name, 'kick', reason);
    }
  };

  const handleBanPrompt = (player: OnlinePlayer) => {
    const reason = prompt(`Enter permanent ban reason for ${player.name}:`, 'Violation of server rules');
    if (reason !== null) {
      handleAction(player.name, 'ban', reason);
    }
  };

  const handleSendWhisper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whisperPlayer || !whisperMsg.trim()) return;

    setSendingWhisper(true);
    try {
      await api.playerAction(server.id, whisperPlayer, 'whisper', undefined, whisperMsg.trim());
      setWhisperMsg('');
      setWhisperPlayer(null);
    } finally {
      setSendingWhisper(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Active Connected Players ({players.length} / {server.maxPlayers})</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time RCON and protocol player sessions. Instant kick, ban, op, and whisper commands.
          </p>
        </div>

        <button
          onClick={loadPlayers}
          className="p-1.5 text-slate-400 hover:text-white bg-[#111622] border border-slate-800 rounded-md"
          title="Refresh Player Roster"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {server.status !== 'RUNNING' ? (
        <div className="p-12 text-center bg-[#111622] border border-slate-800 rounded-lg text-slate-400 text-xs">
          Server is currently offline. Start the server container to monitor active players.
        </div>
      ) : loading && players.length === 0 ? (
        <div className="p-12 text-center text-xs font-mono text-slate-500">
          Querying server playerlist...
        </div>
      ) : players.length === 0 ? (
        <div className="p-12 text-center bg-[#111622] border border-slate-800 rounded-lg text-slate-400 text-xs">
          No players currently online on port :{server.port}.
        </div>
      ) : (
        <div className="bg-[#111622] border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0e131f] border-b border-slate-800 text-slate-400 font-mono">
              <tr>
                <th className="py-3 px-4 font-medium">Player</th>
                <th className="py-3 px-4 font-medium">Status & Role</th>
                <th className="py-3 px-4 font-medium">Game Mode</th>
                <th className="py-3 px-4 font-medium">Health</th>
                <th className="py-3 px-4 font-medium">Latency</th>
                <th className="py-3 px-4 font-medium text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {players.map((player) => (
                <tr key={player.uuid} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs">
                        {player.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{player.name}</div>
                        <div className="text-[10px] font-mono text-slate-500">{player.uuid.slice(0, 16)}...</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      {player.isOp ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                          <Shield className="w-3 h-3 fill-current" />
                          OP
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">Player</span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-4 font-mono text-slate-300 capitalize text-xs">
                    {player.gamemode}
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 text-rose-400 font-mono text-xs">
                      <Heart className="w-3.5 h-3.5 fill-current" />
                      <span>{player.health}/20</span>
                    </div>
                  </td>

                  <td className="py-3 px-4 font-mono text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <Wifi className="w-3 h-3 text-emerald-400" />
                      <span>{player.pingMs}ms</span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setWhisperPlayer(player.name)}
                        title="Send Private Message"
                        className="px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Msg</span>
                      </button>

                      {player.isOp ? (
                        <button
                          onClick={() => handleAction(player.name, 'deop')}
                          title="Demote from Operator"
                          className="px-2 py-1 text-[11px] font-medium text-amber-400 hover:bg-amber-500/20 bg-amber-500/10 rounded transition-colors"
                        >
                          De-OP
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction(player.name, 'op')}
                          title="Promote to Operator"
                          className="px-2 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/20 bg-emerald-500/10 rounded transition-colors"
                        >
                          OP
                        </button>
                      )}

                      <button
                        onClick={() => handleKickPrompt(player)}
                        title="Kick Player"
                        className="px-2 py-1 text-[11px] font-medium text-rose-400 hover:bg-rose-500/20 bg-rose-500/10 rounded transition-colors"
                      >
                        Kick
                      </button>

                      <button
                        onClick={() => handleBanPrompt(player)}
                        title="Ban Player"
                        className="px-2 py-1 text-[11px] font-medium text-rose-500 hover:bg-rose-500/30 bg-rose-900/30 rounded transition-colors"
                      >
                        Ban
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Whisper Modal */}
      {whisperPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-[#0f1420] border border-slate-800 rounded-xl shadow-2xl p-5">
            <h4 className="text-sm font-bold text-white mb-1">
              Send Direct Message to {whisperPlayer}
            </h4>
            <p className="text-xs text-slate-400 mb-3">
              Delivered via RCON direct tell channel (`/tell {whisperPlayer} &lt;msg&gt;`)
            </p>

            <form onSubmit={handleSendWhisper}>
              <textarea
                value={whisperMsg}
                onChange={(e) => setWhisperMsg(e.target.value)}
                placeholder="Enter whisper message..."
                rows={3}
                required
                className="w-full bg-[#151c2c] border border-slate-700 text-xs text-white p-3 rounded focus:outline-none focus:border-emerald-500"
              />

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWhisperPlayer(null)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingWhisper || !whisperMsg.trim()}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded"
                >
                  {sendingWhisper ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
