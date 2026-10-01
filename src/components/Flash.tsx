"use client";

/**
 * The message a click leaves behind ("Advanced Robotix AI."), shown once at the top of the
 * page and cleared on the next navigation.
 */

import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const FlashContext = createContext<(message: string) => void>(() => {});

export function FlashProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  // Any navigation, including a change of view or filter on the same page, clears it.
  const location = `${usePathname()}?${useSearchParams().toString()}`;
  const shownOn = useRef<string | null>(null);

  useEffect(() => {
    if (shownOn.current !== null && shownOn.current !== location) {
      setMessage(null);
      shownOn.current = null;
    }
  }, [location]);

  const show = (text: string) => {
    shownOn.current = location;
    setMessage(text);
  };

  return (
    <FlashContext.Provider value={show}>
      {message ? (
        <div className="alert alert-success flash" role="status">
          <span aria-hidden="true">✅</span> {message}
          <button type="button" className="flash-close" onClick={() => setMessage(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}
      {children}
    </FlashContext.Provider>
  );
}

export function useFlash(): (message: string) => void {
  return useContext(FlashContext);
}
