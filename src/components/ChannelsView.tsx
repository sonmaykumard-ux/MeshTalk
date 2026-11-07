/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Hash,
  Lock,
  Users,
  Plus,
  Send,
  Radio,
  AlertOctagon,
  Sparkles,
  Smile,
  Shield,
  Key,
} from 'lucide-react';
import { UserIdentity, deriveChannelKey } from '../utils/crypto';
import { MeshNode } from '../utils/meshProtocol';

export interface ChannelMessage {
  id: string;
  channel: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  text: string;
  hopCount: number;
  isEmergencyAlert?: boolean;
  reactions?: Record<string, number>;
}

export interface ChannelInfo {
  name: string;
  description: string;
  isPasswordProtected: boolean;
  password?: string;
  memberCount: number;
}

const DEFAULT_CHANNELS: ChannelInfo[] = [
  {
    name: '#general',
    description: 'Public mesh local broadcast frequency for all nearby participants',
    isPasswordProtected: false,
    memberCount: 5,
  },
  {
    name: '#emergency',
    description: 'High-priority distress beacons and emergency civil defense alerts',
    isPasswordProtected: false,
    memberCount: 5,
  },
  {
    name: '#offgrid',
    description: 'Backcountry, ham radio, solar and decentralized topology coordination',
    isPasswordProtected: false,
    memberCount: 3,
  },
  {
    name: '#tactical',
    description: 'Cryptographically protected team room with derived PBKDF2 channel key',
    isPasswordProtected: true,
    memberCount: 2,
  },
];

interface ChannelsViewProps {
  myIdentity: UserIdentity;
  nodes: MeshNode[];
  messages: ChannelMessage[];
  activeChannel: string;
  onSelectChannel: (channelName: string) => void;
  onSendMessage: (channelName: string, text: string) => void;
  onExecuteIrcCommand: (command: string) => void;
}

