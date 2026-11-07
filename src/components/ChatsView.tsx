/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Send,
  Paperclip,
  Mic,
  Smile,
  Check,
  CheckCheck,
  Lock,
  ArrowLeft,
  Share2,
  FileText,
  Play,
  Pause,
  AlertTriangle,
  Radio,
  CornerDownRight,
  Sparkles,
} from 'lucide-react';
import { MeshNode, MeshPacket, FileFragmentPayload, VoiceNotePayload } from '../utils/meshProtocol';
import { UserIdentity, EncryptedEnvelope } from '../utils/crypto';
import { VoiceNoteRecorder } from './VoiceNoteRecorder';
import { FileTransferManager } from '../utils/fileTransfer';
import { parseIrcCommand } from '../utils/ircCommands';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  timestamp: number;
  text?: string;
  file?: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    dataUrl: string;
    checksum: string;
  };
  voiceNote?: VoiceNotePayload;
  status: 'sending' | 'relayed' | 'delivered' | 'read';
  hopCount: number;
  relayNodes?: string[];
  isEncrypted: boolean;
  replyToText?: string;
  reactions?: Record<string, number>;
}

interface ChatsViewProps {
  myIdentity: UserIdentity;
  nodes: MeshNode[];
  activePeer: MeshNode | null;
  messages: ChatMessage[];
  onSelectPeer: (peer: MeshNode) => void;
  onSendMessage: (recipientId: string, text: string, replyTo?: string) => void;
  onSendFile: (recipientId: string, file: File) => void;
  onSendVoiceNote: (recipientId: string, voiceNote: VoiceNotePayload) => void;
  onVerifyPeer: (peer: MeshNode) => void;
  onExecuteIrcCommand: (commandStr: string) => void;
}

