/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Radio,
  Flame,
  AlertOctagon,
  FileCode,
  Battery,
  Shield,
  Edit2,
  Check,
  Zap,
} from 'lucide-react';
import { UserIdentity } from '../utils/crypto';
import { BatteryPowerMode } from '../utils/meshProtocol';
import { TransportStatus } from '../utils/meshTransports';

interface HeaderBarProps {
  myIdentity: UserIdentity;
  powerMode: BatteryPowerMode;
  peerCount: number;
  transportStatus: TransportStatus;
  onUpdateNickname: (newName: string) => void;
  onOpenSos: () => void;
  onOpenPanicWipe: () => void;
  onOpenNativeSpecs: () => void;
  onCyclePowerMode: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  myIdentity,
  powerMode,
  peerCount,
  transportStatus,
  onUpdateNickname,
  onOpenSos,
  onOpenPanicWipe,
  onOpenNativeSpecs,
  onCyclePowerMode,
}) => {
  const [editingNick, setEditingNick] = useState(false);
  const [tempNick, setTempNick] = useState(myIdentity.displayName);

  const handleSaveNick = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempNick.trim()) {
      onUpdateNickname(tempNick.trim());
      setEditingNick(false);
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 z-30">
      {/* Brand & Radio Status */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center">
          <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-ping"></span>
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900"></span>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-sm sm:text-base tracking-wider text-slate-100 flex items-center gap-1.5 font-mono">
              MESHTALK
            </h1>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              BLE-MESH
            </span>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
            <span className="text-emerald-400 font-semibold">{peerCount} Peers Linked</span>
            <span>•</span>
            <span className="hidden sm:inline">Zero Internet</span>
          </div>
        </div>
      </div>

      {/* User Nickname & Fingerprint center pill */}
      <div className="hidden md:flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
        {editingNick ? (
          <form onSubmit={handleSaveNick} className="flex items-center gap-1.5">
            <input
              type="text"
              value={tempNick}
              onChange={(e) => setTempNick(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              autoFocus
            />
            <button type="submit" className="text-emerald-400 p-1 hover:text-emerald-300">
              <Check className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <div
            onClick={() => setEditingNick(true)}
            className="flex items-center gap-2 cursor-pointer group"
            title="Click to change local display name"
          >
            <span className="text-xs font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors">
              {myIdentity.displayName}
            </span>
            <Edit2 className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              {myIdentity.shortFingerprint}
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {/* Power Mode button */}
        <button
          onClick={onCyclePowerMode}
          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
          title={`Cycle BLE Power Mode (Current: ${powerMode})`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden lg:inline capitalize">{powerMode}</span>
        </button>

        {/* Native Code Specs */}
        <button
          onClick={onOpenNativeSpecs}
          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
          title="Inspect Native Android / iOS BLE Source Code"
        >
          <FileCode className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Native Specs</span>
        </button>

        {/* Emergency SOS Quick Trigger */}
        <button
          onClick={onOpenSos}
          className="px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-red-950/40"
          title="Emergency Distress SOS Beacon"
        >
          <AlertOctagon className="w-3.5 h-3.5 text-red-400 animate-pulse" />
          <span>SOS</span>
        </button>

        {/* Panic Wipe Trigger */}
        <button
          onClick={onOpenPanicWipe}
          className="p-1.5 sm:px-2.5 sm:py-1.5 bg-red-950/40 hover:bg-red-950/80 text-red-400 border border-red-900/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          title="Panic Wipe (Purge All Cryptographic Keys and Message History)"
        >
          <Flame className="w-4 h-4 text-red-400" />
          <span className="hidden lg:inline">Panic Wipe</span>
        </button>
      </div>
    </header>
  );
};
