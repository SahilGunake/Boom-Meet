import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setMessage('');
    setSubmitting(true);

    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setMessage(data.msg);
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) {
        setErrors(data.errors);
      } else {
        setErrors([{ msg: 'Something went wrong. Please try again.' }]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
      <div className="card shadow-sm" style={{ width: '100%', maxWidth: 420 }}>
        <div className="card-body p-4">
          <h3 className="card-title text-center mb-4">
            <i className="fas fa-key me-2 text-primary"></i>Forgot Password
          </h3>

          {errors.length > 0 && (
            <div className="alert alert-danger py-2">
              {errors.map((err, i) => (
                <div key={i}>{err.msg}</div>
              ))}
            </div>
          )}

          {message && <div className="alert alert-success py-2">{message}</div>}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="email" className="form-label">
                Email address
              </label>
              <input
                type="email"
                className="form-control"
                id="email"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={submitting}
            >
              {submitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <p className="text-center mt-3 mb-0">
            <Link to="/login">Back to Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
