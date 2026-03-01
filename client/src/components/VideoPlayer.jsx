import { useEffect, useRef } from 'react';

export default function VideoPlayer({ stream, muted = false, userName, mirrored = false, className = '' }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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
