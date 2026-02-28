import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axios';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');

  const handleNewMeeting = async () => {
    try {
      const res = await api.get('/meetings/new');
      if (res.data.success) {
        navigate(`/room/${res.data.roomId}`);
      }
    } catch (err) {
      console.error('Failed to create meeting:', err);
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
                <button
                  className="btn btn-primary btn-lg px-5"
                  onClick={handleNewMeeting}
                >
                  <i className="fas fa-plus me-2"></i>
                  New Meeting
                </button>
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
