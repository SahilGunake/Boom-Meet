import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axios';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingPassword, setMeetingPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const handleNewMeeting = async (e) => {
    if (e) e.preventDefault();
    setCreating(true);
    try {
      const res = await api.post('/meetings/new', {
        title: meetingTitle.trim() || undefined,
        password: meetingPassword.trim() || undefined,
      });
      if (res.data.success) {
        navigate(`/room/${res.data.roomId}`);
      }
    } catch (err) {
      console.error('Failed to create meeting:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinMeeting = (e) => {
    e.preventDefault();
    const code = joinCode.trim();
    if (code) {
      navigate(`/room/${code}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-vh-100 bg-light">
      <nav className="navbar navbar-dark bg-dark px-4">
        <span className="navbar-brand fw-bold">
          <i className="fas fa-video me-2"></i>Boom Meet
        </span>
        <div className="d-flex align-items-center gap-3">
          <span className="text-white">
            <i className="fas fa-user me-1"></i>
            {user?.name}
          </span>
          <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">
            <div className="card shadow-sm mb-4">
              <div className="card-body text-center p-5">
                <h2 className="mb-3">Welcome, {user?.name}!</h2>
                <p className="text-muted mb-4">
                  Start a new meeting or join an existing one.
                </p>

                {!showNewMeeting ? (
                  <button
                    className="btn btn-primary btn-lg px-5"
                    onClick={() => setShowNewMeeting(true)}
                  >
                    <i className="fas fa-plus me-2"></i>
                    New Meeting
                  </button>
                ) : (
                  <form onSubmit={handleNewMeeting} className="text-start">
                    <div className="mb-3">
                      <label htmlFor="meetingTitle" className="form-label">
                        Meeting Title <span className="text-muted">(optional)</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        id="meetingTitle"
                        placeholder="e.g. Team Standup"
                        value={meetingTitle}
                        onChange={(e) => setMeetingTitle(e.target.value)}
                        maxLength={100}
                      />
                    </div>
                    <div className="mb-3">
                      <label htmlFor="meetingPassword" className="form-label">
                        Meeting Password <span className="text-muted">(optional)</span>
                      </label>
                      <input
                        type="password"
                        className="form-control"
                        id="meetingPassword"
                        placeholder="Leave blank for no password"
                        value={meetingPassword}
                        onChange={(e) => setMeetingPassword(e.target.value)}
                        maxLength={64}
                      />
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        type="submit"
                        className="btn btn-primary flex-grow-1"
                        disabled={creating}
                      >
                        {creating ? 'Creating...' : 'Create & Join'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowNewMeeting(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            <div className="card shadow-sm">
              <div className="card-body p-4">
                <h5 className="card-title mb-3">Join a Meeting</h5>
                <form onSubmit={handleJoinMeeting} className="d-flex gap-2">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter meeting code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn btn-outline-primary text-nowrap">
                    Join
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
