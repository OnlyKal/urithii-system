import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } })
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
  }, [])

  const refresh = useCallback(async () => {
    const data = await api('/auth/me')
    setUser(data.user)
  }, [])

  const can = useCallback((permission) => Boolean(user?.permissions.includes(permission)), [user])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh, can }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
