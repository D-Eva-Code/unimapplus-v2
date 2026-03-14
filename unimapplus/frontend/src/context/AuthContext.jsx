import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('unimap_user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('unimap_token'));

  function login(userData, tok) {
    setUser(userData);
    setToken(tok);
    localStorage.setItem('unimap_user', JSON.stringify(userData));
    localStorage.setItem('unimap_token', tok);
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem('unimap_user');
    localStorage.removeItem('unimap_token');
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
