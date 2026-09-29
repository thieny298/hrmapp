import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { registerDevice } from '../lib/device'

const AuthContext = createContext(null)

const SUPER_ROLES = ['admin', 'ceo']
const DEVICE_CHECK_EVENTS = ['SIGNED_IN', 'INITIAL_SESSION']
const SKIP_EVENTS = ['TOKEN_REFRESHED']

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)
  const [deviceError, setDeviceError] = useState(null)

  async function loadPermissions(role) {
    if (SUPER_ROLES.includes(role)) return {}
    const { data, error } = await supabase
      .from('role_permissions')
      .select('module, can_view, can_edit, scope')
      .eq('role', role)
    if (error) throw error
    const map = {}
    for (const row of data || []) {
      map[row.module] = { can_view: row.can_view, can_edit: row.can_edit, scope: row.scope }
    }
    return map
  }

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) throw error
    const perms = data ? await loadPermissions(data.role) : {}
    return { data, perms }
  }

  async function checkDevice(session) {
    let data, deviceReqError

    try {
      const result = await registerDevice(session?.access_token)
      data = result.data
      deviceReqError = result.error
    } catch (err) {
      deviceReqError = err
    }

    if (!deviceReqError && data?.status === 'approved') return { ok: true }

    let message = 'Thiết bị này chưa được phê duyệt, vui lòng đợi admin xác nhận qua email.'
    if (deviceReqError) {
      try {
        const body = await deviceReqError.context.json()
        if (body?.error) message = body.error
      } catch {}
    } else if (data?.error) {
      message = data.error
    }
    return { ok: false, message }
  }

  useEffect(() => {
    let active = true
    let runId = 0

    async function handleSession(event, session, current) {
      const isCurrent = () => active && current === runId

      try {
        if (!session?.user) {
          setProfile(null)
          setPermissions({})
          return
        }

        if (DEVICE_CHECK_EVENTS.includes(event)) {
          const result = await checkDevice(session)
          if (!isCurrent()) return
          if (!result.ok) {
            setProfile(null)
            setPermissions({})
            setDeviceError(result.message)
            try { await supabase.auth.signOut() } catch {}
            return
          }
          setDeviceError(null)
        }

        const { data, perms } = await loadProfile(session.user.id)
        if (!isCurrent()) return
        setProfile(data)
        setPermissions(perms)
      } catch (err) {
        console.error('handleSession error:', err)
        if (isCurrent()) {
          setProfile(null)
          setPermissions({})
        }
      } finally {
        if (isCurrent()) setLoading(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      setUser(session?.user ?? null)
      if (SKIP_EVENTS.includes(event)) return
      const current = ++runId
      setTimeout(() => handleSession(event, session, current), 0)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    setDeviceError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  function isSuper() {
    return profile ? SUPER_ROLES.includes(profile.role) : false
  }

  function canView(module) {
    return isSuper() || permissions[module]?.can_view === true
  }

  function canEdit(module) {
    return isSuper() || permissions[module]?.can_edit === true
  }

  function scopeAll(module) {
    return isSuper() || permissions[module]?.scope === 'all'
  }

  const value = { user, profile, permissions, loading, deviceError, signIn, signOut, isSuper, canView, canEdit, scopeAll }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
