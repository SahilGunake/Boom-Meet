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
    const socket = io({ withCredentials: true });
    socketRef.current = socket;

    // ICE servers for NAT traversal (STUN + TURN)
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
    // If a TURN server is configured, add it
    if (import.meta.env.VITE_TURN_URL) {
      iceServers.push({
        urls: import.meta.env.VITE_TURN_URL,
        username: import.meta.env.VITE_TURN_USERNAME || '',
        credential: import.meta.env.VITE_TURN_CREDENTIAL || '',
      });
    }

    const peer = new Peer(undefined, {
      host: window.location.hostname,
      port: Number(window.location.port) || 443,
      path: '/peerjs',
      secure: window.location.protocol === 'https:',
      config: { iceServers },
    });
    peerRef.current = peer;

    // Peer open — join room for chat immediately (before media is ready)
    peer.on('open', (id) => {
      socket.emit('join-room', roomId, id, user?.name);
    });

    // Get user media
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
        myStreamRef.current = stream;
        setMyStream(stream);
        streamReady = true;

        // Answer incoming calls
        peer.on('call', (call) => {
          call.answer(stream);
          call.on('stream', (remoteStream) => {
            setPeers((prev) => ({
              ...prev,
              [call.peer]: {
                stream: remoteStream,
                userName: call.metadata?.userName || 'Participant',
              },
            }));
          });
          call.on('close', () => {
            setPeers((prev) => {
              const updated = { ...prev };
              delete updated[call.peer];
              return updated;
            });
          });
        });

        // When a new user connects, call them
        socket.on('user-connected', (peerId, userName) => {
          // Small delay to ensure the remote peer is ready
          setTimeout(() => {
            const call = peer.call(peerId, stream, {
              metadata: { userName: user?.name },
            });
            call.on('stream', (remoteStream) => {
              setPeers((prev) => ({
                ...prev,
                [peerId]: { stream: remoteStream, userName },
              }));
            });
            call.on('close', () => {
              setPeers((prev) => {
                const updated = { ...prev };
                delete updated[peerId];
                return updated;
              });
            });
            peersRef.current[peerId] = call;
          }, 1000);
        });
      })
      .catch((err) => {
        console.error('Failed to get user media:', err);
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

    // Chat messages — FIXED: sanitize with DOMPurify
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

    // Cleanup on unmount
    return () => {
      if (myStreamRef.current) {
        myStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      socket.disconnect();
      peer.destroy();
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
