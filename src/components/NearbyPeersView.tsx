/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Radio,
  Bluetooth,
  ShieldCheck,
  ShieldAlert,
  MessageSquare,
  FileUp,
  Battery,
  Plus,
  RefreshCw,
  Ban,
  Check,
  Signal,
} from 'lucide-react';
import { MeshNode } from '../utils/meshProtocol';
import { UserIdentity } from '../utils/crypto';

interface NearbyPeersViewProps {
  myIdentity: UserIdentity;
  nodes: MeshNode[];
  onStartChat: (node: MeshNode) => void;
  onVerifyPeer: (node: MeshNode) => void;
  onToggleBlockPeer: (nodeId: string) => void;
  onRequestBleScan: () => void;
  onAddSimulatedNode: (name: string, hopDistance: number, rssi: number) => void;
}

export const NearbyPeersView: React.FC<NearbyPeersViewProps> = ({
  myIdentity,
  nodes,
  onStartChat,
  onVerifyPeer,
  onToggleBlockPeer,
  onRequestBleScan,
  onAddSimulatedNode,
}) => {
  const [filter, setFilter] = useState<'all' | 'direct' | 'relayed'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeHops, setNewNodeHops] = useState(1);
  const [newNodeRssi, setNewNodeRssi] = useState(-65);

  const filteredNodes = nodes.filter((n) => {
    if (filter === 'direct') return n.isDirectNeighbor;
    if (filter === 'relayed') return !n.isDirectNeighbor;
    return true;
  });

  const handleCreateNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeName.trim()) return;
    onAddSimulatedNode(newNodeName.trim(), newNodeHops, newNodeRssi);
    setNewNodeName('');
    setShowAddModal(false);
  };

  const getSignalStrength = (rssi: number) => {
    if (rssi > -60) return { bars: 4, label: 'Excellent', color: 'text-emerald-400' };
    if (rssi > -75) return { bars: 3, label: 'Good', color: 'text-emerald-400' };
    if (rssi > -85) return { bars: 2, label: 'Moderate', color: 'text-amber-400' };
    return { bars: 1, label: 'Weak', color: 'text-red-400' };
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto">
      {/* Header bar */}
      <div className="p-4 sm:p-6 border-b border-slate-800/80 bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-slate-100 tracking-wide">
              NEARBY MESH PARTICIPANTS
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Automatic BLE radio discovery • Zero pairing • Multi-hop participant routing
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRequestBleScan}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-emerald-950/40"
          >
            <Bluetooth className="w-4 h-4" /> Scan BLE Hardware
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Field Node
          </button>
        </div>
      </div>

      {/* Filter and stats strip */}
      <div className="px-4 sm:px-6 py-3 border-b border-slate-800/60 bg-slate-950/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800 font-medium">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filter === 'all' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Nodes ({nodes.length})
          </button>
          <button
            onClick={() => setFilter('direct')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filter === 'direct' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1-Hop Direct ({nodes.filter((n) => n.isDirectNeighbor).length})
          </button>
          <button
            onClick={() => setFilter('relayed')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filter === 'relayed' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Multi-Hop Relayed ({nodes.filter((n) => !n.isDirectNeighbor).length})
          </button>
        </div>

        <div className="text-slate-400 hidden sm:block text-[11px] font-mono">
          Local: <span className="text-emerald-400 font-bold">{myIdentity.shortFingerprint}</span> ({myIdentity.displayName})
        </div>
      </div>

      {/* Nodes list */}
      <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredNodes.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 text-xs">
            No devices found matching current filter. Click "Scan BLE Hardware" or "Add Field Node".
          </div>
        ) : (
          filteredNodes.map((node) => {
            const sig = getSignalStrength(node.rssi);
            return (
              <div
                key={node.id}
                className={`bg-slate-900/60 border rounded-2xl p-4 transition-all hover:border-slate-700/80 shadow-sm flex flex-col justify-between gap-4 ${
                  node.isBlocked
                    ? 'border-red-900/40 opacity-60'
                    : node.isDirectNeighbor
                    ? 'border-slate-800'
                    : 'border-slate-800/80 bg-slate-900/40'
                }`}
              >
                {/* Node Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 text-sm">
                      {node.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-100 text-sm">{node.name}</span>
                        {node.isVerified && (
                          <span
                            title="Cryptographically Verified"
                            className="text-emerald-400 flex items-center gap-0.5 text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20"
                          >
                            <ShieldCheck className="w-3 h-3" /> Verified
                          </span>
                        )}
                        {node.isBlocked && (
                          <span className="text-red-400 flex items-center gap-0.5 text-[10px] bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                            Blocked
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 font-mono">
                        <span className="text-emerald-400">{node.shortFingerprint}</span>
                        <span>•</span>
                        <span>{node.id.slice(0, 14)}...</span>
                      </div>
                    </div>
                  </div>

                  {/* Signal indicator */}
                  <div className="text-right flex flex-col items-end">
                    <div className="flex items-center gap-1">
                      <Signal className={`w-3.5 h-3.5 ${sig.color}`} />
                      <span className={`text-xs font-mono font-bold ${sig.color}`}>{node.rssi} dBm</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{sig.label}</span>
                  </div>
                </div>

                {/* Node Metadata Badges */}
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span
                    className={`px-2 py-0.5 rounded-md font-mono ${
                      node.isDirectNeighbor
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                    }`}
                  >
                    {node.isDirectNeighbor ? 'Direct (1-Hop)' : `Relayed (${node.hopDistance} Hops)`}
                  </span>

                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded-md flex items-center gap-1 font-mono">
                    <Battery className="w-3 h-3 text-emerald-400" />
                    {node.batteryLevel}%
                  </span>

                  <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded-md font-mono">
                    Forwarded: {node.forwardedCount} pkts
                  </span>

                  {node.isCourierEligible && (
                    <span className="px-2 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 rounded-md font-mono">
                      DTN Courier
                    </span>
                  )}
                </div>

                {/* Actions row */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => onStartChat(node)}
                    disabled={node.isBlocked}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Start Private E2EE
                  </button>

                  <button
                    onClick={() => onVerifyPeer(node)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
                    title="Verify Cryptographic Fingerprint"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </button>

                  <button
                    onClick={() => onToggleBlockPeer(node.id)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 rounded-xl transition-colors"
                    title={node.isBlocked ? 'Unblock Sender' : 'Block Sender'}
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Field Node Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 mb-1">Add Simulated Field Node</h3>
            <p className="text-xs text-slate-400 mb-4">
              Spawn a virtual mobile mesh relay or remote outpost for multi-hop verification.
            </p>

            <form onSubmit={handleCreateNode} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 mb-1 block">Node / Station Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Echo-Repeater [Ridge]"
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 mb-1 block">Hop Distance</label>
                <select
                  value={newNodeHops}
                  onChange={(e) => setNewNodeHops(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value={1}>1-Hop (Direct BLE Range)</option>
                  <option value={2}>2-Hops (Relayed via intermediate)</option>
                  <option value={3}>3-Hops (Remote mesh participant)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 mb-1 block">Simulated Signal (RSSI)</label>
                <input
                  type="range"
                  min={-95}
                  max={-45}
                  value={newNodeRssi}
                  onChange={(e) => setNewNodeRssi(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="text-[11px] font-mono text-emerald-400 text-right">{newNodeRssi} dBm</div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                >
                  Spawn Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
