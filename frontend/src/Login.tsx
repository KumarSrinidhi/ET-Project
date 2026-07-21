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
    <div className="min-h-screen bg-graphite-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-graphite-900 border border-graphite-800 rounded-xl p-8 relative overflow-hidden">
        {/* Voltage accent corner — single beam, no generic radial gradients */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-voltage-500 to-transparent" />

        <div className="relative z-10">
          <div className="flex items-center justify-center mb-8">
            <div className="bg-graphite-800 p-3 rounded-xl border border-graphite-700">
              <Shield className="w-8 h-8 text-voltage-500" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center text-ink-inverse mb-2">Platform Access</h2>
          <p className="text-ink-inverse/60 text-center mb-8 text-sm">
            Sign in to the EV Fleet & Supply Chain Intelligence platform
          </p>

          {error && (
            <div className="mb-6 p-4 bg-status-critical-bg border border-status-critical-border rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-status-critical-fg shrink-0 mt-0.5" />
              <p className="text-sm text-status-critical-fg">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-inverse/80 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-graphite-800 border border-graphite-700 rounded-lg px-4 py-2.5 text-ink-inverse placeholder:text-ink-inverse/30 focus:outline-none focus:ring-2 focus:ring-voltage-500/50 focus:border-voltage-500 transition-all"
                placeholder="you@company.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-inverse/80 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-graphite-800 border border-graphite-700 rounded-lg px-4 py-2.5 text-ink-inverse placeholder:text-ink-inverse/30 focus:outline-none focus:ring-2 focus:ring-voltage-500/50 focus:border-voltage-500 transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-voltage-500 hover:bg-voltage-600 active:bg-voltage-700 text-graphite-950 font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-900 focus-visible:ring-voltage-500"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Key className="w-5 h-5" />}
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-graphite-800">
            <p className="text-xs text-ink-inverse/50 mb-4 text-center font-medium uppercase tracking-wider">Demo Accounts</p>
            <div className="grid grid-cols-1 gap-2">
              {[
                { email: 'procurement@demo.com', label: 'Procurement' },
                { email: 'maintenance@demo.com', label: 'Maintenance' },
                { email: 'executive@demo.com', label: 'Executive' },
                { email: 'admin@demo.com', label: 'Admin' },
              ].map(d => (
                <button
                  key={d.email}
                  onClick={() => fillDemo(d.email)}
                  className="px-4 py-2 text-sm bg-graphite-800 hover:bg-graphite-700 text-ink-inverse/80 rounded-lg border border-graphite-700 transition-colors flex justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-voltage-500"
                >
                  <span>{d.label} Role</span>
                  <span className="text-ink-inverse/40">{d.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
