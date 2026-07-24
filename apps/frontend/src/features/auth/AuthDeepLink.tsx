import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthModalStore } from './authModalStore';

/**
 * Keeps /login and /register working as bookmarkable/shareable URLs without
 * bringing back the "modal over an empty page" bug: opens the auth modal
 * (rendered by AppShell over whatever page is actually current) then
 * immediately redirects to / so the Outlet has real content to show behind
 * it, the same as opening the modal from an in-app button does.
 */
function AuthDeepLink({ mode }: { mode: 'login' | 'register' }) {
  const open = useAuthModalStore((state) => state.open);

  useEffect(() => {
    open(mode);
  }, [open, mode]);

  return <Navigate to="/" replace />;
}

export function LoginDeepLink() {
  return <AuthDeepLink mode="login" />;
}

export function RegisterDeepLink() {
  return <AuthDeepLink mode="register" />;
}
