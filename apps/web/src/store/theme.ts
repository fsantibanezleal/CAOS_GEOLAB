import { create } from 'zustand';

export type Theme = 'light' | 'dark';
const KEY = 'geolab-theme';

function apply(t: Theme): void {
  document.documentElement.setAttribute('data-theme', t);
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: 'light',
  toggle: () => {
    const t: Theme = get().theme === 'light' ? 'dark' : 'light';
    localStorage.setItem(KEY, t);
    apply(t);
    set({ theme: t });
  },
  set: (t) => {
    localStorage.setItem(KEY, t);
    apply(t);
    set({ theme: t });
  },
}));

/** Apply the saved theme before first paint (called from main.tsx). */
export function initTheme(): void {
  const saved = (localStorage.getItem(KEY) as Theme | null) ?? 'light';
  apply(saved);
  useTheme.setState({ theme: saved });
}
