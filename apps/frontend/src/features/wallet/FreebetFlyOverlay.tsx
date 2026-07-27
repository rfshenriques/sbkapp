import { useEffect, useState, type CSSProperties } from 'react';
import { FreebetBadgeIcon } from '../../components/ui/NavIcons';
import { useFreebetFlyStore } from './freebetFlyStore';

const ICON_COUNT = 9;

interface FlyIcon {
  id: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  delayMs: number;
  durationMs: number;
}

/**
 * Mounted once at the AppShell level. Renders nothing until
 * freebetFlyStore.trigger() fires, then spawns ICON_COUNT FreebetBadgeIcons
 * at randomized points near the bottom of the viewport and CSS-animates
 * each to the header freebets balance (freebet-fly keyframe, index.css).
 * Calls finish() once the slowest icon lands, which is also when
 * BalancePills swaps its RollingBalance back for plain text.
 */
export function FreebetFlyOverlay() {
  const active = useFreebetFlyStore((state) => state.active);
  const targetId = useFreebetFlyStore((state) => state.targetId);
  const finish = useFreebetFlyStore((state) => state.finish);
  const [icons, setIcons] = useState<FlyIcon[]>([]);

  useEffect(() => {
    if (!active) return;

    const targetEl = document.getElementById(targetId);
    const targetRect = targetEl?.getBoundingClientRect();
    const targetX = targetRect ? targetRect.left + targetRect.width / 2 : window.innerWidth / 2;
    const targetY = targetRect ? targetRect.top + targetRect.height / 2 : 24;

    const generated: FlyIcon[] = Array.from({ length: ICON_COUNT }, (_, id) => {
      const startX = Math.random() * window.innerWidth;
      const startY = window.innerHeight + 40;
      return {
        id,
        startX,
        startY,
        dx: targetX - startX,
        dy: targetY - startY,
        delayMs: Math.random() * 350,
        durationMs: 900 + Math.random() * 400,
      };
    });
    setIcons(generated);

    const totalMs = Math.max(...generated.map((icon) => icon.delayMs + icon.durationMs));
    const timeout = setTimeout(() => {
      setIcons([]);
      finish();
    }, totalMs + 60);
    return () => clearTimeout(timeout);
  }, [active, targetId, finish]);

  if (icons.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden="true">
      {icons.map((icon) => (
        <span
          key={icon.id}
          className="freebet-fly-icon absolute"
          style={
            {
              left: icon.startX,
              top: icon.startY,
              '--fly-dx': `${icon.dx}px`,
              '--fly-dy': `${icon.dy}px`,
              animationDuration: `${icon.durationMs}ms`,
              animationDelay: `${icon.delayMs}ms`,
            } as CSSProperties
          }
        >
          <FreebetBadgeIcon width={28} height={28} />
        </span>
      ))}
    </div>
  );
}
