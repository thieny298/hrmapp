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
     background: 'var(--_gradient), url(/bg-ultility-1.jpg)  #0e241a', padding: '1rem'
    }}>
      <div style={{ width: '100%', maxWidth: '510px' } }>
        <div style={{ textAlign: 'center', marginBottom: '2rem',color: 'var(--white)' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>
            <img src="/Optways-Logo--white.svg" alt="Optways Logo" style={{ width: '300px', height: 'auto', verticalAlign: 'middle' }} />
          </div>
          <div style={{ fontSize: '17px' , color: '#f9f9f9' }}>HỆ THỐNG QUẢN TRỊ</div>
        </div>

        <div className="card" style={{ padding: '25px 45px 45px' , border:'none',background: 'var(--surface)' }}>
          <div style={{ fontSize: '23px', fontWeight: '500', marginBottom: '1.5rem' }}>Đăng nhập</div>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label for="email" className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                id="email"
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
                id="password"
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
