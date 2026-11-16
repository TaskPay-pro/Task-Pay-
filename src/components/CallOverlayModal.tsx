import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react';
import { useI18n } from '../data/i18n';
import { TASKPAY_LOGO_SRC, type ActiveCallSession, type WebRTCSignalMessage } from '../types/taskpay';
import { ringtonePlayer } from '../utils/ringtone';

interface CallOverlayModalProps {
  call: ActiveCallSession | null;
  role: 'user' | 'admin';
  latestSignal: WebRTCSignalMessage | null;
  onSendSignal: (signal: WebRTCSignalMessage) => void;
  onAccept: (callId: string) => void;
  onEnd: (callId: string) => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export const CallOverlayModal: React.FC<CallOverlayModalProps> = ({
  call,
  role,
  latestSignal,
  onSendSignal,
  onAccept,
  onEnd,
}) => {
  const { t } = useI18n();
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const offerSentRef = useRef<string | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  // Ringing sound alert while call is ringing
  useEffect(() => {
    if (call && call.status === 'ringing') {
      ringtonePlayer.start();
    } else {
      ringtonePlayer.stop();
    }
    return () => ringtonePlayer.stop();
  }, [call?.id, call?.status]);

  // Call duration timer
  useEffect(() => {
    if (!call || call.status !== 'accepted') {
      setSeconds(0);
      return;
    }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [call?.id, call?.status]);

  const cleanupRtc = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((tr) => tr.stop());
      localStreamRef.current = null;
    }
    offerSentRef.current = null;
    pendingIceRef.current = [];
    setRemoteHasVideo(false);
    setMediaNotice(null);
  };

