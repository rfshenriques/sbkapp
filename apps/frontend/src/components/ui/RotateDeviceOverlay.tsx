/**
 * Blocks landscape use on phones - this is a betting UI built for a single
 * portrait layout (fixed header/bottom-nav, bottom-sheet modals sized off
 * viewport height), not a responsive landscape one. Pure CSS media query
 * (see .rotate-device-overlay in index.css) rather than a JS orientation
 * listener - it reacts to rotation instantly with no state/effect needed,
 * and (max-height: 500px) keeps it from ever firing on a desktop browser
 * window that happens to be wide and short.
 */
export function RotateDeviceOverlay() {
  return (
    <div className="rotate-device-overlay fixed inset-0 z-[999] flex-col items-center justify-center gap-4 bg-background px-8 text-center">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-12 w-12 text-text-secondary"
      >
        <rect x="7" y="2" width="10" height="16" rx="2" />
        <path d="M12 15.5h.01" />
        <path d="M20 9a5 5 0 0 0-3.5-4.8" />
        <path d="M20 9l-2-1.2M20 9l-1.2 2" />
      </svg>
      <p className="font-display text-xl">Please rotate your device</p>
      <p className="text-sm text-text-secondary">This app is designed for portrait use only.</p>
    </div>
  );
}
