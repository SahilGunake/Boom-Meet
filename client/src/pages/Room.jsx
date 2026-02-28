import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Peer from 'peerjs';
import DOMPurify from 'dompurify';
import { useAuth } from '../hooks/useAuth';
import VideoPlayer from '../components/VideoPlayer';
import ChatPanel from '../components/ChatPanel';
import MeetingControls from '../components/MeetingControls';
import '../styles/room.css';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [myStream, setMyStream] = useState(null);
  const [peers, setPeers] = useState({}); // { peerId: { stream, userName } }
  const [messages, setMessages] = useState([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const myStreamRef = useRef(null);
  const peersRef = useRef({});

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

  // Leave meeting
  const leaveMeeting = useCallback(() => {
    if (myStreamRef.current) {
      myStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (socketRef.current) socketRef.current.disconnect();
    if (peerRef.current) peerRef.current.destroy();
    navigate('/dashboard');
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;

    // ICE servers for NAT traversal (STUN + TURN)
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Free TURN servers from Open Relay (metered.ca)
      {
        urls: 'turn:a.relay.metered.ca:80',
        username: 'e7d47c48a58be4e1b1e902a4',
        credential: 'VsM5fBCmF9HEigzH',
      },
      {
        urls: 'turn:a.relay.metered.ca:80?transport=tcp',
        username: 'e7d47c48a58be4e1b1e902a4',
        credential: 'VsM5fBCmF9HEigzH',
      },
      {
        urls: 'turn:a.relay.metered.ca:443',
        username: 'e7d47c48a58be4e1b1e902a4',
        credential: 'VsM5fBCmF9HEigzH',
      },
      {
        urls: 'turns:a.relay.metered.ca:443?transport=tcp',
        username: 'e7d47c48a58be4e1b1e902a4',
        credential: 'VsM5fBCmF9HEigzH',
      },
    ];
    // If a custom TURN server is configured via env, add it too
    if (import.meta.env.VITE_TURN_URL) {
      iceServers.push({
        urls: import.meta.env.VITE_TURN_URL,
        username: import.meta.env.VITE_TURN_USERNAME || '',
        credential: import.meta.env.VITE_TURN_CREDENTIAL || '',
      });
    }

    // Get user media FIRST, then set up socket + peer so all listeners
    // are registered before join-room is emitted (prevents race condition).
    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      .then((stream) => {
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
          debug: 1,
        });
        peerRef.current = peer;

        // PeerJS error handling
        peer.on('error', (err) => {
          console.error('[PeerJS] Error:', err.type, err);
        });
        peer.on('disconnected', () => {
          console.warn('[PeerJS] Disconnected from signaling server, reconnecting…');
          if (!peer.destroyed) peer.reconnect();
        });

        // Helper: connect a call's stream/close/error events
        const handleCall = (call, peerIdKey, name) => {
          call.on('stream', (remoteStream) => {
            setPeers((prev) => ({
              ...prev,
              [peerIdKey]: { stream: remoteStream, userName: name },
            }));
          });
          call.on('close', () => {
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
          handleCall(call, call.peer, call.metadata?.userName || 'Participant');
          call.answer(stream);
        });

        // When a new user connects, call them (with retry)
        socket.on('user-connected', (peerId, userName) => {
          const attemptCall = (attempt = 1) => {
            const call = peer.call(peerId, stream, {
              metadata: { userName: user?.name },
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

        // Peer open — join room only AFTER all listeners are registered
        peer.on('open', (id) => {
          socket.emit('join-room', roomId, id, user?.name);
        });
      })
      .catch((err) => {
        console.error('Failed to get user media:', err);
      });

    // Cleanup on unmount
    return () => {
      cancelled = true;
      if (myStreamRef.current) {
        myStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (socketRef.current) socketRef.current.disconnect();
      if (peerRef.current) peerRef.current.destroy();
    };
  }, [roomId, user?.name]);

  return (
    <div className="room-container">
      {/* Left panel — videos + controls */}
      <div className="room-main">
        <div className="video-grid">
          {/* My video */}
          {myStream && (
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

        <MeetingControls
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onLeave={leaveMeeting}
          roomId={roomId}
        />
      </div>

      {/* Right panel — chat */}
      <ChatPanel messages={messages} onSend={sendMessage} />
    </div>
  );
}
