import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Peer from 'peerjs';
import DOMPurify from 'dompurify';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axios';
import VideoPlayer from '../components/VideoPlayer';
import ChatPanel from '../components/ChatPanel';
import MeetingControls from '../components/MeetingControls';
import '../styles/room.css';

// ---------- PiP Camera Overlay ----------
function PipOverlay({ stream, userName }) {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const onPointerDown = useCallback((e) => {
    dragging.current = true;
    const rect = overlayRef.current.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    overlayRef.current.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const el = overlayRef.current;
    const parent = el.parentElement;
    const px = parent.getBoundingClientRect();
    let x = e.clientX - px.left - offset.current.x;
    let y = e.clientY - px.top - offset.current.y;
    // Clamp inside parent
    x = Math.max(0, Math.min(x, px.width - el.offsetWidth));
    y = Math.max(0, Math.min(y, px.height - el.offsetHeight));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={overlayRef}
      className="pip-overlay"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ transform: 'scaleX(-1)' }}
      />
      <div className="pip-label">{userName}</div>
    </div>
  );
}

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Password gate state
  const [accessGranted, setAccessGranted] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [meetingInfo, setMeetingInfo] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [myStream, setMyStream] = useState(null);
  const [peers, setPeers] = useState({}); // { peerId: { stream, userName } }
  const [messages, setMessages] = useState([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  // 'connecting' | 'connected' | 'error:...' | 'reconnecting'

  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const myStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peersRef = useRef({});
  const userNameRef = useRef(user?.name);

  // Check if the meeting requires a password
  useEffect(() => {
    let cancelled = false;
    const checkAccess = async () => {
      try {
        const res = await api.get(`/meetings/${roomId}/info`);
        if (cancelled) return;
        setMeetingInfo(res.data);
        if (res.data.hasPassword) {
          setNeedsPassword(true);
        } else {
          setAccessGranted(true);
        }
      } catch {
        // No meeting doc or error → allow access (ad-hoc room)
        if (!cancelled) setAccessGranted(true);
      } finally {
        if (!cancelled) setCheckingAccess(false);
      }
    };
    checkAccess();
    return () => { cancelled = true; };
  }, [roomId]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    try {
      const res = await api.post(`/meetings/${roomId}/verify-password`, { password: passwordInput });
      if (res.data.allowed) {
        setAccessGranted(true);
        setNeedsPassword(false);
      }
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.msg || 'Incorrect password';
      setPasswordError(msg);
    }
  };

  // Send a chat message
  const sendMessage = useCallback((text) => {
    if (socketRef.current && text.trim()) {
      socketRef.current.emit('message', text.trim());
    }
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (myStreamRef.current) {
      const audioTrack = myStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (myStreamRef.current) {
      const videoTrack = myStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  }, []);

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      // Stop screen share — revert to camera
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      const camStream = myStreamRef.current;
      if (camStream) {
        const videoTrack = camStream.getVideoTracks()[0];
        // Replace video track on all active peer connections
        Object.values(peersRef.current).forEach((call) => {
          const sender = call.peerConnection
            ?.getSenders()
            ?.find((s) => s.track?.kind === 'video');
          if (sender && videoTrack) sender.replaceTrack(videoTrack);
        });
      }
      setScreenSharing(false);
      return;
    }

    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screen;
      const screenTrack = screen.getVideoTracks()[0];

      // Replace video track on all active peer connections
      Object.values(peersRef.current).forEach((call) => {
        const sender = call.peerConnection
          ?.getSenders()
          ?.find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      });

      setScreenSharing(true);

      // When user stops sharing via browser UI
      screenTrack.onended = () => {
        const camStream = myStreamRef.current;
        const camTrack = camStream?.getVideoTracks()[0];
        Object.values(peersRef.current).forEach((call) => {
          const sender = call.peerConnection
            ?.getSenders()
            ?.find((s) => s.track?.kind === 'video');
          if (sender && camTrack) sender.replaceTrack(camTrack);
        });
        screenStreamRef.current = null;
        setScreenSharing(false);
      };
    } catch (err) {
      console.warn('Screen share cancelled or failed:', err);
    }
  }, [screenSharing]);

  // Leave meeting
  const leaveMeeting = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (myStreamRef.current) {
      myStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (socketRef.current) socketRef.current.disconnect();
    if (peerRef.current) peerRef.current.destroy();
    navigate('/dashboard');
  }, [navigate]);

  useEffect(() => {
    if (!accessGranted) return;
    let cancelled = false;

    // Keep ref in sync for closures
    userNameRef.current = user?.name;

    // Fetch ICE servers from backend (TURN creds stay server-side)
    const init = async () => {
      let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
      try {
        const res = await api.get('/meetings/ice-servers');
        if (res.data.success) iceServers = res.data.iceServers;
      } catch (err) {
        console.warn('Could not fetch ICE servers, using STUN only:', err);
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err) {
        console.error('Failed to get user media:', err);
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      myStreamRef.current = stream;
      setMyStream(stream);

      const socket = io({ withCredentials: true });
      socketRef.current = socket;

      const peer = new Peer(undefined, {
        host: window.location.hostname,
        port: Number(window.location.port) || (window.location.protocol === 'https:' ? 443 : 80),
        path: '/peerjs',
        secure: window.location.protocol === 'https:',
        config: { iceServers },
        debug: 2,
      });
      peerRef.current = peer;

      // Helper: check if both connections are ready
      const checkConnected = () => {
        if (socket.connected && peer.open) {
          setConnectionStatus('connected');
        }
      };

      // --- Socket.IO lifecycle ---
      socket.on('connect', () => {
        console.log('[Socket.IO] Connected, id =', socket.id);
        checkConnected();
        // On reconnect, re-join room (server-side socket is fresh)
        if (peer.id) {
          console.log('[Socket.IO] (Re)joining room on connect');
          socket.emit('join-room', roomId, peer.id, userNameRef.current);
        }
      });
      socket.on('connect_error', (err) => {
        console.error('[Socket.IO] Connection error:', err.message);
        setConnectionStatus('error: socket ' + err.message);
      });
      socket.on('disconnect', (reason) => {
        console.warn('[Socket.IO] Disconnected:', reason);
        setConnectionStatus('reconnecting');
      });

      // PeerJS error handling
      peer.on('error', (err) => {
        console.error('[PeerJS] Error:', err.type, err);
        setConnectionStatus('error: peer ' + err.type);
      });
      peer.on('disconnected', () => {
        console.warn('[PeerJS] Disconnected from signaling server, reconnecting…');
        setConnectionStatus('reconnecting');
        if (!peer.destroyed) peer.reconnect();
      });

      // Helper: connect a call's stream/close/error events
      const handleCall = (call, peerIdKey, name) => {
        call.on('stream', (remoteStream) => {
          console.log('[PeerJS] Received remote stream from', peerIdKey);
          setPeers((prev) => ({
            ...prev,
            [peerIdKey]: { stream: remoteStream, userName: name },
          }));
        });
        call.on('close', () => {
          delete peersRef.current[peerIdKey];
          setPeers((prev) => {
            const updated = { ...prev };
            delete updated[peerIdKey];
            return updated;
          });
        });
        call.on('error', (err) => {
          console.error('[PeerJS] Call error:', err);
        });
      };

      // Answer incoming calls — register listeners BEFORE answering
      peer.on('call', (call) => {
        console.log('[PeerJS] Incoming call from', call.peer);
        handleCall(call, call.peer, call.metadata?.userName || 'Participant');
        call.answer(stream);
        peersRef.current[call.peer] = call;
      });

      // When a new user connects, call them (with retry)
      socket.on('user-connected', (peerId, userName) => {
        console.log('[Socket.IO] user-connected:', peerId, userName);
        const attemptCall = (attempt = 1) => {
          const call = peer.call(peerId, stream, {
            metadata: { userName: userNameRef.current },
          });
          if (!call) {
            if (attempt < 3) {
              console.warn(`[PeerJS] peer.call returned null, retry ${attempt}/3…`);
              setTimeout(() => attemptCall(attempt + 1), 2000);
            }
            return;
          }
          handleCall(call, peerId, userName);
          peersRef.current[peerId] = call;
        };
        // Delay to let the remote peer fully register on PeerJS server
        setTimeout(() => attemptCall(), 1500);
      });

      // User disconnected
      socket.on('user-disconnected', (peerId) => {
        console.log('[Socket.IO] user-disconnected:', peerId);
        if (peersRef.current[peerId]) {
          peersRef.current[peerId].close();
          delete peersRef.current[peerId];
        }
        setPeers((prev) => {
          const updated = { ...prev };
          delete updated[peerId];
          return updated;
        });
      });

      // Chat messages — sanitize with DOMPurify
      socket.on('createMessage', (message, userName) => {
        setMessages((prev) => [
          ...prev,
          {
            text: DOMPurify.sanitize(message),
            userName: DOMPurify.sanitize(userName),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      });

      // Peer open — join room
      // Socket.IO client buffers emits when disconnected and flushes on connect,
      // so this works regardless of whether the socket is ready yet.
      peer.on('open', (id) => {
        console.log('[PeerJS] Open, id =', id);
        checkConnected();
        socket.emit('join-room', roomId, id, userNameRef.current);
        console.log('[Socket.IO] Emitted join-room (buffered if socket not ready)');
      });
    };

    init();

    // Cleanup on unmount
    return () => {
      cancelled = true;
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (myStreamRef.current) {
        myStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (socketRef.current) socketRef.current.disconnect();
      if (peerRef.current) peerRef.current.destroy();
    };
  }, [roomId, accessGranted]);

  // --- Password gate UI ---
  if (checkingAccess) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-dark text-white">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Checking access...</span>
        </div>
      </div>
    );
  }

  if (needsPassword && !accessGranted) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100" style={{ background: '#1a1a2e' }}>
        <div className="card shadow" style={{ width: '100%', maxWidth: 400 }}>
          <div className="card-body p-4">
            <h4 className="card-title text-center mb-3">
              <i className="fas fa-lock me-2"></i>Meeting Password Required
            </h4>
            {meetingInfo?.title && (
              <p className="text-muted text-center mb-3">{meetingInfo.title}</p>
            )}
            {passwordError && (
              <div className="alert alert-danger py-2">{passwordError}</div>
            )}
            <form onSubmit={handlePasswordSubmit}>
              <div className="mb-3">
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter meeting password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary flex-grow-1">
                  Join Meeting
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => navigate('/dashboard')}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Derive meeting title for the header
  const meetingTitle = meetingInfo?.title && meetingInfo.title !== 'Untitled Meeting'
    ? meetingInfo.title
    : null;

  return (
    <div className="room-container">
      {/* Left panel — videos + controls */}
      <div className="room-main">
        {/* Meeting header bar */}
        <div className="room-header">
          <div className="room-header-left">

        {/* Connection status overlay */}
        {connectionStatus !== 'connected' && (
          <div className={`connection-status-bar status-${connectionStatus.startsWith('error') ? 'error' : connectionStatus}`}>
            {connectionStatus === 'connecting' && <><i className="fas fa-spinner fa-spin me-2"></i>Connecting...</>}
            {connectionStatus === 'reconnecting' && <><i className="fas fa-spinner fa-spin me-2"></i>Reconnecting...</>}
            {connectionStatus.startsWith('error') && <><i className="fas fa-exclamation-triangle me-2"></i>{connectionStatus}</>}
          </div>
        )}
            <i className="fas fa-video me-2"></i>
            <span className="room-title">{meetingTitle || 'Boom Meet'}</span>
          </div>
          <div className="room-header-right">
            <span className="room-id-badge" title="Meeting ID">
              <i className="fas fa-hashtag me-1"></i>
              {roomId.slice(0, 8)}
            </span>
          </div>
        </div>

        <div className="video-grid">
          {/* Screen share — show as the main large tile */}
          {screenSharing && screenStreamRef.current && (
            <VideoPlayer
              stream={screenStreamRef.current}
              muted
              userName="Screen Share"
            />
          )}
          {/* My camera — normal tile when not sharing, hidden when sharing (shown as PiP instead) */}
          {myStream && !screenSharing && (
            <VideoPlayer
              stream={myStream}
              muted
              userName={`${user?.name} (You)`}
              mirrored
            />
          )}
          {/* Peer videos */}
          {Object.entries(peers).map(([peerId, { stream, userName }]) => (
            <VideoPlayer
              key={peerId}
              stream={stream}
              userName={userName}
            />
          ))}
        </div>

        {/* PiP camera overlay when screen sharing */}
        {screenSharing && myStream && (
          <PipOverlay stream={myStream} userName={user?.name} />
        )}

        <MeetingControls
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          screenSharing={screenSharing}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={toggleScreenShare}
          onLeave={leaveMeeting}
        />
      </div>

      {/* Right panel — chat */}
      <ChatPanel messages={messages} onSend={sendMessage} />
    </div>
  );
}
