import type { SVGProps } from 'react';
import { TOP_NAV_ICON_SHAPES, type TopNavIconKey } from '@sportsbook/shared';

export interface TopNavIconProps extends Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'children'> {
  icon: TopNavIconKey;
}

/**
 * Renders one of the fixed, staff-pickable icons for the second navbar (see
 * SecondaryNavBar and the backoffice's Top nav CMS page) from shared
 * geometry (packages/shared/src/domain/topNavIcons.ts) - the shapes
 * themselves are the single source of truth for "the same type of design"
 * across both apps, this component is just a thin mapper onto <svg>,
 * matching NavIcons.tsx's own baseProps convention (20x20 viewBox,
 * currentColor, strokeWidth 1.6, round caps/joins).
 */
export function TopNavIcon({ icon, ...props }: TopNavIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {TOP_NAV_ICON_SHAPES[icon].map((shape, index) => {
        const key = index;
        if (shape.kind === 'path') {
          return <path key={key} d={shape.d} fill={shape.fill ?? 'none'} stroke={shape.fill ? 'none' : 'currentColor'} />;
        }
        if (shape.kind === 'circle') {
          return (
            <circle
              key={key}
              cx={shape.cx}
              cy={shape.cy}
              r={shape.r}
              fill={shape.fill ?? 'none'}
              stroke={shape.fill ? 'none' : 'currentColor'}
            />
          );
        }
        if (shape.kind === 'ellipse') {
          return (
            <ellipse
              key={key}
              cx={shape.cx}
              cy={shape.cy}
              rx={shape.rx}
              ry={shape.ry}
              fill={shape.fill ?? 'none'}
              stroke={shape.fill ? 'none' : 'currentColor'}
            />
          );
        }
        if (shape.kind === 'rect') {
          return <rect key={key} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} />;
        }
        return <line key={key} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} />;
      })}
    </svg>
  );
}
