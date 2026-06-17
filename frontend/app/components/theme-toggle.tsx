"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "cubestats:theme";

export function ThemeToggle() {
  // The pre-paint script in layout.tsx has already set data-theme; mirror it
  // into state once mounted so the button label stays in sync.
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (current === "dark" || current === "light") {
      setTheme(current);
    }
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage failures (private mode, disabled storage).
    }
    setTheme(next);
  }

  const nextLabel = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${nextLabel} mode`}
      // Avoid a hydration mismatch: render a stable label until mounted.
      suppressHydrationWarning
    >
      {!mounted ? "Theme" : theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