export const ChatsView: React.FC<ChatsViewProps> = ({
  myIdentity,
  nodes,
  activePeer,
  messages,
  onSelectPeer,
  onSendMessage,
  onSendFile,
  onSendVoiceNote,
  onVerifyPeer,
  onExecuteIrcCommand,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Filter messages for active peer
  const activeConversationMessages = activePeer
    ? messages.filter(
        (m) =>
          (m.senderId === myIdentity.id && m.recipientId === activePeer.id) ||
          (m.senderId === activePeer.id && m.recipientId === myIdentity.id)
      )
    : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversationMessages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    if (text.startsWith('/')) {
      onExecuteIrcCommand(text);
      setInputText('');
      setReplyTarget(null);
      return;
    }

    if (activePeer) {
      onSendMessage(activePeer.id, text, replyTarget?.text);
      setInputText('');
      setReplyTarget(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activePeer) {
      onSendFile(activePeer.id, file);
    }
    if (e.target) e.target.value = '';
  };

  const handleToggleVoicePlay = (voiceNote: VoiceNotePayload) => {
    if (playingVoiceId === voiceNote.voiceId) {
      audioPlayerRef.current?.pause();
      setPlayingVoiceId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(voiceNote.audioBlobBase64);
      audioPlayerRef.current = audio;
      audio.onended = () => setPlayingVoiceId(null);
      audio.play().catch(console.warn);
      setPlayingVoiceId(voiceNote.voiceId);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-slate-950">
      {/* Left Column: Peers / Chats List */}
      <div
        className={`w-full sm:w-80 border-r border-slate-800 bg-slate-900/40 flex flex-col h-full ${
          activePeer ? 'hidden sm:flex' : 'flex'
        }`}
      >
        <div className="p-4 border-b border-slate-800/80">
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            DIRECT E2EE CONVERSATIONS
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Cryptographically sealed • Multi-hop relay safe
          </p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {nodes.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No peers discovered yet. Check the Nearby tab to scan RF frequencies.
            </div>
          ) : (
            nodes.map((node) => {
              const isSelected = activePeer?.id === node.id;
              const lastMsg = messages
                .filter(
                  (m) =>
                    (m.senderId === myIdentity.id && m.recipientId === node.id) ||
                    (m.senderId === node.id && m.recipientId === myIdentity.id)
                )
                .slice(-1)[0];

              return (
                <button
                  key={node.id}
                  onClick={() => onSelectPeer(node)}
                  className={`w-full p-3.5 text-left flex items-start gap-3 transition-colors ${
                    isSelected ? 'bg-emerald-950/40 border-l-2 border-emerald-500' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 text-sm shrink-0">
                    {node.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-200 text-xs truncate">{node.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {node.hopDistance === 1 ? '1-hop' : `${node.hopDistance}h`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-mono text-emerald-400">{node.shortFingerprint}</span>
                      {node.isVerified && (
                        <span title="Verified">
                          <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 truncate mt-1">
                      {lastMsg ? (
                        lastMsg.text || (lastMsg.file ? `📎 ${lastMsg.file.fileName}` : '🎙️ Voice note')
                      ) : (
                        <span className="text-slate-500 italic">No messages yet</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Active Conversation */}
      {activePeer ? (
        <div className="flex-1 flex flex-col h-full bg-slate-950">
          {/* Top Conversation Header */}
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onSelectPeer(null as any)}
                className="sm:hidden p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 text-xs">
                {activePeer.name.slice(0, 2).toUpperCase()}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-100 text-sm">{activePeer.name}</span>
                  {activePeer.isVerified ? (
                    <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-mono flex items-center gap-1">
                      <ShieldCheck className="w-2.5 h-2.5" /> VERIFIED
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[9px] font-mono">
                      UNVERIFIED
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                  <span className="text-emerald-400">{activePeer.shortFingerprint}</span>
                  <span>•</span>
                  <span>{activePeer.rssi} dBm</span>
                  <span>•</span>
                  <span>{activePeer.isDirectNeighbor ? 'Direct BLE' : `Relayed via ${activePeer.hopDistance} hops`}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onVerifyPeer(activePeer)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
                title="Verify Recipient Cryptographic Fingerprint"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline">Verify Fingerprint</span>
              </button>
            </div>
          </div>

          {/* E2EE Banner Notice */}
          <div className="px-4 py-2 bg-emerald-950/20 border-b border-emerald-900/30 flex items-center justify-center gap-2 text-[11px] text-emerald-400/90 font-mono">
            <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>End-to-End Encrypted (ChaCha20-Poly1305 • X25519). Intermediate relays carry opaque ciphertext.</span>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeConversationMessages.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-emerald-400">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="text-xs font-semibold text-slate-300">Secure Direct Channel Established</div>
                <div className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Type a message below or send a voice note / file fragment. Packets route hop-by-hop across nearby devices.
                </div>
              </div>
            ) : (
              activeConversationMessages.map((msg) => {
                const isMine = msg.senderId === myIdentity.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} space-y-1`}
                  >
                    {/* Reply quote banner if present */}
                    {msg.replyToText && (
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800 max-w-sm truncate">
                        <CornerDownRight className="w-3 h-3 text-emerald-400" />
                        <span>Replying to: "{msg.replyToText}"</span>
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[85%] sm:max-w-md rounded-2xl p-3 text-xs leading-relaxed shadow-md relative group ${
                        isMine
                          ? 'bg-emerald-600 text-white rounded-br-xs'
                          : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-xs'
                      }`}
                    >
                      {/* Sender label if received */}
                      {!isMine && (
                        <div className="text-[10px] font-bold text-emerald-400 mb-1 flex items-center justify-between">
                          <span>{msg.senderName}</span>
                          <span className="font-mono text-[9px] text-slate-400">
                            {msg.hopCount === 0 ? 'Direct' : `${msg.hopCount} hops`}
                          </span>
                        </div>
                      )}

                      {/* Text content */}
                      {msg.text && <div className="whitespace-pre-wrap break-words">{msg.text}</div>}

                      {/* File Card */}
                      {msg.file && (
                        <div className="mt-1.5 p-2 bg-black/25 rounded-xl border border-white/10 space-y-1.5">
                          {msg.file.mimeType.startsWith('image/') ? (
                            <img
                              src={msg.file.dataUrl}
                              alt={msg.file.fileName}
                              className="rounded-lg max-h-48 w-full object-cover border border-white/10"
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <FileText className="w-5 h-5 text-emerald-300 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium truncate">{msg.file.fileName}</div>
                                <div className="text-[10px] opacity-75">{formatFileSize(msg.file.fileSize)}</div>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[9px] font-mono opacity-80">
                            <span>SHA-256 Verified</span>
                            <a
                              href={msg.file.dataUrl}
                              download={msg.file.fileName}
                              className="underline hover:text-white"
                            >
                              Download
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Voice Note Player */}
                      {msg.voiceNote && (
                        <div className="mt-1 p-2 bg-black/20 rounded-xl flex items-center gap-2.5">
                          <button
                            onClick={() => handleToggleVoicePlay(msg.voiceNote!)}
                            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors shrink-0"
                          >
                            {playingVoiceId === msg.voiceNote.voiceId ? (
                              <Pause className="w-4 h-4 fill-current" />
                            ) : (
                              <Play className="w-4 h-4 fill-current" />
                            )}
                          </button>

                          <div className="flex-1 flex items-center gap-0.5 h-5">
                            {msg.voiceNote.waveform.slice(0, 16).map((val, idx) => (
                              <div
                                key={idx}
                                className="w-1 bg-white/60 rounded-full"
                                style={{ height: `${Math.max(4, Math.min(18, (val / 100) * 18))}px` }}
                              />
                            ))}
                          </div>

                          <span className="text-[10px] font-mono opacity-80">
                            {Math.round(msg.voiceNote.durationMs / 1000)}s
                          </span>
                        </div>
                      )}

                      {/* Message Footer */}
                      <div
                        className={`flex items-center justify-end gap-1.5 mt-1 text-[9px] font-mono ${
                          isMine ? 'text-emerald-100/80' : 'text-slate-400'
                        }`}
                      >
                        <span>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMine && (
                          <span>
                            {msg.status === 'sending' && '⏳'}
                            {msg.status === 'relayed' && <Check className="w-3 h-3 inline" />}
                            {(msg.status === 'delivered' || msg.status === 'read') && (
                              <CheckCheck className="w-3 h-3 inline text-emerald-200" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick action bar on hover */}
                    <button
                      onClick={() => setReplyTarget(msg)}
                      className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-500 hover:text-slate-300 transition-opacity px-1"
                    >
                      Reply
                    </button>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice Note Recorder Drawer if active */}
          {isRecordingVoice && (
            <div className="p-3 border-t border-slate-800 bg-slate-900/90">
              <VoiceNoteRecorder
                onSendVoiceNote={(payload) => {
                  onSendVoiceNote(activePeer.id, payload);
                  setIsRecordingVoice(false);
                }}
                onCancel={() => setIsRecordingVoice(false)}
              />
            </div>
          )}

          {/* Reply Quote Banner */}
          {replyTarget && (
            <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-2 truncate">
                <CornerDownRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-slate-400">Replying to:</span>
                <span className="truncate italic font-mono text-emerald-300">{replyTarget.text || 'Attachment'}</span>
              </div>
              <button
                onClick={() => setReplyTarget(null)}
                className="text-slate-400 hover:text-slate-200 text-xs px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Input Bar */}
          {!isRecordingVoice && (
            <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-900/50 flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
                title="Send File Fragment (Images, PDF, Docs)"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsRecordingVoice(true)}
                className="p-2.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-xl transition-colors"
                title="Record Voice Note"
              >
                <Mic className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Encrypted message (or /help for IRC commands)..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30"
              />

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl transition-colors shadow-md shadow-emerald-950/40"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="hidden sm:flex flex-1 flex-col items-center justify-center p-8 text-center bg-slate-950">
          <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 mb-4 shadow-xl">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-200">Decentralized Offline E2EE Messenger</h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
            Select a nearby mesh participant from the left panel to open a multi-hop encrypted channel, or join public broadcast rooms in the Channels tab.
          </p>
        </div>
      )}
    </div>
  );
};
