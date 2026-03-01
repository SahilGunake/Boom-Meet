import { useEffect, useRef } from 'react';

export default function VideoPlayer({ stream, muted = false, userName, mirrored = false, className = '' }) {
  const videoRef = useRef(null);

  /* ---- keep DOM muted/volume in-sync (React JSX can be unreliable) ---- */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = muted;
    el.volume = muted ? 0 : 1;
  }, [muted]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;

    el.srcObject = stream;
    // Force correct muted/volume state before playing
    el.muted = muted;
    el.volume = muted ? 0 : 1;
    el.play().catch((err) => {
      console.warn('[VideoPlayer] play() blocked, retrying:', err.message);
      // Retry once – covers browsers that need a tiny delay after srcObject set
      setTimeout(() => el.play().catch(() => {}), 300);
    });

    // PeerJS may fire the 'stream' event once per track (video first, audio
    // later on the same MediaStream). Because React's dep array sees the same
    // reference, this effect won't re-run. Listen for new tracks and force
    // the <video> element to re-attach so the audio track actually plays.
    const onTrackChange = () => {
      el.srcObject = stream;
      el.play().catch(() => {});
    };

    stream.addEventListener('addtrack', onTrackChange);
    stream.addEventListener('removetrack', onTrackChange);

    // Route audio output to the system-default device (headphones / speakers).
    // Call on initial mount AND whenever devices change (plug / unplug).
    const syncSink = () => {
      if (typeof el.setSinkId === 'function' && !muted) {
        el.setSinkId('').catch(() => {});
      }
    };
    syncSink();
    navigator.mediaDevices.addEventListener('devicechange', syncSink);

    return () => {
      stream.removeEventListener('addtrack', onTrackChange);
      stream.removeEventListener('removetrack', onTrackChange);
      navigator.mediaDevices.removeEventListener('devicechange', syncSink);
    };
  }, [stream, muted]);

  return (
    <div className={`video-player ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
      />
      {userName && <div className="video-label">{userName}</div>}
    </div>
  );
}
