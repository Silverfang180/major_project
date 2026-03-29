import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, Loader2, Github } from 'lucide-react';
import { LoginBackground } from '../components/login/LoginBackground';
import { CommitTrail } from '../components/login/CommitTrail';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
    }
    if (!password || password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    await login(email);
    navigate('/'); 
  };

  return (
    <div className="login-scope min-h-screen bg-[var(--bg)] text-[var(--text)] font-mono overflow-hidden selection:bg-blue-500/30">
      <style>{`
        .login-scope {
          --bg: #060a12;
          --bg2: #0b1120;
          --surface: rgba(11, 18, 34, 0.82);
          --border: rgba(56, 120, 220, 0.18);
          --border2: rgba(56, 120, 220, 0.35);
          --blue: #2e78e4;
          --blue-dim: #1a4a9e;
          --cyan: #38c8f0;
          --node: #4fa3ff;
          --text: #e8edf8;
          --muted: #6a7a99;
          --error: #ff4f6a;
          --success: #22d47e;
          --font-head: 'Syne', sans-serif;
          --font-mono: 'Space Mono', monospace;
        }

        :root.light .login-scope {
          --bg: #f8fafc;
          --bg2: #f1f5f9;
          --surface: rgba(255, 255, 255, 0.9);
          --border: rgba(56, 120, 220, 0.12);
          --border2: rgba(56, 120, 220, 0.25);
          --text: #0f172a;
          --muted: #64748b;
          --blue: #2563eb;
        }

        .login-scope h1, .login-scope .brand-name, .login-scope .card-title {
          font-family: var(--font-head);
        }

        @keyframes shimmer {
          0%, 100% { opacity: 0.4; transform: scaleX(0.6); }
          50% { opacity: 1; transform: scaleX(1); }
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }

        @keyframes tagGlow {
          from { box-shadow: 0 0 0 rgba(56, 200, 240, 0); }
          to { box-shadow: 0 0 16px rgba(56, 200, 240, 0.22); }
        }

        @keyframes slideLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes slideRight {
          from { opacity: 0; transform: translateX(40px) scale(0.97); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes shine {
          from { left: -100%; }
          to { left: 100%; }
        }
      `}</style>
      
      <LoginBackground />

      <div className="relative z-10 flex flex-col md:flex-row items-center w-full min-h-screen px-[6vw] gap-0">
        
        {/* ── LEFT PANEL ── */}
        <div className="flex-1 flex flex-col gap-8 py-12 md:py-0 animate-[slideLeft_0.9s_cubic-bezier(0.16,1,0.3,1)_both]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-[#2e78e4] to-[#38c8f0] rounded-lg flex items-center justify-center font-bold text-lg text-white shadow-[0_0_20px_rgba(56,200,240,0.35)]">
              C/
            </div>
            <span className="text-xl font-bold tracking-wider text-[var(--text)]">Chronicle</span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 border border-[rgba(56,120,220,0.35)] rounded-full text-[0.68rem] tracking-[0.12em] text-[#38c8f0] bg-[rgba(56,200,240,0.06)] w-fit animate-[tagGlow_3s_ease-in-out_infinite_alternate]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#38c8f0] animate-[blink_1.6s_step-end_infinite]" />
            PROMPTOPS PLATFORM
          </div>

          <h1 className="text-[clamp(2.4rem,4vw,3.4rem)] font-extrabold leading-[1.08] tracking-tight">
            Version control<br/>
            for your <span className="bg-gradient-to-r from-[#2e78e4] to-[#38c8f0] bg-clip-text text-transparent">LLM prompts</span>
          </h1>

          <p className="text-[0.82rem] leading-[1.9] text-[var(--muted)] max-w-[36ch]">
            Immutable versioning · Alias deployment ·<br/>
            Pareto-optimised model selection.
          </p>

          <div className="hidden md:block">
            <CommitTrail />
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <div className="hidden md:block w-px h-[60vh] bg-gradient-to-b from-transparent via-[var(--border2)] to-transparent mx-[5vw] shrink-0 self-center" />
        <div className="md:hidden w-[60%] h-px bg-gradient-to-r from-transparent via-[var(--border2)] to-transparent my-8 shrink-0" />

        {/* ── RIGHT PANEL — CARD ── */}
        <div className="w-full max-w-[420px] animate-[slideRight_0.9s_cubic-bezier(0.16,1,0.3,1)_both] mb-12 md:mb-0">
          <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-[20px] p-9 backdrop-blur-[24px] saturate-[1.4] shadow-[0_24px_64px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.05)] overflow-hidden">
            {/* card top shimmer */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--cyan)] to-transparent animate-[shimmer_4s_ease-in-out_infinite]" />
            
            {/* card inner glow */}
            <div className="absolute -top-[60px] left-1/2 -translate-x-1/2 w-[200px] h-[120px] bg-[radial-gradient(ellipse,rgba(46,120,228,0.1)_0%,transparent_70%)] pointer-events-none" />

            <h2 className="text-[1.35rem] font-bold mb-1.5 tracking-tight text-[var(--text)]">Sign in</h2>
            <p className="text-[0.72rem] text-[var(--muted)] mb-7">Enter your credentials to access Chronicle.</p>

            <div className="grid grid-cols-2 gap-2.5 mb-5">
              <button 
                onClick={() => console.log('GitHub login')}
                className="group relative flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.04] border border-[rgba(56,120,220,0.18)] hover:border-[rgba(56,120,220,0.35)] transition-all overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Github size={16} />
                <span className="text-[0.76rem] font-medium tracking-wide">GitHub</span>
              </button>
              <button 
                 onClick={() => console.log('Google login')}
                 className="group relative flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.04] border border-[rgba(56,120,220,0.18)] hover:border-[rgba(56,120,220,0.35)] transition-all overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <svg width="15" height="15" viewBox="0 0 24 24">
                  <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-[0.76rem] font-medium tracking-wide">Google</span>
              </button>
            </div>

            <div className="flex items-center gap-3 mb-5 text-[0.68rem] text-[var(--muted)] tracking-widest uppercase">
              <div className="flex-1 h-px bg-[var(--border)]" />
              OR
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className={errors.email ? 'err' : ''}>
                <label className="block text-[0.68rem] tracking-[0.1em] text-[var(--muted)] mb-1.5 uppercase font-medium">Email Address</label>
                <div className="relative group/field">
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if(errors.email) setErrors({...errors, email: undefined}); }}
                    placeholder="you@example.com" 
                    className="w-full bg-white/[0.04] border border-[var(--border)] rounded-xl py-3 px-4 text-[0.82rem] outline-none transition-all focus:border-[var(--blue)] focus:bg-blue-500/5 placeholder:text-[var(--muted)]/40 text-[var(--text)]"
                  />
                  <div className="absolute bottom-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-[var(--cyan)] to-transparent opacity-0 group-focus-within/field:opacity-100 transition-opacity pointer-events-none" />
                </div>
                {errors.email && <div className="text-[0.68rem] text-[var(--error)] mt-1.5 ml-1 animate-pulse">{errors.email}</div>}
              </div>

              <div className={errors.password ? 'err' : ''}>
                <label className="block text-[0.68rem] tracking-[0.1em] text-[var(--muted)] mb-1.5 uppercase font-medium">Password</label>
                <div className="relative group/field">
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if(errors.password) setErrors({...errors, password: undefined}); }}
                    placeholder="••••••••" 
                    className="w-full bg-white/[0.04] border border-[var(--border)] rounded-xl py-3 px-4 text-[0.82rem] outline-none transition-all focus:border-[var(--blue)] focus:bg-blue-500/5 placeholder:text-[var(--muted)]/40 text-[var(--text)]"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] transition-colors p-1"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <div className="absolute bottom-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-[var(--cyan)] to-transparent opacity-0 group-focus-within/field:opacity-100 transition-opacity pointer-events-none" />
                </div>
                {errors.password && <div className="text-[0.68rem] text-[var(--error)] mt-1.5 ml-1 animate-pulse">{errors.password}</div>}
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className="group relative w-full py-3.5 bg-gradient-to-br from-[#1a4a9e] to-[#2e78e4] border border-blue-400/30 rounded-xl text-white font-bold text-[0.82rem] tracking-widest uppercase mt-4 transition-all hover:translate-y-[-1px] hover:shadow-[0_8px_28px_rgba(46,120,228,0.4)] active:translate-y-0 overflow-hidden disabled:opacity-70 disabled:pointer-events-none"
              >
                <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:animate-[shine_0.6s_ease-out_forwards]" />
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-[spin_0.7s_linear_infinite]" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  <span>SIGN IN →</span>
                )}
              </button>
            </form>

            <div className="mt-8 flex justify-between items-center text-[0.68rem] text-[var(--muted)]">
              <span>No account? <a href="#" className="text-[#2e78e4] hover:text-[#38c8f0] transition-colors">Sign up</a></span>
              <a href="#" className="text-[#2e78e4] hover:text-[#38c8f0] transition-colors">Forgot password?</a>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 text-[0.62rem] text-[#6a7a99]/50 tracking-[0.14em] pointer-events-none uppercase">
        CHRONICLE v2.0 · PROMPTOPS
      </div>
    </div>
  );
}

