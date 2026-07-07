import { useCallback, useState } from "react";
import type { AuthResponse } from "@workspace/api-client-react";
import type { AuthUser } from "@/lib/auth";

type UseCustomerPasswordPromptOptions = {
  login: (user: AuthUser, token: string) => void;
  onComplete: (role: AuthUser["role"]) => void;
};

export function useCustomerPasswordPrompt({ login, onComplete }: UseCustomerPasswordPromptOptions) {
  const [pendingAuth, setPendingAuth] = useState<AuthResponse | null>(null);
  const [showSetPassword, setShowSetPassword] = useState(false);

  const completeAuth = useCallback(
    (data: AuthResponse) => {
      login(data.user as AuthUser, data.token);
      onComplete(data.user.role as AuthUser["role"]);
      setPendingAuth(null);
      setShowSetPassword(false);
    },
    [login, onComplete],
  );

  const handleAuthSuccess = useCallback(
    (data: AuthResponse) => {
      if (data.user.role === "customer" && !data.user.hasUserPassword) {
        login(data.user as AuthUser, data.token);
        setPendingAuth(data);
        setShowSetPassword(true);
        return;
      }
      completeAuth(data);
    },
    [completeAuth, login],
  );

  const handlePasswordSaved = useCallback(
    (user: AuthResponse["user"]) => {
      if (!pendingAuth) return;
      completeAuth({ ...pendingAuth, user });
    },
    [completeAuth, pendingAuth],
  );

  const handleSkipPassword = useCallback(() => {
    if (!pendingAuth) return;
    completeAuth(pendingAuth);
  }, [completeAuth, pendingAuth]);

  return {
    showSetPassword,
    setShowSetPassword,
    handleAuthSuccess,
    handlePasswordSaved,
    handleSkipPassword,
  };
}
