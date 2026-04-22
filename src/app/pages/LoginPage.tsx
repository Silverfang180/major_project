import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Github, Loader2, AlertCircle } from 'lucide-react';
import { LoginBackground } from '../components/login/LoginBackground';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authType, setAuthType] = useState<'email' | 'google' | 'github' | null>(null);
  
  const { login, register, isLoading } = useAuth();
  const navigate = useNavigate();

  const isLight = document.documentElement.classList.contains('light');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAuthType('email');
    try {
      if (isRegister) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    setAuthType(provider);
    setIsLoggingIn(true);
    setError(null);
    try {
      // Social login would still be a mock or redirected to real OAuth in production
      await new Promise(resolve => setTimeout(resolve, 1500));
      setError("Social login is coming soon in the production environment.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="login-theme-wrapper min-h-screen w-full flex items-center justify-center font-sans selection:bg-gray-500/20 overflow-hidden">
      <style>{`
        /* Minimal Waves B&W Theme */
        .login-theme-wrapper {
          --bg: #020617;
          --card-bg: rgba(30, 41, 59, 0.4);
          --border: rgba(255, 255, 255, 0.1);
          --text-main: #f8fafc;
          --text-muted: #94a3b8;
          --accent: #ffffff;
          --input-bg: rgba(255, 255, 255, 0.03);
          --primary: #ffffff;
          --primary-fg: #000000;
          --meta: #94a3b8;
        }

        :root.light .login-theme-wrapper {
          --bg: #ffffff;
          --card-bg: rgba(255, 255, 255, 0.8);
          --border: rgba(0, 0, 0, 0.1);
          --text-main: #000000;
          --text-muted: #64748b;
          --accent: #000000;
          --input-bg: #ffffff;
          --primary: #000000;
          --primary-fg: #ffffff;
          --meta: #000000;
        }

        .login-theme-wrapper, 
        .auth-card, 
        input, 
        button, 
        .social-btn {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .auth-card {
          width: min(420px, 92vw);
          padding: 2.5rem;
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 24px;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.3);
          position: relative;
          z-index: 10;
          animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .meta {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--meta);
          letter-spacing: 0.15em;
          margin-bottom: 0.75rem;
          text-transform: uppercase;
        }

        h2 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-main);
          margin-bottom: 0.5rem;
          letter-spacing: -0.02em;
        }

        .sub {
          font-family: 'Outfit', sans-serif;
          font-size: 0.9rem;
          color: var(--text-muted);
          margin-bottom: 2rem;
          line-height: 1.5;
        }

        .noise {
          position: fixed; inset: 0; z-index: 1; pointer-events: none; 
          opacity: ${isLight ? '0.015' : '0.03'};
          background-image: radial-gradient(circle at 20% 20%, ${isLight ? '#000' : '#fff'} 1px, transparent 1px);
          background-size: 4px 4px;
        }

        .social-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          padding: 0.8rem;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--input-bg);
          color: var(--text-main);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
        }

        .social-btn:hover:not(:disabled) {
          background: ${isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)'};
          transform: translateY(-2px);
          box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.1);
          border-color: var(--accent);
        }

        input {
          width: 100%;
          padding: 0.9rem 1rem;
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          color: var(--text-main);
          font-size: 0.9375rem;
          outline: none;
        }

        input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 4px ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'};
        }

        .submit-btn {
          width: 100%;
          padding: 1rem;
          margin-top: 0.5rem;
          background: var(--primary);
          color: var(--primary-fg);
          border: none;
          border-radius: 12px;
          font-size: 0.9375rem;
          font-weight: 700;
          cursor: pointer;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px -6px rgba(0, 0, 0, 0.2);
          opacity: 0.9;
        }

        .divider {
          position: relative;
          margin: 2rem 0;
          text-align: center;
        }
        .divider::before {
          content: "";
          position: absolute;
          top: 50%; left: 0; right: 0;
          height: 1px;
          background: var(--border);
        }
        .divider span {
          position: relative;
          padding: 0 1rem;
          background: var(--card-bg);
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          backdrop-filter: blur(16px);
        }

        .err-box {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #ef4444;
          border-radius: 12px;
          font-size: 0.8rem;
          margin-bottom: 1rem;
        }
      `}</style>

      <LoginBackground />
      <div className="noise" />

      <div className="auth-card">
        <div className="meta">Chronicle Auth</div>
        <h2>{isRegister ? "Create account" : "Welcome back"}</h2>
        <p className="sub">{isRegister ? "Join the next generation of prompt engineering." : "A minimalist space to continue your workflow."}</p>

        {error && (
          <div className="err-box">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
             <div className="space-y-2">
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
              />
            </div>
          )}
          
          <div className="space-y-2">
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address"
            />
          </div>
          
          <div className="space-y-2">
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading || isLoggingIn}
            className="submit-btn"
          >
            {(isLoading || isLoggingIn) && authType === 'email' ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </div>
            ) : (isRegister ? "Create Account →" : "Continue →")}
          </button>
        </form>

        <div className="divider">
          <span>Social Access</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button 
            disabled={isLoading || isLoggingIn}
            onClick={() => handleSocialLogin('github')}
            className="social-btn"
          >
            {isLoggingIn && authType === 'github' ? <Loader2 size={18} className="animate-spin" /> : <Github size={18} />}
            GitHub
          </button>
          <button 
            disabled={isLoading || isLoggingIn}
            onClick={() => handleSocialLogin('google')}
            className="social-btn"
          >
            {isLoggingIn && authType === 'google' ? <Loader2 size={18} className="animate-spin" /> : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Google
          </button>
        </div>

        <div className="mt-8 text-center text-[0.75rem] text-[var(--text-muted)]">
          {isRegister ? "Already have an account?" : "Need an account?"}{" "}
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-[var(--text-main)] font-semibold hover:underline"
          >
            {isRegister ? "Log in" : "Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}
