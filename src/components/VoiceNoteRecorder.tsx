/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Trash2, Send, Play, Pause, Volume2 } from 'lucide-react';
import { VoiceNotePayload } from '../utils/meshProtocol';
import { generateRandomHex } from '../utils/crypto';

interface VoiceNoteRecorderProps {
  onSendVoiceNote: (payload: VoiceNotePayload) => void;
  onCancel: () => void;
}

export const VoiceNoteRecorder: React.FC<VoiceNoteRecorderProps> = ({ onSendVoiceNote, onCancel }) => {
  const [isRecording, setIsRecording] = useState(true);
  const [durationSec, setDurationSec] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string>('');
  const [waveform, setWaveform] = useState<number[]>([12, 24, 38, 55, 70, 85, 60, 45, 30, 65, 80, 50, 20]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let timer: any;
    if (isRecording) {
      timer = setInterval(() => {
        setDurationSec((prev) => {
          if (prev >= 60) {
            // Auto cap voice note to 60s for BLE bandwidth conservation
            stopRecording();
            return 60;
          }
          return prev + 1;
        });

        // Jitter waveform bars
        setWaveform((prev) =>
          prev.map(() => Math.floor(Math.random() * 70) + 15)
        );
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    // Attempt real browser MediaRecorder
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          audioChunksRef.current = [];

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunksRef.current.push(e.data);
          };

          recorder.onstop = async () => {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);

            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              const b64 = reader.result as string;
              setAudioBase64(b64);
            };

            // Stop audio tracks
            stream.getTracks().forEach((track) => track.stop());
          };

          recorder.start();
        })
        .catch((err) => {
          console.warn('Microphone permission not granted or unavailable, generating fallback audio payload', err);
          // If denied, we still allow simulated recording
          setAudioBase64('data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////');
        });
    }

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const stopRecording = () => {
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleTogglePlay = () => {
    if (!audioElementRef.current && audioUrl) {
      audioElementRef.current = new Audio(audioUrl);
      audioElementRef.current.playbackRate = playbackSpeed;
      audioElementRef.current.onended = () => setIsPlaying(false);
    }
    if (audioElementRef.current) {
      if (isPlaying) {
        audioElementRef.current.pause();
        setIsPlaying(false);
      } else {
        audioElementRef.current.playbackRate = playbackSpeed;
        audioElementRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const cycleSpeed = () => {
    const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(nextSpeed);
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = nextSpeed;
    }
  };

  const handleSend = () => {
    const payload: VoiceNotePayload = {
      voiceId: `voice_${generateRandomHex(8)}`,
      durationMs: durationSec * 1000 || 2500,
      audioBlobBase64: audioBase64 || 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////',
      waveform: waveform.slice(0, 20),
      compressed: true,
    };
    onSendVoiceNote(payload);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-3 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="flex items-center justify-between gap-3">
        {/* State icon & Time */}
        <div className="flex items-center gap-2.5">
          {isRecording ? (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
              <span className="font-mono text-xs font-semibold text-red-400">REC {formatTime(durationSec)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span className="font-mono text-xs text-slate-300">{formatTime(durationSec || 2)}</span>
            </div>
          )}
        </div>

        {/* Dynamic Waveform */}
        <div className="flex-1 flex items-center justify-center gap-0.5 h-7 px-2">
          {waveform.map((val, idx) => (
            <div
              key={idx}
              className={`w-1 rounded-full transition-all duration-150 ${
                isRecording ? 'bg-emerald-400/80' : 'bg-slate-600'
              }`}
              style={{ height: `${Math.max(4, Math.min(26, (val / 100) * 26))}px` }}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          {isRecording ? (
            <button
              onClick={stopRecording}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-red-400 transition-colors"
              title="Stop Recording"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <>
              <button
                onClick={handleTogglePlay}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                title={isPlaying ? 'Pause' : 'Play preview'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={cycleSpeed}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 font-bold"
                title="Playback speed"
              >
                {playbackSpeed}x
              </button>
            </>
          )}

          <button
            onClick={onCancel}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
            title="Discard Voice Note"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleSend}
            disabled={isRecording}
            className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors flex items-center justify-center shadow-lg shadow-emerald-950/40"
            title="Send Voice Note over Mesh"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
