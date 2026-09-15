import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { registerDevice } from '../lib/device'

const AuthContext = createContext(null)

const SUPER_ROLES = ['admin', 'ceo']
const DEVICE_CHECK_EVENTS = ['SIGNED_IN', 'INITIAL_SESSION']

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)
  const [deviceError, setDeviceError] = useState(null)

  async function fetchPermissions(role) {
    if (SUPER_ROLES.includes(role)) {
      setPermissions({})
      return
    }
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('module, can_view, can_edit, scope')
        .eq('role', role)
      if (error) throw error
      const map = {}
      for (const row of data || []) {
        map[row.module] = { can_view: row.can_view, can_edit: row.can_edit, scope: row.scope }
      }
      setPermissions(map)
    } catch (err) {
      console.error('fetchPermissions error:', err)
      setPermissions({})
    }
  }

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) throw error
      setProfile(data)
      if (data) await fetchPermissions(data.role)
    } catch (err) {
      console.error('fetchProfile error:', err)
      setProfile(null)
      setPermissions({})
    }
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

    if (deviceReqError || data?.status !== 'approved') {
      let message = 'Thiết bị này chưa được phê duyệt, vui lòng đợi admin xác nhận qua email.'
      if (deviceReqError) {
        try {
          const body = await deviceReqError.context.json()
          if (body?.error) message = body.error
        } catch {}
      } else if (data?.error) {
        message = data.error
      }
      try {
        await supabase.auth.signOut()
      } catch {}
      setDeviceError(message)
      return false
    }

    setDeviceError(null)
    return true
  }

  useEffect(() => {
    let initialized = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        setUser(session?.user ?? null)

        if (session?.user) {
          if (DEVICE_CHECK_EVENTS.includes(event)) {
            const ok = await checkDevice(session)
            if (!ok) {
              setProfile(null)
              setPermissions({})
              return
            }
          }
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setPermissions({})
        }
      } catch (err) {
        console.error('onAuthStateChange error:', err)
        setProfile(null)
        setPermissions({})
      } finally {
        if (!initialized) {
          initialized = true
          setLoading(false)
        }
      }
    })

    return () => subscription.unsubscribe()
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
