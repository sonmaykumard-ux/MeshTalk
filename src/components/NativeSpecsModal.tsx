/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FileCode, Copy, Check, Smartphone, Apple, Terminal, Download, ShieldCheck } from 'lucide-react';
import { NATIVE_CODE_SPECIFICATIONS, NativeCodeFile } from '../data/nativeCodeTemplates';

export const NativeSpecsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  const currentFile = NATIVE_CODE_SPECIFICATIONS[selectedIdx];

  const handleCopy = () => {
    navigator.clipboard?.writeText(currentFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentFile.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                NATIVE MOBILE BLUEPRINTS & WIRE PROTOCOL
              </h2>
              <p className="text-xs text-slate-400">
                Production-grade Android (Kotlin), iOS (Swift), and Protobuf implementations
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Strip */}
        <div className="px-6 py-2.5 bg-slate-950 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {NATIVE_CODE_SPECIFICATIONS.map((spec, i) => (
              <button
                key={spec.fileName}
                onClick={() => setSelectedIdx(i)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-all ${
                  selectedIdx === i
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {spec.platform.includes('Android') && <Smartphone className="w-3.5 h-3.5" />}
                {spec.platform.includes('iOS') && <Apple className="w-3.5 h-3.5" />}
                {spec.platform.includes('Protobuf') && <Terminal className="w-3.5 h-3.5" />}
                <span>{spec.fileName}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Source'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div className="px-6 py-2 bg-slate-900/60 border-b border-slate-800 text-xs text-slate-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{currentFile.description}</span>
        </div>

        {/* Code Content View */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-950 font-mono text-xs text-emerald-300 leading-relaxed selection:bg-emerald-900 selection:text-white">
          <pre className="whitespace-pre">{currentFile.code}</pre>
        </div>
      </div>
    </div>
  );
};
