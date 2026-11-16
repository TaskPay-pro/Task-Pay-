import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  Image as ImageIcon,
  Mic,
  Send,
  Square,
} from 'lucide-react';
import { useI18n } from '../../data/i18n';
import type { ChatMessage } from '../../types/taskpay';

interface SupportChatViewProps {
  roomUid: string;
  senderRole: 'user' | 'admin';
  messages: ChatMessage[];
  title: string;
  subtitle?: string;
  onSend: (
    roomUid: string,
    senderRole: 'user' | 'admin',
    kind: 'text' | 'image' | 'voice',
    text?: string,
    mediaDataUrl?: string,
    durationSec?: number
  ) => Promise<unknown>;
  onMarkRead: (roomUid: string, readerRole: 'user' | 'admin') => Promise<void>;
  onRequireAuth?: () => void;
  isSignedIn: boolean;
}

function TickBadge({ tick }: { tick: 1 | 2 | 3 }) {
  if (tick === 1) {
    return <Check className="h-3.5 w-3.5 text-[#8fa698]" aria-label="Sent (single grey)" />;
  }
  if (tick === 2) {
    return <CheckCheck className="h-3.5 w-3.5 text-[#9cb3a5]" aria-label="Delivered (double grey)" />;
  }
  return <CheckCheck className="h-3.5 w-3.5 text-[#00FF66]" aria-label="Read (neon green double)" />;
}

export const SupportChatView: React.FC<SupportChatViewProps> = ({
  roomUid,
  senderRole,
  messages,
  title,
  subtitle,
  onSend,
  onMarkRead,
  onRequireAuth,
  isSignedIn,
}) => {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isSignedIn && roomUid) {
      onMarkRead(roomUid, senderRole);
    }
  }, [isSignedIn, roomUid, senderRole, messages.length, onMarkRead]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignedIn) {
      onRequireAuth?.();
      return;
    }
    const clean = text.trim();
    if (!clean) return;
    setBusy(true);
    setError(null);
    try {
      await onSend(roomUid, senderRole, 'text', clean);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isSignedIn) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setBusy(true);
      try {
        await onSend(roomUid, senderRole, 'image', file.name, dataUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Image upload failed.');
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    if (!isSignedIn) {
      onRequireAuth?.();
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : '';
          if (dataUrl) {
            await onSend(roomUid, senderRole, 'voice', 'Voice note', dataUrl, recordSec || 1);
          }
        };
        reader.readAsDataURL(blob);
      };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecordSec(0);
      timerRef.current = setInterval(() => setRecordSec((s) => s + 1), 1000);
    } catch {
      setError('Microphone permission unavailable. Enable mic access for voice notes.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    recorderRef.current?.stop();
  };

  return (
    <section className="vip-card-3d flex flex-col h-[530px] overflow-hidden animate-view-enter">
      <div className="border-b border-[#00FF66]/15 px-4 py-3.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-base font-extrabold text-white truncate">{title}</h1>
          {subtitle && <p className="text-[11px] text-[#9cb3a5] truncate">{subtitle}</p>}
        </div>
        <span className="shrink-0 text-[10px] font-mono text-[#9cb3a5]">
          ✓ · ✓✓ · <span className="text-[#00FF66]">✓✓</span>
        </span>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto mobile-scroll p-3.5 space-y-2.5 bg-[#050505]/80">
        {!isSignedIn ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <p className="text-xs text-[#9cb3a5]">Sign in to chat with TaskPay VIP Support.</p>
            {onRequireAuth && (
              <button
                type="button"
                onClick={onRequireAuth}
                className="mt-4 min-h-[44px] rounded-xl vip-btn-neon px-5 py-2 text-xs font-extrabold cursor-pointer"
              >
                {t('login')}
              </button>
            )}
          </div>
        ) : messages.length === 0 ? (
          <p className="py-12 text-center text-xs text-[#9cb3a5]">{t('noRecords')}</p>
        ) : (
          messages.map((msg) => {
            const mine = msg.senderRole === senderRole;
            return (
              <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs ${
                    mine
                      ? 'bg-[#00FF66]/15 border border-[#00FF66]/45 text-white'
                      : 'bg-[#101512] border border-white/10 text-white'
                  }`}
                >
                  <div className="text-[10px] font-bold text-[#00FF66] mb-1">
                    {msg.senderName}
                  </div>

                  {msg.kind === 'image' && msg.mediaDataUrl && (
                    <img
                      src={msg.mediaDataUrl}
                      alt={msg.text || 'Attachment'}
                      className="mb-2 max-h-48 rounded-xl object-cover border border-[#00FF66]/20"
                    />
                  )}

                  {msg.kind === 'voice' && msg.mediaDataUrl && (
                    <div className="mb-1">
                      <audio controls src={msg.mediaDataUrl} className="h-9 max-w-[210px]" />
                    </div>
                  )}

                  {msg.text && <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>}

                  <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#9cb3a5] tabular">
                    <span>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {mine && <TickBadge tick={msg.tickState} />}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="border-t border-[#FFB800]/30 bg-[#FFB800]/10 px-3.5 py-2 text-[11px] font-semibold text-[#FFB800]">
          {error}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={handleSendText}
        className="border-t border-[#00FF66]/15 bg-[#0b0e0c] p-2.5 flex items-center gap-1.5"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleImagePick}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label={t('attachImage')}
          className="flex min-h-[42px] min-w-[42px] shrink-0 items-center justify-center rounded-xl vip-btn-surface text-[#00FF66] cursor-pointer"
        >
          <ImageIcon className="h-4 w-4" aria-hidden="true" />
        </button>

        {recording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="flex min-h-[42px] shrink-0 items-center gap-1 rounded-xl border border-[#FFB800]/60 bg-[#FFB800]/15 px-2.5 text-xs font-bold text-[#FFB800] cursor-pointer"
          >
            <Square className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="tabular">{recordSec}s</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            aria-label={t('recordVoice')}
            className="flex min-h-[42px] min-w-[42px] shrink-0 items-center justify-center rounded-xl vip-btn-surface text-[#00FF66] cursor-pointer"
          >
            <Mic className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('typeMessage')}
          className="h-[42px] min-w-0 flex-1 rounded-xl border border-[#00FF66]/20 bg-[#050505] px-3 text-xs text-white placeholder:text-[#9cb3a5]/60 focus:border-[#00FF66] focus:outline-none"
        />

        <button
          type="submit"
          disabled={busy}
          aria-label={t('send')}
          className="flex min-h-[42px] min-w-[42px] shrink-0 items-center justify-center rounded-xl vip-btn-neon px-3.5 cursor-pointer"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </section>
  );
};
