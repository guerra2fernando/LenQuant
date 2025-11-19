import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type UserMode = "easy" | "advanced";

const MODE_STORAGE_KEY = "lenquant-user-mode";
const DEFAULT_MODE: UserMode = "easy";

interface ModeContextType {
  mode: UserMode;
  setMode: (mode: UserMode) => void;
  isEasyMode: boolean;
  isAdvancedMode: boolean;
}

const ModeContext = createContext<ModeContextType>({
  mode: DEFAULT_MODE,
  setMode: () => {
    throw new Error("setMode must be used within a ModeProvider");
  },
  isEasyMode: true,
  isAdvancedMode: false,
});

export function ModeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [mode, setModeState] = useState<UserMode>(DEFAULT_MODE);
  useEffect(() => {
    // Load mode from localStorage on mount
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    if (stored === "easy" || stored === "advanced") {
      setModeState(stored);
    }
  }, []);

  const setMode = (newMode: UserMode) => {
    setModeState(newMode);
    localStorage.setItem(MODE_STORAGE_KEY, newMode);
  };

  return (
    <ModeContext.Provider
      value={{
        mode,
        setMode,
        isEasyMode: mode === "easy",
        isAdvancedMode: mode === "advanced",
      }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode(): ModeContextType {
  return useContext(ModeContext);
}

