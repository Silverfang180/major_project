import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

// ---------- SHA-256 Identity ----------
async function sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedUser = localStorage.getItem('chronicle-user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
            // Optional: Auto-login based on identity for seamless dev experience
            // const identity = await getIdentity();
            // setUser({ id: identity, email: 'dev@chronicle.local', name: 'Developer' });
        }
      } catch (error) {
        console.error("Failed to restore session", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string) => {
    setIsLoading(true);
    try {
      // Mock login logic
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API delay
      const identityHash = await sha256(email.toLowerCase().trim());
      const newUser: User = {
        id: identityHash,
        email: email,
        name: email.split('@')[0] || 'User',
      };
      localStorage.setItem('chronicle-user', JSON.stringify(newUser));
      setUser(newUser);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('chronicle-user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
