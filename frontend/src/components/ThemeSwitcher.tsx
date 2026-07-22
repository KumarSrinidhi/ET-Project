import { useTheme, THEMES } from '../ThemeContext';
import { Palette } from 'lucide-react';

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-2 text-ink-faint hover:text-ink p-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-voltage-500"
        title="Switch theme"
      >
        <Palette className="w-5 h-5" />
      </button>

      <div className="absolute right-0 mt-2 w-64 bg-canvas rounded-lg shadow-lg border border-hairline py-1 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
        <div className="px-3 py-2 border-b border-hairline">
          <p className="text-xs font-semibold text-ink-muted uppercase">Theme</p>
        </div>
        {THEMES.map((t) => {
          const isActive = theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors
                ${isActive ? 'bg-voltage-50' : 'hover:bg-canvas-sunken'}`}
            >
              <div className="flex gap-1 shrink-0">
                {t.colors.map((c, i) => (
                  <span
                    key={i}
                    className="w-3 h-3 rounded-full border border-hairline"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div>
                <div className={`text-sm font-medium ${isActive ? 'text-voltage-600' : 'text-ink'}`}>
                  {t.label}
                </div>
                <div className="text-xs text-ink-faint">{t.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
