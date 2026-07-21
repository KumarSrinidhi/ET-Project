import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { Shield, Key, Loader2, AlertCircle } from 'lucide-react';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await axios.post(`${BASE}/api/auth/login`, { email, password });
      
      const { access_token, user } = response.data;
      login(access_token, user);
      
      // The redirect is handled in App.tsx by rendering the ProtectedRoute
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('demo123'); // Password doesn't matter for demo mock
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-center mb-8">
            <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
              <Shield className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-center text-white mb-2">Platform Access</h2>
          <p className="text-slate-400 text-center mb-8 text-sm">
            Sign in to the EV Fleet & Supply Chain Intelligence platform
          </p>
          
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                placeholder="you@company.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                placeholder="••••••••"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Key className="w-5 h-5" />}
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-8 pt-8 border-t border-slate-800">
            <p className="text-xs text-slate-500 mb-4 text-center font-medium uppercase tracking-wider">Demo Accounts (Hackathon)</p>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => fillDemo('procurement@demo.com')}
                className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors flex justify-between"
              >
                <span>Procurement Role</span>
                <span className="text-slate-500">procurement@demo.com</span>
              </button>
              <button
                onClick={() => fillDemo('maintenance@demo.com')}
                className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors flex justify-between"
              >
                <span>Maintenance Role</span>
                <span className="text-slate-500">maintenance@demo.com</span>
              </button>
              <button
                onClick={() => fillDemo('executive@demo.com')}
                className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors flex justify-between"
              >
                <span>Executive Role</span>
                <span className="text-slate-500">executive@demo.com</span>
              </button>
              <button
                onClick={() => fillDemo('admin@demo.com')}
                className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors flex justify-between"
              >
                <span>Admin Role</span>
                <span className="text-slate-500">admin@demo.com</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