  // Initialize WebRTC when call is accepted
  useEffect(() => {
    if (!call || call.status !== 'accepted') {
      cleanupRtc();
      return;
    }

    let cancelled = false;

    const setupPeer = async () => {
      try {
        const pc = new RTCPeerConnection(RTC_CONFIG);
        pcRef.current = pc;

        pc.onicecandidate = (ev) => {
          if (ev.candidate) {
            onSendSignal({
              type: 'webrtc:ice',
              callId: call.id,
              targetUid: call.targetUid,
              fromRole: role,
              candidate: ev.candidate.toJSON(),
            });
          }
        };

        pc.ontrack = (ev) => {
          const [stream] = ev.streams;
          if (!stream) return;
          if (stream.getVideoTracks().length > 0) {
            setRemoteHasVideo(true);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
            }
          }
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = stream;
          }
        };

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: call.callType === 'video',
          });
          if (cancelled) {
            stream.getTracks().forEach((tr) => tr.stop());
            return;
          }
          localStreamRef.current = stream;
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
          if (localVideoRef.current && call.callType === 'video') {
            localVideoRef.current.srcObject = stream;
          }
        } catch {
          setMediaNotice('Mic/Camera permission unavailable. Audio/Video standby active.');
        }

        // Admin initiates SDP offer once call is accepted
        if (role === 'admin' && offerSentRef.current !== call.id) {
          offerSentRef.current = call.id;
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: call.callType === 'video',
          });
          await pc.setLocalDescription(offer);
          onSendSignal({
            type: 'webrtc:offer',
            callId: call.id,
            targetUid: call.targetUid,
            fromRole: 'admin',
            sdp: offer,
          });
        }
      } catch {
        setMediaNotice('WebRTC connection standby.');
      }
    };

    setupPeer();

    return () => {
      cancelled = true;
      cleanupRtc();
    };
  }, [call?.id, call?.status, call?.callType, call?.targetUid, role, onSendSignal]);

  // Handle incoming WebRTC signaling
  useEffect(() => {
    if (!latestSignal || !call || latestSignal.callId !== call.id) return;
    if (latestSignal.fromRole === role) return;
    const pc = pcRef.current;
    if (!pc) return;

    const handleSignal = async () => {
      try {
        if (latestSignal.type === 'webrtc:offer' && latestSignal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(latestSignal.sdp));
          for (const c of pendingIceRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          }
          pendingIceRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          onSendSignal({
            type: 'webrtc:answer',
            callId: call.id,
            targetUid: call.targetUid,
            fromRole: role,
            sdp: answer,
          });
        } else if (latestSignal.type === 'webrtc:answer' && latestSignal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(latestSignal.sdp));
          for (const c of pendingIceRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          }
          pendingIceRef.current = [];
        } else if (latestSignal.type === 'webrtc:ice' && latestSignal.candidate) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(latestSignal.candidate));
          } else {
            pendingIceRef.current.push(latestSignal.candidate);
          }
        }
      } catch {
        // Ignore transient WebRTC negotiation error
      }
    };

    handleSignal();
  }, [latestSignal, call, role, onSendSignal]);

  if (!call || call.status === 'ended') return null;

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((tr) => {
      tr.enabled = !next;
    });
  };

  const toggleCamera = () => {
    const next = !camOff;
    setCamOff(next);
    localStreamRef.current?.getVideoTracks().forEach((tr) => {
      tr.enabled = !next;
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="VIP Support Call"
      className="absolute inset-0 z-50 flex flex-col justify-between bg-[#050505] p-5 text-white animate-view-enter"
    >
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Top Call Status */}
      <div className="pt-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#00FF66]/40 bg-[#00FF66]/10 px-3.5 py-1 text-[11px] font-bold text-[#00FF66]">
          {call.callType === 'video' ? (
            <Video className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>
            {call.status === 'ringing'
              ? role === 'admin'
                ? t('callingUser')
                : t('incomingCall')
              : `${t('activeCall')} · ${mins}:${secs}`}
          </span>
        </div>

        <h2 className="mt-4 font-display text-2xl font-extrabold text-white">
          {role === 'admin' ? call.targetName : call.startedBy}
        </h2>
        <p className="mt-1 text-xs text-[#9cb3a5] tabular">
          {call.callType === 'video' ? 'HD Two-Way Video Call' : 'Encrypted Two-Way Audio Call'}
        </p>
      </div>

      {/* Center Stage: Video streams or Pulsing Neon Avatar */}
      <div className="relative flex-1 my-4 flex items-center justify-center overflow-hidden rounded-3xl border border-[#00FF66]/30 bg-[#0b0e0c]">
        {call.callType === 'video' && call.status === 'accepted' ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`h-full w-full object-cover ${remoteHasVideo ? 'opacity-100' : 'opacity-0'}`}
            />
            {!remoteHasVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <img
                  src={TASKPAY_LOGO_SRC}
                  alt="VIP Support"
                  className="h-24 w-24 rounded-full object-cover border-2 border-[#00FF66]"
                />
                <span className="mt-3 text-xs text-[#9cb3a5]">Connecting video stream...</span>
              </div>
            )}
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="absolute bottom-3 end-3 h-32 w-24 rounded-2xl border-2 border-[#00FF66] bg-[#050505] object-cover shadow-xl"
            />
          </>
        ) : (
          <div className="relative flex flex-col items-center justify-center p-6">
            {call.status === 'ringing' && (
              <>
                <span
                  aria-hidden="true"
                  className="absolute h-44 w-44 rounded-full border border-[#00FF66]/35 animate-ping"
                />
                <span
                  aria-hidden="true"
                  className="absolute h-36 w-36 rounded-full border border-[#00FF66]/55"
                />
              </>
            )}
            <div className="relative rounded-full p-1.5 border-2 border-[#00FF66] shadow-[0_0_35px_rgba(0,255,102,0.5)]">
              <img
                src={TASKPAY_LOGO_SRC}
                alt="TaskPay VIP"
                className="h-28 w-28 rounded-full object-cover"
              />
            </div>
            <div className="mt-5 font-mono text-sm font-bold text-[#00FF66] tabular">
              {call.status === 'ringing' ? 'RINGING...' : `${mins}:${secs}`}
            </div>
          </div>
        )}
      </div>

      {mediaNotice && (
        <div className="mb-3 rounded-xl border border-[#FFB800]/50 bg-[#FFB800]/10 px-3 py-2 text-center text-[11px] font-semibold text-[#FFB800]">
          {mediaNotice}
        </div>
      )}

      {/* Bottom Controls */}
      <div className="pb-4 flex items-center justify-center gap-4">
        {call.status === 'accepted' && (
          <>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className={`flex h-14 w-14 items-center justify-center rounded-2xl border cursor-pointer ${
                muted
                  ? 'border-[#FFB800] bg-[#FFB800]/20 text-[#FFB800]'
                  : 'border-[#00FF66]/30 bg-[#101512] text-white'
              }`}
            >
              {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>

            {call.callType === 'video' && (
              <button
                type="button"
                onClick={toggleCamera}
                aria-label={camOff ? 'Camera On' : 'Camera Off'}
                className={`flex h-14 w-14 items-center justify-center rounded-2xl border cursor-pointer ${
                  camOff
                    ? 'border-[#FFB800] bg-[#FFB800]/20 text-[#FFB800]'
                    : 'border-[#00FF66]/30 bg-[#101512] text-white'
                }`}
              >
                {camOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
              </button>
            )}
          </>
        )}

        {call.status === 'ringing' && role === 'user' && (
          <button
            type="button"
            onClick={() => onAccept(call.id)}
            className="flex h-14 items-center gap-2 rounded-2xl vip-btn-neon px-6 text-sm font-extrabold cursor-pointer"
          >
            <Phone className="h-5 w-5" aria-hidden="true" />
            <span>{t('acceptCall')}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onEnd(call.id)}
          className="flex h-14 items-center gap-2 rounded-2xl border border-[#FFB800]/70 bg-[#FFB800]/20 px-6 text-sm font-extrabold text-[#FFB800] cursor-pointer"
        >
          <PhoneOff className="h-5 w-5" aria-hidden="true" />
          <span>{t('declineCall')}</span>
        </button>
      </div>
    </div>
  );
};
