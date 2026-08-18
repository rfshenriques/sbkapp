/**
 * Shown while useBrandTheme's fetch is still in flight - visually matches
 * index.html's static #app-boot-loader spinner exactly (same size, same
 * border styling) so there's no visible handoff once React mounts and
 * replaces the static markup with this. Neutral on purpose: no wordmark, no
 * accent color, nothing that could later turn out to have been wrong once
 * the real brand (name, logo, colors) resolves - AppShell renders this
 * instead of its real header/nav until then, so a player never sees a
 * flash of "Sportsbook" in the generic fallback palette before the actual
 * brand applies.
 */
export function AppBootScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background" role="status" aria-label="Loading">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-text-muted/30 border-t-text-primary" />
    </div>
  );
}
