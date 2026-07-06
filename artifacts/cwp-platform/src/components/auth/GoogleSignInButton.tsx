import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

type AuthPortal = "customer" | "staff";

type GoogleSignInButtonProps = {
  portal: AuthPortal;
  onSuccess: (idToken: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  className?: string;
};

let scriptLoadPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Sign-In")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In"));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

async function resolveGoogleClientId(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/google/config");
    if (res.ok) {
      const config = (await res.json()) as { enabled?: boolean; clientId?: string | null };
      if (config.clientId) return config.clientId;
    }
  } catch {
    // fall through to build-time env
  }

  const fromEnv =
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ||
    (import.meta.env.GOOGLE_CLIENT_ID as string | undefined)?.trim();
  return fromEnv || null;
}

export function GoogleSignInButton({
  portal,
  onSuccess,
  onError,
  disabled,
  className,
}: GoogleSignInButtonProps) {
  const hiddenHostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [clientId, setClientId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const initializedRef = useRef(false);

  const handleCredential = useCallback(
    (response: { credential?: string }) => {
      setPending(false);
      if (response.credential) onSuccess(response.credential);
      else onError?.("Google sign-in was cancelled");
    },
    [onSuccess, onError],
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const id = await resolveGoogleClientId();
        if (cancelled) return;

        if (!id) {
          setStatus("unavailable");
          return;
        }

        setClientId(id);
        await loadGoogleScript();
        if (cancelled) return;

        setStatus("ready");
      } catch {
        if (!cancelled) {
          setStatus("unavailable");
          onError?.("Google Sign-In is unavailable right now");
        }
      }
    }

    bootstrap();
    return () => { cancelled = true; };
  }, [onError]);

  useEffect(() => {
    if (status !== "ready" || !clientId || !hiddenHostRef.current || !window.google?.accounts?.id) {
      return;
    }

    if (!initializedRef.current) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        auto_select: false,
        context: "signin",
        ux_mode: "popup",
        itp_support: true,
      });
      initializedRef.current = true;
    }

    const host = hiddenHostRef.current;
    host.innerHTML = "";
    window.google.accounts.id.renderButton(host, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: 320,
      logo_alignment: "left",
    });
  }, [status, clientId, portal, handleCredential]);

  const triggerGoogleSignIn = () => {
    if (!window.google?.accounts?.id) {
      onError?.("Google Sign-In is still loading. Please wait a moment.");
      return;
    }

    const host = hiddenHostRef.current;
    const googleBtn =
      host?.querySelector<HTMLElement>('[role="button"]') ??
      host?.querySelector<HTMLElement>("div[tabindex]");

    if (googleBtn) {
      setPending(true);
      googleBtn.click();
      return;
    }

    setPending(true);
    try {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setPending(false);
          onError?.("Google sign-in popup was blocked. Allow popups and try again.");
        }
      });
    } catch {
      setPending(false);
      onError?.("Could not open Google sign-in. Please try again.");
    }
  };

  if (status === "loading") {
    return (
      <Button
        type="button"
        variant="outline"
        disabled
        className={`w-full border-white/15 bg-white/5 text-white/50 ${className ?? ""}`}
      >
        <Loader2 size={16} className="animate-spin mr-2" />
        Loading Google…
      </Button>
    );
  }

  if (status === "unavailable") return null;

  return (
    <>
      {/* Hidden host for GIS — must stay mounted before renderButton runs */}
      <div
        ref={hiddenHostRef}
        className="fixed left-[-9999px] top-0 h-px w-px overflow-hidden opacity-0 pointer-events-none"
        aria-hidden
      />

      <Button
        type="button"
        variant="outline"
        onClick={triggerGoogleSignIn}
        disabled={disabled || pending}
        data-testid="btn-google-signin"
        className={`w-full border-white/20 bg-white text-secondary hover:bg-white/90 font-medium py-2.5 ${className ?? ""}`}
      >
        {pending ? (
          <Loader2 size={18} className="animate-spin mr-2" />
        ) : (
          <FcGoogle size={18} className="mr-2" />
        )}
        Continue with Google
      </Button>
    </>
  );
}

export function GoogleSignInFallback({
  onClick,
  disabled,
  pending,
}: {
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled || pending}
      className="w-full border-white/15 bg-white text-secondary hover:bg-white/90 font-medium"
    >
      {pending ? (
        <Loader2 size={16} className="animate-spin mr-2" />
      ) : (
        <FcGoogle size={18} className="mr-2" />
      )}
      Continue with Google
    </Button>
  );
}
