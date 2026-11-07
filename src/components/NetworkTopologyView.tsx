/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Activity,
  Radio,
  Share2,
  Inbox,
  Globe,
  WifiOff,
  Battery,
  Shield,
  Clock,
  ArrowRight,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { MeshNode, BatteryPowerMode, StoredCourierMail } from '../utils/meshProtocol';
import { TransportStatus } from '../utils/meshTransports';
import { UserIdentity } from '../utils/crypto';

interface NetworkTopologyViewProps {
  myIdentity: UserIdentity;
  nodes: MeshNode[];
  transportStatus: TransportStatus;
  powerMode: BatteryPowerMode;
  courierMailbox: StoredCourierMail[];
  lastTxTimestamp: number;
  onToggleNostrFallback: (enabled: boolean) => void;
  onSetPowerMode: (mode: BatteryPowerMode) => void;
  onRefreshScan: () => void;
}

export const NetworkTopologyView: React.FC<NetworkTopologyViewProps> = ({
  myIdentity,
  nodes,
  transportStatus,
  powerMode,
  courierMailbox,
  lastTxTimestamp,
  onToggleNostrFallback,
  onSetPowerMode,
  onRefreshScan,
}) => {
  const [selectedNode, setSelectedNode] = useState<MeshNode | null>(null);
  const [showCourierDrawer, setShowCourierDrawer] = useState(false);

  // Layout node coordinates around center
  const centerX = 300;
  const centerY = 200;
  const radius = 130;

  const nodePositions = nodes.map((node, index) => {
    const angle = (index / Math.max(1, nodes.length)) * 2 * Math.PI - Math.PI / 2;
    const distanceMultiplier = node.hopDistance === 1 ? 0.75 : 1.25;
    return {
      node,
      x: centerX + Math.cos(angle) * (radius * distanceMultiplier),
      y: centerY + Math.sin(angle) * (radius * distanceMultiplier),
    };
  });

  const activeRelays = nodes.filter((n) => n.forwardedCount > 0 || n.hopDistance > 1).length;
  const avgRssi = nodes.length > 0 ? Math.round(nodes.reduce((acc, n) => acc + n.rssi, 0) / nodes.length) : -70;
  const linkQualityScore = Math.max(20, Math.min(100, Math.round(100 - (Math.abs(avgRssi) - 40) * 1.2)));

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto">
      {/* Top Banner & Diagnostic KPI strip */}
      <div className="p-4 sm:p-6 border-b border-slate-800/80 bg-slate-900/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <h2 className="text-base font-bold text-slate-100 tracking-wide">
                BLE MESH TOPOLOGY & ROUTING ENGINE
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-hop RF ad-hoc packet dissemination with loop prevention and DTN store-and-forward
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshScan}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Scan RF
            </button>

            <button
              onClick={() => setShowCourierDrawer(!showCourierDrawer)}
              className="px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Inbox className="w-3.5 h-3.5" />
              Courier Mailbox ({courierMailbox.length})
            </button>
          </div>
        </div>

        {/* Diagnostic Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-950/90 border border-slate-800 p-3 rounded-xl">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
              Active Mesh Nodes
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-100 mt-1">
              {nodes.length + 1}{' '}
              <span className="text-xs font-normal text-slate-400">({nodes.length} remote)</span>
            </div>
          </div>

          <div className="bg-slate-950/90 border border-slate-800 p-3 rounded-xl">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
              Relay Participants
              <Share2 className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-100 mt-1">
              {activeRelays}{' '}
              <span className="text-xs font-normal text-slate-400">nodes</span>
            </div>
          </div>

          <div className="bg-slate-950/90 border border-slate-800 p-3 rounded-xl">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
              Link Quality
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {linkQualityScore}%{' '}
              <span className="text-xs font-normal text-slate-400 font-sans">({avgRssi} dBm)</span>
            </div>
          </div>

          <div className="bg-slate-950/90 border border-slate-800 p-3 rounded-xl">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
              Packets Processed
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-100 mt-1">
              {transportStatus.totalTxPackets + transportStatus.totalRxPackets + transportStatus.totalRelayedPackets}
              <span className="text-xs font-normal text-slate-400 ml-1">pkts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Body: Graph Visualizer + Details */}
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Topology Graph Canvas */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden shadow-inner">
          <div className="flex items-center justify-between z-10">
            <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Live RF Spatial Topology
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Last TX: {lastTxTimestamp ? `${Math.round((Date.now() - lastTxTimestamp) / 1000)}s ago` : 'Idle'}
            </div>
          </div>

          {/* SVG Visualizer */}
          <div className="w-full flex-1 flex items-center justify-center my-4 overflow-x-auto">
            <svg
              viewBox="0 0 600 400"
              className="w-full max-w-[600px] h-auto select-none"
              style={{ filter: 'drop-shadow(0 0 16px rgba(16, 185, 129, 0.05))' }}
            >
              {/* Concentric RF distance radar rings */}
              <circle cx={centerX} cy={centerY} r={80} fill="none" stroke="#1e293b" strokeDasharray="4 4" />
              <circle cx={centerX} cy={centerY} r={140} fill="none" stroke="#1e293b" strokeDasharray="4 4" />
              <circle cx={centerX} cy={centerY} r={190} fill="none" stroke="#0f172a" strokeDasharray="6 6" />

              {/* Edge Links from local node to 1-hop nodes */}
              {nodePositions.map(({ node, x, y }) => {
                const isDirect = node.hopDistance === 1;
                return (
                  <g key={`edge-${node.id}`}>
                    <line
                      x1={centerX}
                      y1={centerY}
                      x2={x}
                      y2={y}
                      stroke={isDirect ? '#10b981' : '#0284c7'}
                      strokeWidth={isDirect ? 2 : 1}
                      strokeOpacity={isDirect ? 0.6 : 0.3}
                      strokeDasharray={isDirect ? 'none' : '4 4'}
                    />
                    {/* RSSI Label pill on link */}
                    <rect
                      x={(centerX + x) / 2 - 24}
                      y={(centerY + y) / 2 - 9}
                      width={48}
                      height={18}
                      rx={4}
                      fill="#0f172a"
                      stroke="#1e293b"
                    />
                    <text
                      x={(centerX + x) / 2}
                      y={(centerY + y) / 2 + 3}
                      fill="#94a3b8"
                      fontSize={9}
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {node.rssi} dBm
                    </text>
                  </g>
                );
              })}

              {/* Central Local Node */}
              <g transform={`translate(${centerX}, ${centerY})`} className="cursor-pointer">
                {/* Pulsing beacon glow */}
                <circle r={28} fill="#10b981" fillOpacity={0.15}>
                  <animate attributeName="r" values="24;36;24" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="fillOpacity" values="0.25;0.05;0.25" dur="3s" repeatCount="indefinite" />
                </circle>
                <circle r={18} fill="#065f46" stroke="#10b981" strokeWidth={2.5} />
                <text y={4} fill="#ffffff" fontSize={10} fontWeight="bold" textAnchor="middle">
                  YOU
                </text>
                <text y={32} fill="#34d399" fontSize={10} fontFamily="monospace" textAnchor="middle">
                  {myIdentity.displayName}
                </text>
              </g>

              {/* Remote Mesh Nodes */}
              {nodePositions.map(({ node, x, y }) => {
                const isSelected = selectedNode?.id === node.id;
                return (
                  <g
                    key={`node-${node.id}`}
                    transform={`translate(${x}, ${y})`}
                    onClick={() => setSelectedNode(node)}
                    className="cursor-pointer group"
                  >
                    <circle
                      r={16}
                      fill={isSelected ? '#0284c7' : '#0f172a'}
                      stroke={node.isDirectNeighbor ? '#10b981' : '#38bdf8'}
                      strokeWidth={isSelected ? 3 : 1.5}
                    />
                    <text y={4} fill="#e2e8f0" fontSize={9} fontWeight="600" textAnchor="middle">
                      {node.hopDistance}H
                    </text>
                    <text y={28} fill="#cbd5e1" fontSize={10} fontWeight="500" textAnchor="middle">
                      {node.name.split(' ')[0]}
                    </text>
                    <text y={39} fill="#64748b" fontSize={8} fontFamily="monospace" textAnchor="middle">
                      {node.shortFingerprint}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-3">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> 1-Hop Direct
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span> Multi-Hop Relayed
              </span>
            </div>
            <div>Click any node to inspect RF link telemetry</div>
          </div>
        </div>

        {/* Sidebar: Selected Node Telemetry & Power Settings */}
        <div className="space-y-4">
          {/* Selected Node Inspector */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" /> Node Telemetry Inspector
            </h3>

            {selectedNode ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                  <div className="text-sm font-bold text-slate-100">{selectedNode.name}</div>
                  <div className="text-xs font-mono text-slate-400">{selectedNode.id}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">RF RSSI Signal</div>
                    <div className="font-mono font-bold text-emerald-400 mt-0.5">
                      {selectedNode.rssi} dBm
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Hops from Local</div>
                    <div className="font-mono font-bold text-sky-400 mt-0.5">
                      {selectedNode.hopDistance} {selectedNode.hopDistance === 1 ? '(Direct)' : 'hops'}
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Forwarded Packets</div>
                    <div className="font-mono font-bold text-slate-200 mt-0.5">
                      {selectedNode.forwardedCount} pkts
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Battery Level</div>
                    <div className="font-mono font-bold text-slate-200 mt-0.5 flex items-center gap-1">
                      <Battery className="w-3.5 h-3.5 text-emerald-400" /> {selectedNode.batteryLevel}%
                    </div>
                  </div>
                </div>

                {selectedNode.viaRelayId && (
                  <div className="p-2.5 bg-sky-950/30 border border-sky-900/30 rounded-xl text-xs text-sky-300 flex items-center gap-2">
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    <span>Relayed via intermediate node: {selectedNode.viaRelayId}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                Select a node on the topology map to view real-time link statistics, hop route, and forward counts.
              </div>
            )}
          </div>

          {/* BLE Power & Scan Modes */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Battery className="w-4 h-4 text-emerald-400" /> BLE Mesh Radio Duty Cycle
            </h3>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => onSetPowerMode('performance')}
                className={`py-2 px-1 rounded-lg text-center transition-all ${
                  powerMode === 'performance'
                    ? 'bg-emerald-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div>High Perf</div>
                <div className="text-[9px] opacity-80">100% Scan</div>
              </button>

              <button
                onClick={() => onSetPowerMode('balanced')}
                className={`py-2 px-1 rounded-lg text-center transition-all ${
                  powerMode === 'balanced'
                    ? 'bg-emerald-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div>Balanced</div>
                <div className="text-[9px] opacity-80">Adaptive</div>
              </button>

              <button
                onClick={() => onSetPowerMode('saver')}
                className={`py-2 px-1 rounded-lg text-center transition-all ${
                  powerMode === 'saver'
                    ? 'bg-emerald-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div>Saver</div>
                <div className="text-[9px] opacity-80">Burst Mode</div>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Balanced duty cycle runs 300ms scanning windows with 1200ms sleep, conserving 65% battery while maintaining rapid mesh packet forwarding.
            </p>
          </div>

          {/* Nostr / Internet Fallback Switch */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {transportStatus.nostrFallbackActive ? (
                  <Globe className="w-4 h-4 text-emerald-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-slate-500" />
                )}
                <div>
                  <div className="text-xs font-semibold text-slate-200">Decentralized Internet Fallback</div>
                  <div className="text-[10px] text-slate-400">Nostr Relays (Optional)</div>
                </div>
              </div>

              <input
                type="checkbox"
                checked={transportStatus.nostrFallbackActive}
                onChange={(e) => onToggleNostrFallback(e.target.checked)}
                className="rounded accent-emerald-500 cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              When disabled (default), all communications are strictly offline via local BLE radio. When enabled, packets that cannot find a local BLE route bridge across decentralized Nostr relays.
            </p>
          </div>
        </div>
      </div>

      {/* Courier Drawer Modal / Flyout */}
      {showCourierDrawer && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-6 overflow-y-auto space-y-4 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-slate-100 text-sm">Delay-Tolerant Courier Mailbox</h3>
              </div>
              <button
                onClick={() => setShowCourierDrawer(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              When a recipient is temporarily out of BLE range, nearby courier relay devices carry encrypted packets in their local storage until the recipient node is encountered.
            </p>

            {courierMailbox.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No offline courier mail currently queued. All active recipients are in direct or relayed range.
              </div>
            ) : (
              <div className="space-y-3">
                {courierMailbox.map((mail) => (
                  <div
                    key={mail.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-emerald-400 font-semibold">{mail.id}</span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expires in {Math.round((mail.expiresAt - Date.now()) / (3600 * 1000))}h
                      </span>
                    </div>

                    <div className="text-slate-300">
                      Destination: <span className="font-mono text-slate-400">{mail.targetRecipientId}</span>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      Payload: Opaque encrypted ciphertext envelope ({mail.packet.packetType})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
