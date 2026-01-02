import React, { useState, useEffect } from 'react';
import { Zap, Lock, User, Loader2, CheckSquare, Square } from 'lucide-react';
import { hashString } from '../utils/auth';

const Login = ({ onLogin, expectedIdHash, expectedPwHash }) => {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // [v3.3.1] 로컬 스토리지에서 저장된 ID 불러오기
  useEffect(() => {
    const savedId = localStorage.getItem('yt-trend-scope-admin-id');
    if (savedId) {
      setId(savedId);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setError(false);

    try {
      const inputIdHash = await hashString(id);
      const inputPwHash = await hashString(pw);

      if (inputIdHash === expectedIdHash && inputPwHash === expectedPwHash) {
        // [v3.3.1] 로그인 성공 시 ID 기억 여부에 따라 로컬 스토리지 업데이트
        if (rememberMe) {
          localStorage.setItem('yt-trend-scope-admin-id', id);
        } else {
          localStorage.removeItem('yt-trend-scope-admin-id');
        }
        onLogin();
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Auth Error:", err);
      setError(true);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-[100] p-4">
      {/* Background Neon Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="w-full max-w-md bg-surface/40 backdrop-blur-2xl p-8 rounded-[32px] border border-gray-800 shadow-2xl relative overflow-hidden ring-1 ring-white/5">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
        
        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary/10 p-4 rounded-2xl mb-4 shadow-[0_0_20px_rgba(0,242,255,0.1)]">
            <Zap className="text-primary fill-primary/20" size={32} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase mb-1">
            YT-TREND<span className="text-primary">SCOPE</span>
          </h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Authorized Access Only</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
            <input
              type="text"
              placeholder="Admin ID"
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="w-full bg-black/40 border border-gray-800 focus:border-primary/50 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium outline-none transition-all placeholder:text-gray-600 text-white"
              required
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
            <input
              type="password"
              placeholder="Password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="w-full bg-black/40 border border-gray-800 focus:border-primary/50 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium outline-none transition-all placeholder:text-gray-600 text-white"
              required
            />
          </div>

          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setRememberMe(!rememberMe)}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <div className={`transition-colors ${rememberMe ? 'text-primary' : 'text-gray-600 group-hover:text-gray-400'}`}>
                {rememberMe ? <CheckSquare size={16} /> : <Square size={16} />}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider transition-colors ${rememberMe ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-400'}`}>
                Remember ID
              </span>
            </button>
          </div>

          {error && (
            <div className="text-red-500 text-[10px] font-black text-center uppercase tracking-widest animate-bounce mt-2">
              Invalid Credentials Access Denied
            </div>
          )}

          <button
            type="submit"
            disabled={isAuthenticating}
            className="w-full bg-primary text-black font-black py-4 rounded-2xl text-xs uppercase tracking-[0.2em] shadow-[0_0_25px_rgba(0,242,255,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-wait mt-4 overflow-hidden relative"
          >
            {isAuthenticating ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span>Decrypting...</span>
              </div>
            ) : (
              "Secure Login"
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[9px] text-gray-600 font-bold uppercase tracking-tighter">
            System core <span className="text-gray-500">v3.3.1</span> secure handshake protocol
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

