/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldCheck, X, Copy, Check, QrCode, Key, Lock } from 'lucide-react';
import { generateSimpleQrSvg } from '../utils/qrCode';
import { UserIdentity } from '../utils/crypto';
import { MeshNode } from '../utils/meshProtocol';

interface IdentityVerifyModalProps {
  myIdentity: UserIdentity;
  targetPeer?: MeshNode | null;
  onVerifyPeer: (nodeId: string) => void;
  onClose: () => void;
}

export const IdentityVerifyModal: React.FC<IdentityVerifyModalProps> = ({
  myIdentity,
  targetPeer,
  onVerifyPeer,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'my_id' | 'peer_verify'>(targetPeer ? 'peer_verify' : 'my_id');
  const [inputFingerprint, setInputFingerprint] = useState('');
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  const qrData = `meshtalk:${myIdentity.id}:${myIdentity.shortFingerprint}:${myIdentity.displayName}`;
  const qrSvgString = generateSimpleQrSvg(qrData, 190);

  const handleCopyId = () => {
    navigator.clipboard?.writeText(myIdentity.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmVerify = () => {
    if (targetPeer) {
      onVerifyPeer(targetPeer.id);
      setVerifiedSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">Cryptographic Identity & Trust</h3>
              <p className="text-xs text-slate-400">X25519 & Ed25519 Peer Verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 p-1 bg-slate-950/80 mx-5 mt-4 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setTab('my_id')}
            className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'my_id'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            My Identity QR
          </button>
          <button
            onClick={() => setTab('peer_verify')}
            className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'peer_verify'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Verify Peer
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {tab === 'my_id' ? (
            <div className="flex flex-col items-center text-center">
              {/* QR Code Container */}
              <div
                className="p-3 bg-slate-950 rounded-xl border border-slate-800 shadow-inner mb-4"
                dangerouslySetInnerHTML={{ __html: qrSvgString }}
              />

              <div className="w-full space-y-3">
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-left">
                  <div className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Key className="w-3 h-3" /> Short Fingerprint
                  </div>
                  <div className="font-mono text-base font-bold text-slate-100 tracking-wider">
                    {myIdentity.shortFingerprint}
                  </div>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-left flex items-center justify-between gap-2">
                  <div className="overflow-hidden">
                    <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-0.5">
                      Public Node Key
                    </div>
                    <div className="font-mono text-xs text-slate-300 truncate">
                      {myIdentity.id}
                    </div>
                  </div>
                  <button
                    onClick={handleCopyId}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors shrink-0"
                    title="Copy full public key"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
                Scan or compare this fingerprint in person to ensure your communication channel is completely immune to intermediate man-in-the-middle relays.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {targetPeer ? (
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-100">{targetPeer.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{targetPeer.id}</div>
                    </div>
                    {targetPeer.isVerified ? (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Verified
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[10px] font-medium">
                        Unverified
                      </span>
                    )}
                  </div>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-[11px] text-slate-400 mb-1">Expected Fingerprint:</div>
                    <div className="font-mono text-sm font-bold text-emerald-400 tracking-wider">
                      {targetPeer.shortFingerprint}
                    </div>
                  </div>

                  <button
                    onClick={handleConfirmVerify}
                    disabled={targetPeer.isVerified || verifiedSuccess}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
                  >
                    {verifiedSuccess ? (
                      <>
                        <Check className="w-4 h-4" /> Fingerprint Confirmed & Marked Verified!
                      </>
                    ) : targetPeer.isVerified ? (
                      'Identity Already Verified'
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" /> Confirm Fingerprint Match
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Lock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">
                    Select a peer from the Nearby or Chats list to verify their cryptographic key fingerprint.
                  </p>
                </div>
              )}

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300">Why verify fingerprints?</div>
                <div>
                  Even without a certificate authority, verifying fingerprints directly guarantees that only the recipient with the corresponding private key can decrypt your end-to-end messages.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
