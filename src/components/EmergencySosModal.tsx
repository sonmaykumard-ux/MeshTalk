/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AlertOctagon, Radio, MapPin, Send, X, ShieldAlert, HeartPulse, Zap } from 'lucide-react';
import { EmergencyPayload } from '../utils/meshProtocol';

interface EmergencySosModalProps {
  onBroadcastSos: (payload: EmergencyPayload) => void;
  onClose: () => void;
}

export const EmergencySosModal: React.FC<EmergencySosModalProps> = ({ onBroadcastSos, onClose }) => {
  const [distressLevel, setDistressLevel] = useState<EmergencyPayload['distressLevel']>('CRITICAL_SOS');
  const [message, setMessage] = useState('');
  const [includeLocation, setIncludeLocation] = useState(true);
  const [locationText, setLocationText] = useState('Approx. Grid Sector 4 (Hillside Trail)');
  const [isSent, setIsSent] = useState(false);

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: EmergencyPayload = {
      distressLevel,
      message: message.trim() || 'URGENT: Emergency beacon broadcasted via offline mesh.',
      coarseLocation: includeLocation
        ? {
            latApprox: 37.7749,
            lngApprox: -122.4194,
            description: locationText,
          }
        : undefined,
      urgencyTimestamp: Date.now(),
    };

    onBroadcastSos(payload);
    setIsSent(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-lg w-full shadow-2xl shadow-amber-950/40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-amber-900/40 bg-amber-950/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <AlertOctagon className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-amber-200 text-sm tracking-wide">EMERGENCY DISTRESS BEACON</h3>
              <p className="text-[11px] text-amber-400/80">High-Priority Multi-Hop Offline Broadcast</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleBroadcast} className="p-5 space-y-4">
          {/* Level Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-2 block">
              Distress Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDistressLevel('CRITICAL_SOS')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  distressLevel === 'CRITICAL_SOS'
                    ? 'bg-red-950/40 border-red-500 text-red-200 ring-1 ring-red-500/40'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold">Critical SOS</div>
                  <div className="text-[10px] text-slate-400">Immediate threat to life or safety</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDistressLevel('MEDICAL')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  distressLevel === 'MEDICAL'
                    ? 'bg-amber-950/40 border-amber-500 text-amber-200 ring-1 ring-amber-500/40'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <HeartPulse className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold">Medical Need</div>
                  <div className="text-[10px] text-slate-400">Injury, supplies, first-aid required</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDistressLevel('HAZARD_ALERT')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  distressLevel === 'HAZARD_ALERT'
                    ? 'bg-amber-950/40 border-amber-500 text-amber-200 ring-1 ring-amber-500/40'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Radio className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold">Hazard Alert</div>
                  <div className="text-[10px] text-slate-400">Flood, fire, road block, collapse</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDistressLevel('RESOURCE_NEED')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  distressLevel === 'RESOURCE_NEED'
                    ? 'bg-amber-950/40 border-amber-500 text-amber-200 ring-1 ring-amber-500/40'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold">Resource Need</div>
                  <div className="text-[10px] text-slate-400">Water, power, shelter assistance</div>
                </div>
              </button>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
              Distress Message & Situation Details
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe situation: 2 persons trapped near river crossing, minor injury, need extraction..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 resize-none font-sans"
            />
          </div>

          {/* Location toggle */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                Broadcast Coarse Location
              </label>
              <input
                type="checkbox"
                checked={includeLocation}
                onChange={(e) => setIncludeLocation(e.target.checked)}
                className="rounded accent-amber-500 cursor-pointer"
              />
            </div>
            {includeLocation && (
              <input
                type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Landmark or coordinates description"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
              />
            )}
          </div>

          <div className="text-[11px] text-slate-400 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
            <strong>Priority Protocol:</strong> Emergency packets override battery conservation limits and are relayed with maximum TTL across all active nodes and stored in courier mailboxes.
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSent}
              className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-950/50"
            >
              {isSent ? (
                <>BEACON BROADCASTED</>
              ) : (
                <>
                  <Send className="w-4 h-4" /> BROADCAST DISTRESS SOS
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
