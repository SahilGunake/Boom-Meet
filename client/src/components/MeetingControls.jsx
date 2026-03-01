import { useState, useRef, useEffect } from 'react';

export default function MeetingControls({
  audioEnabled,
  videoEnabled,
  screenSharing,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onLeave,
  audioDevices = [],
  activeAudioDeviceId = '',
  onSwitchAudioDevice,
}) {
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showAudioMenu) return;
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowAudioMenu(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [showAudioMenu]);

  const copyRoomLink = () => {
    const link = window.location.href;
    navigator.clipboard.writeText(link).then(() => {
      alert('Room link copied to clipboard!');
    });
  };

  return (
    <div className="meeting-controls">
      {/* Mic button + device picker */}
      <div className="control-btn-group" ref={menuRef}>
        <button
          className={`control-btn ${!audioEnabled ? 'control-btn-off' : ''}`}
          onClick={onToggleAudio}
          title={audioEnabled ? 'Mute' : 'Unmute'}
        >
          <i className={`fas ${audioEnabled ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
        </button>
        <button
          className={`control-btn-arrow ${!audioEnabled ? 'control-btn-off' : ''}`}
          onClick={() => setShowAudioMenu((v) => !v)}
          title="Choose microphone"
        >
          <i className="fas fa-chevron-up"></i>
        </button>

        {showAudioMenu && audioDevices.length > 0 && (
          <div className="audio-device-menu">
            <div className="audio-device-menu-title">Select Microphone</div>
            {audioDevices.map((d) => (
              <button
                key={d.deviceId}
                className={`audio-device-option ${d.deviceId === activeAudioDeviceId ? 'active' : ''}`}
                onClick={() => {
                  onSwitchAudioDevice?.(d.deviceId);
                  setShowAudioMenu(false);
                }}
              >
                <i className={`fas fa-${d.deviceId === activeAudioDeviceId ? 'check-circle' : 'circle'} me-2`}></i>
                {d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        className={`control-btn ${!videoEnabled ? 'control-btn-off' : ''}`}
        onClick={onToggleVideo}
        title={videoEnabled ? 'Stop Video' : 'Start Video'}
      >
        <i className={`fas ${videoEnabled ? 'fa-video' : 'fa-video-slash'}`}></i>
      </button>

      <button
        className={`control-btn ${screenSharing ? 'control-btn-active' : ''}`}
        onClick={onToggleScreenShare}
        title={screenSharing ? 'Stop Sharing' : 'Share Screen'}
      >
        <i className={`fas ${screenSharing ? 'fa-stop' : 'fa-desktop'}`}></i>
      </button>

      <button
        className="control-btn"
        onClick={copyRoomLink}
        title="Copy invite link"
      >
        <i className="fas fa-link"></i>
      </button>

      <button
        className="control-btn control-btn-leave"
        onClick={onLeave}
        title="Leave Meeting"
      >
        <i className="fas fa-phone-slash"></i>
      </button>
    </div>
  );
}
