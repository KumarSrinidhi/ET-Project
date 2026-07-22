import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ThemeId = 'net-zero' | 'supply-chain' | 'dark';

interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
  colors: [string, string, string, string]; // [bg, card, brand, accent]
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'net-zero',
    label: 'Industrial Net-Zero',
    description: 'Heavy industry meets clean energy',
    colors: ['#F4F6F8', '#FFFFFF', '#14532D', '#0D9488'],
  },
  {
    id: 'supply-chain',
    label: 'Supply Chain Traceability',
    description: 'High-end manufacturing execution system',
    colors: ['#F8FAFC', '#FFFFFF', '#1E293B', '#2563EB'],
  },
  {
    id: 'dark',
    label: 'Asset Intelligence',
    description: 'Control room dashboard',
    colors: ['#111827', '#1F2937', '#38BDF8', '#34D399'],
  },
];

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
  themeMeta: ThemeMeta;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute('data-theme', id);
  localStorage.setItem('et-theme', id);
}

function getStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem('et-theme');
    if (stored === 'net-zero' || stored === 'supply-chain' || stored === 'dark') {
      return stored;
    }
  } catch { /* localStorage unavailable */ }
  return 'net-zero';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeId>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
  }, []);

  const themeMeta = THEMES.find(t => t.id === theme) || THEMES[0];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themeMeta }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
