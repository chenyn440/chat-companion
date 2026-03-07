'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, X } from 'lucide-react';

type CallState = 'idle' | 'calling' | 'receiving' | 'connected' | 'ended';
type CallType = 'audio' | 'video';

interface CallSignal {
  id: string;
  fromUserId: string;
  type: string;
  payload: any;
  createdAt: number;
}

interface CallModalProps {
  userId: string;
  conversationId: string;
  friend: { id: string; nickname: string };
  onClose: () => void;
  // 外部触发发起通话
  initiateCall?: CallType | null;
  onCallInitiated?: () => void;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function CallModal({
  userId, conversationId, friend, onClose, initiateCall, onCallInitiated,
}: CallModalProps) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callType, setCallType] = useState<CallType>('audio');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [toastMsg, setToastMsg] = useState('');
  const [incomingSignal, setIncomingSignal] = useState<CallSignal | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const signalAfterRef = useRef(Date.now());
  const headers = { 'x-user-id': userId, 'Content-Type': 'application/json' };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const sendSignal = useCallback(async (type: string, payload?: any) => {
    await fetch('/api/dm/call', {
      method: 'POST', headers,
      body: JSON.stringify({ conversationId, toUserId: friend.id, type, payload }),
    });
  }, [conversationId, friend.id, userId]);

  const cleanup = useCallback((state: CallState = 'ended') => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setCallState(state);
    setDuration(0);
  }, []);

  const hangup = useCallback(async (notify = true) => {
    if (notify) await sendSignal('end');
    cleanup('ended');
    setTimeout(onClose, 800);
  }, [sendSignal, cleanup, onClose]);

  const createPC = useCallback((type: CallType) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // 发送 ICE candidate 给对方
    pc.onicecandidate = async (e) => {
      if (e.candidate) {
        await sendSignal('ice-candidate', e.candidate.toJSON());
      }
    };

    // 收到远端流
    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    return pc;
  }, [sendSignal]);

  // 发起通话
  const startCall = useCallback(async (type: CallType) => {
    setCallType(type);
    setCallState('calling');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video',
      });
      localStreamRef.current = stream;
      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      const pc = createPC(type);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendSignal('offer', { sdp: offer, callType: type });

      // 30s 超时
      timeoutTimerRef.current = setTimeout(async () => {
        if (callState === 'calling') {
          await sendSignal('end');
          cleanup();
          showToast('对方未接听');
          setTimeout(onClose, 1500);
        }
      }, 30000);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        showToast(type === 'video' ? '未开启摄像头权限' : '未开启麦克风权限');
      } else {
        showToast('无法获取设备，请检查权限');
      }
      cleanup('idle');
    }
  }, [createPC, sendSignal, cleanup, onClose, callState]);

  // 接听
  const acceptCall = useCallback(async () => {
    if (!incomingSignal?.payload?.sdp) return;
    const type: CallType = incomingSignal.payload.callType || 'audio';
    setCallType(type);
    setCallState('connected');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video',
      });
      localStreamRef.current = stream;
      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      const pc = createPC(type);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal.payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendSignal('answer', { sdp: answer });

      durationTimerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        showToast(type === 'video' ? '未开启摄像头权限' : '未开启麦克风权限');
      }
      cleanup('idle');
    }
  }, [incomingSignal, createPC, sendSignal, cleanup]);

  // 拒绝
  const rejectCall = useCallback(async () => {
    await sendSignal('reject');
    cleanup('idle');
    onClose();
  }, [sendSignal, cleanup, onClose]);

  // 处理收到的信令
  const handleSignal = useCallback(async (signal: CallSignal) => {
    const pc = pcRef.current;

    if (signal.type === 'offer') {
      setIncomingSignal(signal);
      setCallState('receiving');
      // 30s 超时自动拒绝
      timeoutTimerRef.current = setTimeout(() => {
        setCallState('idle');
        onClose();
      }, 30000);
    }

    if (signal.type === 'answer' && pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
      setCallState('connected');
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      durationTimerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }

    if (signal.type === 'reject') {
      cleanup();
      showToast('对方已拒绝');
      setTimeout(onClose, 1500);
    }

    if (signal.type === 'end') {
      cleanup();
      showToast('通话已结束');
      setTimeout(onClose, 1000);
    }

    if (signal.type === 'ice-candidate' && pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signal.payload));
      } catch { /* ignore */ }
    }
  }, [cleanup, onClose]);

  // 轮询信令
  useEffect(() => {
    signalAfterRef.current = Date.now() - 1000;
    pollTimerRef.current = setInterval(async () => {
      try {
        const r = await fetch(
          `/api/dm/call?conversationId=${conversationId}&after=${signalAfterRef.current}`,
          { headers: { 'x-user-id': userId } }
        );
        const d = await r.json();
        if (d.success && d.data.length > 0) {
          signalAfterRef.current = d.data[d.data.length - 1].createdAt;
          for (const sig of d.data) {
            await handleSignal(sig);
          }
        }
      } catch { /* ignore */ }
    }, 1500);

    return () => cleanup();
  }, []);

  // 外部触发发起通话
  useEffect(() => {
    if (initiateCall) {
      startCall(initiateCall);
      onCallInitiated?.();
    }
  }, [initiateCall]);

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(!muted);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach(t => { t.enabled = cameraOff; });
    setCameraOff(!cameraOff);
  };

  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // idle 状态不渲染（等待外部触发）
  if (callState === 'idle') return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      {/* Toast */}
      {toastMsg && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-4 py-2 rounded-full z-10">
          {toastMsg}
        </div>
      )}

      <div className="relative bg-[#1a1a2e] rounded-3xl w-80 overflow-hidden shadow-2xl">
        {/* 视频区域 */}
        {callType === 'video' && (
          <div className="relative bg-black w-full aspect-video">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <video
              ref={localVideoRef} autoPlay playsInline muted
              className="absolute bottom-2 right-2 w-20 h-16 object-cover rounded-xl border-2 border-white/20"
            />
          </div>
        )}

        {/* 信息区 */}
        <div className="px-6 py-8 text-center text-white">
          {/* 头像 */}
          {callType === 'audio' && (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-violet-600 flex items-center justify-center text-3xl font-bold mx-auto mb-4">
              {friend.nickname.slice(0, 1)}
            </div>
          )}

          <p className="text-lg font-semibold">{friend.nickname}</p>

          {/* 状态文字 */}
          <p className="text-sm text-white/60 mt-1">
            {callState === 'calling' && '呼叫中…'}
            {callState === 'receiving' && (callType === 'video' ? '视频通话邀请' : '语音通话邀请')}
            {callState === 'connected' && fmtDuration(duration)}
            {callState === 'ended' && '通话已结束'}
          </p>
        </div>

        {/* 按钮区 */}
        <div className="px-6 pb-8">
          {/* 接听/拒绝（来电） */}
          {callState === 'receiving' && (
            <div className="flex justify-center gap-12">
              <button
                onClick={rejectCall}
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
                title="拒绝"
              >
                <PhoneOff size={22} className="text-white" />
              </button>
              <button
                onClick={acceptCall}
                className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors"
                title="接听"
              >
                <Phone size={22} className="text-white" />
              </button>
            </div>
          )}

          {/* 通话中控件 */}
          {callState === 'connected' && (
            <div className="flex justify-center gap-6">
              <button
                onClick={toggleMute}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${muted ? 'bg-white/20' : 'bg-white/10 hover:bg-white/20'}`}
                title={muted ? '取消静音' : '静音'}
              >
                {muted ? <MicOff size={18} className="text-white" /> : <Mic size={18} className="text-white" />}
              </button>
              {callType === 'video' && (
                <button
                  onClick={toggleCamera}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${cameraOff ? 'bg-white/20' : 'bg-white/10 hover:bg-white/20'}`}
                  title={cameraOff ? '开启摄像头' : '关闭摄像头'}
                >
                  {cameraOff ? <VideoOff size={18} className="text-white" /> : <Video size={18} className="text-white" />}
                </button>
              )}
              <button
                onClick={() => hangup()}
                className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
                title="挂断"
              >
                <PhoneOff size={18} className="text-white" />
              </button>
            </div>
          )}

          {/* 呼叫中：取消 */}
          {callState === 'calling' && (
            <div className="flex justify-center">
              <button
                onClick={() => hangup()}
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
                title="取消"
              >
                <PhoneOff size={22} className="text-white" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
