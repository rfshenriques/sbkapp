import { Link } from 'react-router-dom';

/**
 * Wired as the root route's ErrorBoundary (see app/routes.ts) - catches any
 * render/loader error in the tree and shows this instead of React Router's
 * default "Unexpected Application Error!" stack-trace screen, which is
 * jarring and exposes internals to players. No error detail is shown here
 * on purpose; reloading resolves the vast majority of these (a stale
 * deployed chunk after a redeploy, a transient network blip).
 */
export default function ErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="mx-auto max-w-sm text-center">
        <div className="mb-3 flex items-center justify-center gap-2">
          <span className="brand-flag" aria-hidden="true">
            <i></i>
            <i></i>
            <i></i>
          </span>
          <h1 className="font-display text-xl">Well, that didn't go to plan</h1>
        </div>
        <p className="mt-2 text-sm text-text-secondary">
          Something went sideways on our end. Your wallet and bets are safe - a quick reload usually
          sorts it out.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className="btn-primary slash">
            Reload page
          </button>
          <Link to="/" className="btn-ghost">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
