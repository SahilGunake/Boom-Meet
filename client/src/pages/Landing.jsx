import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="landing-page d-flex flex-column min-vh-100">
      <nav className="navbar navbar-dark bg-dark px-4">
        <span className="navbar-brand fw-bold">
          <i className="fas fa-video me-2"></i>Boom Meet
        </span>
        <div>
          <Link to="/login" className="btn btn-outline-light me-2">
            Login
          </Link>
          <Link to="/register" className="btn btn-primary">
            Sign Up
          </Link>
        </div>
      </nav>

      <main className="flex-grow-1 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center px-4">
          <h1 className="display-3 fw-bold mb-3">
            Join <span className="text-primary">Boom</span>
          </h1>
          <p className="lead text-muted mb-4" style={{ maxWidth: 520, margin: '0 auto' }}>
            Connect with the world through high-quality video calls.
            Simple, fast, and secure video conferencing for everyone.
          </p>
          <div className="d-flex gap-3 justify-content-center">
            <Link to="/register" className="btn btn-primary btn-lg px-4">
              Get Started
            </Link>
            <Link to="/login" className="btn btn-outline-secondary btn-lg px-4">
              Sign In
            </Link>
          </div>
        </div>
      </main>

      <footer className="bg-dark text-white text-center py-3">
        <small>&copy; {new Date().getFullYear()} Boom Meet</small>
      </footer>
    </div>
  );
}
