export default function MeetingControls({
  audioEnabled,
  videoEnabled,
  screenSharing,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onLeave,
}) {
  const copyRoomLink = () => {
    const link = window.location.href;
    navigator.clipboard.writeText(link).then(() => {
      alert('Room link copied to clipboard!');
    });
  };

  return (
    <div className="meeting-controls">
      <button
        className={`control-btn ${!audioEnabled ? 'control-btn-off' : ''}`}
        onClick={onToggleAudio}
        title={audioEnabled ? 'Mute' : 'Unmute'}
      >
        <i className={`fas ${audioEnabled ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
      </button>

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
