import { EVENT_NAMES } from '@sportsbook/shared';

export default function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Sportsbook — Phase 0 shell</h1>
        <p className="mt-2 text-sm text-slate-400">
          Shared event contracts wired: {Object.keys(EVENT_NAMES).length} events defined.
        </p>
      </div>
    </main>
  );
}
