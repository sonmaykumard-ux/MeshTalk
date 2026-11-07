/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Flame, ShieldAlert, X, Check } from 'lucide-react';

interface PanicWipeModalProps {
  onConfirmWipe: () => void;
  onClose: () => void;
}

export const PanicWipeModal: React.FC<PanicWipeModalProps> = ({ onConfirmWipe, onClose }) => {
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isWiped, setIsWiped] = useState(false);

  useEffect(() => {
    let interval: any;
    if (holding && holdProgress < 100) {
      interval = setInterval(() => {
        setHoldProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 5;
        });
      }, 100);
    } else if (!holding && holdProgress > 0 && holdProgress < 100) {
      setHoldProgress(0);
    }

    return () => clearInterval(interval);
  }, [holding, holdProgress]);

  useEffect(() => {
    if (holdProgress >= 100 && !isWiped) {
      setIsWiped(true);
      setTimeout(() => {
        onConfirmWipe();
      }, 800);
    }
  }, [holdProgress, isWiped, onConfirmWipe]);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-red-500/40 rounded-2xl max-w-md w-full shadow-2xl shadow-red-950/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Banner */}
        <div className="px-5 py-4 border-b border-red-900/40 bg-red-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-red-200 text-sm tracking-wide">EMERGENCY PANIC WIPE</h3>
              <p className="text-[11px] text-red-400/80">Irreversible Cryptographic Destruction</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description & List of purges */}
        <div className="p-5 space-y-4">
          <div className="p-3 bg-red-950/30 border border-red-900/30 rounded-xl text-xs text-red-300 leading-relaxed flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              This action immediately executes a military-grade zeroization of all local data. There is no recovery or undo.
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs space-y-2 font-mono text-slate-300">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-sans font-semibold">
              The following will be permanently erased:
            </div>
            <ul className="space-y-1.5 text-[11px]">
              <li className="flex items-center gap-2 text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                Local Ed25519 / X25519 identity key seeds
              </li>
              <li className="flex items-center gap-2 text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                All private 1-on-1 and channel message history
              </li>
              <li className="flex items-center gap-2 text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                Cached store-and-forward courier packets
              </li>
              <li className="flex items-center gap-2 text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                Peer trust fingerprints and contacts
              </li>
              <li className="flex items-center gap-2 text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                All media caches, voice notes, and attachments
              </li>
            </ul>
          </div>

          {/* Hold to Confirm Trigger */}
          <div className="space-y-2 pt-2">
            <div className="text-[11px] text-slate-400 text-center">
              Press and hold for 2 seconds to initiate complete wipe:
            </div>

            <button
              onMouseDown={() => setHolding(true)}
              onMouseUp={() => setHolding(false)}
              onMouseLeave={() => setHolding(false)}
              onTouchStart={() => setHolding(true)}
              onTouchEnd={() => setHolding(false)}
              disabled={isWiped}
              className="relative w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white overflow-hidden select-none transition-all duration-150 border border-red-500/50 bg-red-950/60 active:scale-[0.98] shadow-lg shadow-red-950/60"
            >
              {/* Progress bar fill */}
              <div
                className="absolute inset-0 bg-red-600 transition-all duration-75"
                style={{ width: `${holdProgress}%` }}
              />

              <div className="relative z-10 flex items-center justify-center gap-2">
                {isWiped ? (
                  <>
                    <Check className="w-5 h-5 text-white" /> DATA PURGED. RESETTING IDENTITY...
                  </>
                ) : holding ? (
                  <>
                    <Flame className="w-5 h-5 animate-pulse" /> HOLD TO SHRED DATA ({holdProgress}%)
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-5 h-5" /> HOLD TO PANIC WIPE
                  </>
                )}
              </div>
            </button>
          </div>

          <div className="text-center">
            <button
              onClick={onClose}
              disabled={holding || isWiped}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel and Return to Safe Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
