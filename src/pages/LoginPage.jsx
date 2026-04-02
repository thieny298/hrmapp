import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError('Email hoặc mật khẩu không đúng')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '1rem'
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>WorkFlow</div>
          <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>Hệ thống quản trị doanh nghiệp</div>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '1.5rem' }}>Đăng nhập</div>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="email@congty.vn"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mật khẩu</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center', padding: '10px' }}
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '12px', color: 'var(--text-3)' }}>
          Liên hệ Admin để được cấp tài khoản
        </div>
      </div>
    </div>
  )
}