export const ChannelsView: React.FC<ChannelsViewProps> = ({
  myIdentity,
  nodes,
  messages,
  activeChannel,
  onSelectChannel,
  onSendMessage,
  onExecuteIrcCommand,
}) => {
  const [channels, setChannels] = useState<ChannelInfo[]>(DEFAULT_CHANNELS);
  const [inputText, setInputText] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChanName, setNewChanName] = useState('');
  const [newChanDesc, setNewChanDesc] = useState('');
  const [isProtected, setIsProtected] = useState(false);
  const [newChanPass, setNewChanPass] = useState('');
  const [showMembersList, setShowMembersList] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const currentChannelInfo = channels.find((c) => c.name.toLowerCase() === activeChannel.toLowerCase()) || {
    name: activeChannel,
    description: 'Local ad-hoc mesh frequency',
    isPasswordProtected: false,
    memberCount: nodes.length + 1,
  };

  const channelMessages = messages.filter(
    (m) => m.channel.toLowerCase() === activeChannel.toLowerCase()
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    if (text.startsWith('/')) {
      onExecuteIrcCommand(text);
      setInputText('');
      return;
    }

    onSendMessage(activeChannel, text);
    setInputText('');
  };

  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    let name = newChanName.trim();
    if (!name) return;
    if (!name.startsWith('#')) name = `#${name}`;

    const newChan: ChannelInfo = {
      name,
      description: newChanDesc.trim() || 'Custom mesh channel',
      isPasswordProtected: isProtected,
      password: isProtected ? newChanPass : undefined,
      memberCount: 1,
    };

    setChannels((prev) => [...prev, newChan]);
    onSelectChannel(name);
    setShowCreateModal(false);
    setNewChanName('');
    setNewChanDesc('');
    setIsProtected(false);
    setNewChanPass('');
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-slate-950">
      {/* Channels Sidebar */}
      <div className="w-64 sm:w-72 border-r border-slate-800 bg-slate-900/40 flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Hash className="w-4 h-4 text-emerald-400" />
              MESH CHANNELS
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">IRC-style public & private rooms</p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
            title="Create Channel"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {channels.map((chan) => {
            const isSelected = chan.name.toLowerCase() === activeChannel.toLowerCase();
            return (
              <button
                key={chan.name}
                onClick={() => onSelectChannel(chan.name)}
                className={`w-full p-2.5 rounded-xl text-left flex items-start gap-2.5 transition-colors ${
                  isSelected
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                {chan.isPasswordProtected ? (
                  <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : chan.name === '#emergency' ? (
                  <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                ) : (
                  <Hash className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs truncate">{chan.name}</span>
                    <span className="text-[10px] opacity-60 font-mono">{chan.memberCount}p</span>
                  </div>
                  <div className="text-[11px] opacity-75 truncate">{chan.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Quick IRC Pills footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
          <div className="text-[10px] uppercase font-mono text-slate-500 mb-1.5">IRC Shortcuts</div>
          <div className="flex flex-wrap gap-1 text-[10px] font-mono">
            <button
              onClick={() => onExecuteIrcCommand('/who')}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
            >
              /who
            </button>
            <button
              onClick={() => onExecuteIrcCommand('/status')}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
            >
              /status
            </button>
            <button
              onClick={() => onExecuteIrcCommand('/help')}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
            >
              /help
            </button>
          </div>
        </div>
      </div>

      {/* Main Channel Message Feed */}
      <div className="flex-1 flex flex-col h-full bg-slate-950">
        {/* Channel Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
              {currentChannelInfo.isPasswordProtected ? (
                <Lock className="w-4 h-4 text-amber-400" />
              ) : currentChannelInfo.name === '#emergency' ? (
                <AlertOctagon className="w-4 h-4 text-red-400" />
              ) : (
                <Hash className="w-4 h-4" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100 text-sm">{currentChannelInfo.name}</span>
                {currentChannelInfo.isPasswordProtected && (
                  <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[9px] font-mono">
                    PBKDF2 KEY PROTECTED
                  </span>
                )}
                {currentChannelInfo.name === '#emergency' && (
                  <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[9px] font-mono animate-pulse">
                    EMERGENCY PRIORITY
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{currentChannelInfo.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMembersList(!showMembersList)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>{nodes.length + 1} online</span>
            </button>
          </div>
        </div>

        {/* Public Channel Notice */}
        <div className="px-4 py-1.5 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-center text-[11px] text-slate-400 font-mono">
          <span>PUBLIC BROADCAST FREQUENCY • Relayed across all participating BLE mesh nodes</span>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {channelMessages.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-500">
              No broadcast transmissions on {activeChannel} yet. Be the first to broadcast to nearby mesh participants.
            </div>
          ) : (
            channelMessages.map((msg) => {
              const isMine = msg.senderId === myIdentity.id;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-lg rounded-2xl p-3 text-xs leading-relaxed shadow-sm ${
                      msg.isEmergencyAlert
                        ? 'bg-red-950/60 border border-red-500/50 text-red-100'
                        : isMine
                        ? 'bg-emerald-600 text-white rounded-br-xs'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-xs'
                    }`}
                  >
                    {/* Header info */}
                    <div className="flex items-center justify-between gap-3 text-[10px] mb-1">
                      <span className="font-bold text-emerald-300">{msg.senderName}</span>
                      <span className="font-mono opacity-70">
                        {msg.hopCount === 0 ? 'Local' : `${msg.hopCount} hops`}
                      </span>
                    </div>

                    {/* Text */}
                    <div className="whitespace-pre-wrap break-words">{msg.text}</div>

                    {/* Time */}
                    <div
                      className={`text-right text-[9px] font-mono mt-1 ${
                        isMine ? 'text-emerald-100/80' : 'text-slate-400'
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-900/50 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Message ${activeChannel} (or /nick, /who, /status, /help)...`}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 font-sans"
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl transition-colors shadow-md shadow-emerald-950/40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Create Channel Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 mb-1">Create Local Mesh Channel</h3>
            <p className="text-xs text-slate-400 mb-4">
              Channels propagate through BLE mesh nodes without internet servers.
            </p>

            <form onSubmit={handleCreateChannel} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 mb-1 block">Channel Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. #camp-team"
                  value={newChanName}
                  onChange={(e) => setNewChanName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 mb-1 block">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Search party coordination"
                  value={newChanDesc}
                  onChange={(e) => setNewChanDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer">
                    <Key className="w-3.5 h-3.5 text-amber-400" /> Password Protect
                  </label>
                  <input
                    type="checkbox"
                    checked={isProtected}
                    onChange={(e) => setIsProtected(e.target.checked)}
                    className="accent-amber-500"
                  />
                </div>
                {isProtected && (
                  <input
                    type="password"
                    required
                    placeholder="Enter channel secret passphrase"
                    value={newChanPass}
                    onChange={(e) => setNewChanPass(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
