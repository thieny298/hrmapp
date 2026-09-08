import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const SUPER_ROLES = ['admin', 'ceo']

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)

  async function fetchPermissions(role) {
    if (SUPER_ROLES.includes(role)) {
      setPermissions({})
      return
    }
    const { data } = await supabase
      .from('role_permissions')
      .select('module, can_view, can_edit, scope')
      .eq('role', role)
    const map = {}
    for (const row of data || []) {
      map[row.module] = { can_view: row.can_view, can_edit: row.can_edit, scope: row.scope }
    }
    setPermissions(map)
  }

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    if (data) await fetchPermissions(data.role)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setPermissions({})
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
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

  const value = { user, profile, permissions, loading, signIn, signOut, isSuper, canView, canEdit, scopeAll }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
