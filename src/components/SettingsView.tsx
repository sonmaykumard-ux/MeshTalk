/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Shield,
  Key,
  Flame,
  Globe,
  Clock,
  EyeOff,
  Copy,
  Check,
  Download,
  Upload,
  RefreshCw,
  QrCode,
  Radio,
} from 'lucide-react';
import { UserIdentity } from '../utils/crypto';
import { TransportStatus } from '../utils/meshTransports';

interface SettingsViewProps {
  myIdentity: UserIdentity;
  transportStatus: TransportStatus;
  ephemeralTimer: number; // 0 = off, else seconds
  onUpdateIdentity: (newName: string) => void;
  onSetEphemeralTimer: (seconds: number) => void;
  onToggleNostrFallback: (enabled: boolean) => void;
  onOpenIdentityQr: () => void;
  onOpenPanicWipe: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  myIdentity,
  transportStatus,
  ephemeralTimer,
  onUpdateIdentity,
  onSetEphemeralTimer,
  onToggleNostrFallback,
  onOpenIdentityQr,
  onOpenPanicWipe,
}) => {
  const [displayName, setDisplayName] = useState(myIdentity.displayName);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSeed, setCopiedSeed] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName.trim()) {
      onUpdateIdentity(displayName.trim());
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard?.writeText(myIdentity.id);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopySeed = () => {
    navigator.clipboard?.writeText(myIdentity.privateKeySeed);
    setCopiedSeed(true);
    setTimeout(() => setCopiedSeed(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-3xl w-full mx-auto space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            IDENTITY, PRIVACY & NETWORK SETTINGS
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Decentralized self-sovereign cryptographic control • Zero accounts or passwords
          </p>
        </div>

        {/* Profile Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-400" /> Cryptographic Identity Profile
          </h3>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="text-xs text-slate-300 mb-1 block">Local Display Nickname</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-sans"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  {savedSuccess ? <Check className="w-3.5 h-3.5" /> : null}
                  <span>{savedSuccess ? 'Saved' : 'Update Nickname'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">
                  Short Public Fingerprint
                </div>
                <div className="font-mono text-base font-bold text-emerald-400">
                  {myIdentity.shortFingerprint}
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Identity QR Code</div>
                  <div className="text-xs text-slate-300">Out-of-band verification</div>
                </div>
                <button
                  type="button"
                  onClick={onOpenIdentityQr}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Show QR</span>
                </button>
              </div>
            </div>

            {/* Keys backup row */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-200">Private Identity Seed</div>
                  <div className="text-[10px] text-slate-400">
                    Stored exclusively on this device. Never transmitted over RF or internet.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopySeed}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors"
                >
                  {copiedSeed ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSeed ? 'Copied' : 'Backup Seed'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Privacy & Ephemeral Expiry */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" /> Ephemeral Message Auto-Destruction
          </h3>

          <p className="text-xs text-slate-400 leading-relaxed">
            Automatically purge private conversation messages from local storage after expiration.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { label: 'Off', sec: 0 },
              { label: '30 Seconds', sec: 30 },
              { label: '5 Minutes', sec: 300 },
              { label: '1 Hour', sec: 3600 },
              { label: '24 Hours', sec: 86400 },
            ].map((opt) => (
              <button
                key={opt.sec}
                onClick={() => onSetEphemeralTimer(opt.sec)}
                className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                  ephemeralTimer === opt.sec
                    ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Network & Transports */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" /> Hybrid Transport Priority
          </h3>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs space-y-2">
            <div className="font-semibold text-slate-200 text-xs">Routing Priority Hierarchy:</div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400 font-mono">
              <li>Direct Bluetooth Low Energy link (0 hops)</li>
              <li>Multi-hop BLE mesh relay (1 to 7 hops)</li>
              <li>Delay-Tolerant Store-and-Forward courier node</li>
              <li>Decentralized Nostr Internet relay fallback (if enabled)</li>
            </ol>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
            <div>
              <div className="text-xs font-semibold text-slate-200">Decentralized Nostr Relays</div>
              <div className="text-[10px] text-slate-400">
                Bridge out-of-range packets over public Nostr relays without central accounts.
              </div>
            </div>

            <input
              type="checkbox"
              checked={transportStatus.nostrFallbackActive}
              onChange={(e) => onToggleNostrFallback(e.target.checked)}
              className="accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Emergency Panic Wipe Danger Zone */}
        <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-red-400">
            <Flame className="w-5 h-5" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Zeroize All Cryptographic Data</h3>
          </div>

          <p className="text-xs text-red-300/80 leading-relaxed">
            In an emergency or compromise scenario, immediately purge your private identity keys, message records, courier caches, and reset application state.
          </p>

          <button
            onClick={onOpenPanicWipe}
            className="py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-red-950/50 flex items-center gap-2"
          >
            <Flame className="w-4 h-4" /> Open Panic Wipe Safeguard
          </button>
        </div>
      </div>
    </div>
  );
};
