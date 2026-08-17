import { betStatusCategory, betStatusLabel, type BetStatusCategory } from '../../lib/betStatus';
import type { PlacedBet } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';
import { displayedPayoutCents, formatEuros, uninsuredPayoutCents, unboostedCombinedOdds } from './betMoney';

/**
 * Best-effort image load for the brand's share logo (see
 * BrandsService.setLogo's SHARE_LIGHT/SHARE_DARK slots, resolved to the
 * active theme by useBrandTheme into brandStore) - resolves null rather
 * than rejecting on any failure (missing logo, network hiccup, CORS), so a
 * broken/unset logo never breaks sharing the bet itself.
 */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/**
 * Reads a brand's live CSS custom property rather than hardcoding a color -
 * the whole point of this generator is that a shared bet image should look
 * like it came from *this* deployment's actual theme (see
 * useBrandTheme.ts), not a fixed reference palette baked into the canvas
 * code. Falls back to the same defaults index.css itself declares, for the
 * rare case this runs before the stylesheet has applied.
 */
function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3 ? normalized.split('').map((c) => c + c).join('') : normalized;
  const int = Number.parseInt(full, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface StatusColors {
  background: string;
  text: string;
}

/** Mirrors betStatus.ts's BADGE_CLASSES, but resolved to raw colors - canvas fillStyle can't consume a Tailwind class or var(). */
function statusColors(category: BetStatusCategory): StatusColors {
  switch (category) {
    case 'won':
      return { background: cssVar('--color-price-up', '#2ed573'), text: '#000000' };
    case 'lost':
      return { background: cssVar('--color-price-down', '#ef4444'), text: '#ffffff' };
    case 'void':
      return { background: rgba(cssVar('--color-highlight', '#f5b301'), 0.2), text: cssVar('--color-highlight', '#f5b301') };
    case 'insured':
      return { background: rgba(cssVar('--color-insured', '#38bdf8'), 0.2), text: cssVar('--color-insured', '#38bdf8') };
    default:
      return { background: cssVar('--color-surface-2', '#181c24'), text: cssVar('--color-text-secondary', '#8b93a3') };
  }
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

function measurePillWidth(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  ctx.font = font;
  return ctx.measureText(text).width + 24;
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  {
    x,
    y,
    text,
    font,
    colors,
    outline = false,
  }: { x: number; y: number; text: string; font: string; colors: StatusColors; outline?: boolean },
): number {
  ctx.font = font;
  const height = 26;
  const width = measurePillWidth(ctx, text, font);
  const radius = height / 2;

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  if (outline) {
    ctx.strokeStyle = colors.background;
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    ctx.fillStyle = colors.background;
    ctx.fill();
  }

  ctx.fillStyle = colors.text;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, x + width / 2, y + height / 2 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  return width;
}

const WIDTH = 640;
const PADDING = 32;
const ROW_HEIGHT = 78;

/**
 * Draws this bet as a self-contained "receipt" card onto an offscreen
 * canvas and resolves a PNG blob - the shareable image behind
 * ShareBetButton (see there for the actual navigator.share/download flow).
 * Deliberately mirrors BetReceipt's content (header/status, every
 * selection, footer totals, ref) rather than a cropped screenshot of the
 * DOM, so it reads correctly regardless of the device's pixel ratio or
 * viewport width.
 */
export async function renderBetCardImage(bet: PlacedBet): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Best-effort - worst case the fallback sans-serif renders instead.
    }
  }

  const isAccumulator = bet.selections.length > 1;
  const isInsured = bet.insuranceCostPercent > 0;
  const hasTags = isInsured || bet.accaBoostPercent > 0;
  const payoutCents = displayedPayoutCents(bet);
  const isInsuredLoss = bet.status === 'LOST' && isInsured;
  const showInsuranceBeforeAfter = isInsured && payoutCents > 0 && !isInsuredLoss;

  const shareLogoUrl = useBrandStore.getState().shareLogoUrl;
  const logoImage = shareLogoUrl ? await loadImage(shareLogoUrl) : null;
  const logoMaxHeight = 28;
  const logoMaxWidth = 160;
  const logoDrawHeight = logoImage
    ? Math.min(logoMaxHeight, (logoMaxWidth / logoImage.width) * logoImage.height)
    : 0;
  const logoBandHeight = logoImage ? logoDrawHeight + 20 : 0;

  const footerLines = 3; // odds (combined for an accumulator, the single's own price otherwise) + stake + payout
  const headerHeight = hasTags ? 88 : 60;
  const footerHeight = footerLines * 34 + 24;
  const refHeight = 40;
  const cardHeight =
    PADDING +
    logoBandHeight +
    headerHeight +
    bet.selections.length * ROW_HEIGHT +
    footerHeight +
    refHeight +
    PADDING;
  const height = cardHeight + PADDING * 2;

  const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(WIDTH * dpr);
  canvas.height = Math.round(height * dpr);
  const context2d = canvas.getContext('2d');
  if (!context2d) {
    throw new Error('Canvas 2D context unavailable');
  }
  // A non-null local binding, not just a narrowed `ctx` - TypeScript can't
  // carry a narrowing of a closed-over variable into the footerRow closure
  // defined further down, since in principle that closure could be called
  // after `ctx` changed (it can't here, but the type system doesn't know
  // that).
  const ctx: CanvasRenderingContext2D = context2d;
  ctx.scale(dpr, dpr);

  const colors = {
    background: cssVar('--color-background', '#0b0d11'),
    surface: cssVar('--color-surface', '#12151b'),
    border: cssVar('--color-border', '#242a35'),
    textPrimary: cssVar('--color-text-primary', '#f2f4f8'),
    textSecondary: cssVar('--color-text-secondary', '#8b93a3'),
    textMuted: cssVar('--color-text-muted', '#5b6472'),
    highlight: cssVar('--color-highlight', '#f5b301'),
  };

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, height);

  const cardX = PADDING;
  const cardY = PADDING;
  const cardWidth = WIDTH - PADDING * 2;
  const cardRadius = 20;
  ctx.fillStyle = colors.surface;
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + cardRadius, cardY);
  ctx.arcTo(cardX + cardWidth, cardY, cardX + cardWidth, cardY + cardHeight, cardRadius);
  ctx.arcTo(cardX + cardWidth, cardY + cardHeight, cardX, cardY + cardHeight, cardRadius);
  ctx.arcTo(cardX, cardY + cardHeight, cardX, cardY, cardRadius);
  ctx.arcTo(cardX, cardY, cardX + cardWidth, cardY, cardRadius);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const contentX = cardX + 24;
  const contentWidth = cardWidth - 48;
  let y = cardY + 24;

  // Brand's share logo (see BrandLogoSlot.SHARE_LIGHT/SHARE_DARK), centered
  // above the header - purely a letterhead, so it's skipped entirely (no
  // reserved space either, see logoBandHeight above) rather than showing a
  // broken-image placeholder when a brand hasn't uploaded one.
  if (logoImage) {
    const logoDrawWidth = (logoDrawHeight / logoImage.height) * logoImage.width;
    ctx.drawImage(logoImage, contentX + (contentWidth - logoDrawWidth) / 2, y, logoDrawWidth, logoDrawHeight);
    y += logoBandHeight;
  }

  // Header: bet type + status pill.
  ctx.font = "800 20px 'Saira Condensed', sans-serif";
  ctx.fillStyle = colors.textPrimary;
  ctx.fillText(isAccumulator ? `ACCUMULATOR (${bet.selections.length})` : 'SINGLE', contentX, y + 8);

  const statusPillFont = "700 12px Archivo, sans-serif";
  const statusPillWidth = measurePillWidth(ctx, betStatusLabel(bet.status), statusPillFont);
  drawPill(ctx, {
    x: contentX + contentWidth - statusPillWidth,
    y: y - 12,
    text: betStatusLabel(bet.status),
    font: statusPillFont,
    colors: statusColors(betStatusCategory(bet.status, isInsured)),
  });

  y += 30;
  if (hasTags) {
    ctx.font = '600 12px Archivo, sans-serif';
    let tagX = contentX;
    const tags = [
      isInsured ? 'INSURED' : null,
      bet.accaBoostPercent > 0 ? `BOOSTED +${bet.accaBoostPercent}%` : null,
    ].filter((tag): tag is string => tag !== null);
    for (const tag of tags) {
      const tagWidth = drawPill(ctx, {
        x: tagX,
        y,
        text: tag,
        font: '600 11px Archivo, sans-serif',
        colors: { background: colors.border, text: colors.textSecondary },
        outline: true,
      });
      tagX += tagWidth + 8;
    }
    y += 34;
  } else {
    y += 4;
  }

  ctx.strokeStyle = colors.border;
  ctx.beginPath();
  ctx.moveTo(contentX, y);
  ctx.lineTo(contentX + contentWidth, y);
  ctx.stroke();

  // Each selection.
  for (const selection of bet.selections) {
    const rowTop = y;
    const rowColors = statusColors(betStatusCategory(selection.status));
    const dotRadius = 9;
    ctx.fillStyle = rowColors.background;
    ctx.beginPath();
    ctx.arc(contentX + dotRadius, rowTop + 26, dotRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rowColors.text;
    ctx.font = '700 11px Archivo, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyph = selection.status === 'WON' ? '✓' : selection.status === 'LOST' ? '✕' : selection.status === 'VOID' ? '–' : '';
    ctx.fillText(glyph, contentX + dotRadius, rowTop + 27);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const textX = contentX + dotRadius * 2 + 12;
    const oddsText = Number(selection.odds).toFixed(2);
    ctx.font = '700 11px Archivo, sans-serif';
    const oddsWidth = ctx.measureText(oddsText).width;

    ctx.font = "700 16px 'Saira Condensed', sans-serif";
    ctx.fillStyle = colors.textPrimary;
    const nameMaxWidth = contentX + contentWidth - textX - oddsWidth - 16;
    ctx.fillText(truncateToWidth(ctx, selection.selectionName.toUpperCase(), nameMaxWidth), textX, rowTop + 20);

    ctx.font = '400 13px Archivo, sans-serif';
    ctx.fillStyle = colors.textSecondary;
    ctx.fillText(truncateToWidth(ctx, selection.marketName, nameMaxWidth), textX, rowTop + 38);

    ctx.font = '600 14px Archivo, sans-serif';
    ctx.fillStyle = colors.textSecondary;
    ctx.textAlign = 'right';
    ctx.fillText(oddsText, contentX + contentWidth, rowTop + 20);
    ctx.textAlign = 'left';

    ctx.font = '400 12px Archivo, sans-serif';
    ctx.fillStyle = colors.textMuted;
    ctx.fillText(truncateToWidth(ctx, selection.matchLabel, contentWidth - dotRadius * 2 - 12), textX, rowTop + 58);

    y = rowTop + ROW_HEIGHT;
    ctx.strokeStyle = colors.border;
    ctx.beginPath();
    ctx.moveTo(contentX, y);
    ctx.lineTo(contentX + contentWidth, y);
    ctx.stroke();
  }

  y += 20;

  function footerRow(label: string, value: string, opts?: { valueColor?: string; bold?: boolean }) {
    ctx.font = '500 14px Archivo, sans-serif';
    ctx.fillStyle = colors.textSecondary;
    ctx.fillText(label, contentX, y + 14);
    ctx.font = opts?.bold ? "700 15px 'Saira Condensed', sans-serif" : '600 14px Archivo, sans-serif';
    ctx.fillStyle = opts?.valueColor ?? colors.textPrimary;
    ctx.textAlign = 'right';
    ctx.fillText(value, contentX + contentWidth, y + 14);
    ctx.textAlign = 'left';
    y += 34;
  }

  footerRow(isAccumulator ? 'Combined odds' : 'Odds', Number(bet.combinedOdds).toFixed(2), {
    valueColor: colors.highlight,
    bold: true,
  });

  footerRow('Stake', `${bet.fundedByFreebets ? 'F ' : ''}${formatEuros(bet.stakeCents)}`);

  const payoutLabel = bet.status === 'PENDING' ? 'Potential payout' : 'Payout';
  if (isInsuredLoss) {
    footerRow(payoutLabel, `F ${formatEuros(bet.stakeCents)}`, { bold: true });
  } else if (showInsuranceBeforeAfter) {
    footerRow(payoutLabel, `${formatEuros(uninsuredPayoutCents(bet))} → ${formatEuros(payoutCents)}`, { bold: true });
  } else {
    footerRow(payoutLabel, formatEuros(payoutCents), { bold: true });
  }

  if (bet.accaBoostPercent > 0 && isAccumulator) {
    ctx.font = '400 11px Archivo, sans-serif';
    ctx.fillStyle = colors.textMuted;
    ctx.fillText(`(unboosted ${unboostedCombinedOdds(bet).toFixed(2)})`, contentX, y - 20);
  }

  y += 6;
  ctx.strokeStyle = colors.border;
  ctx.beginPath();
  ctx.moveTo(contentX, y);
  ctx.lineTo(contentX + contentWidth, y);
  ctx.stroke();
  y += 22;

  ctx.font = '400 11px Archivo, sans-serif';
  ctx.fillStyle = colors.textMuted;
  ctx.fillText(`Ref ${bet.id.replace(/-/g, '')}`, contentX, y);
  ctx.textAlign = 'right';
  ctx.fillText(
    new Date(bet.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    contentX + contentWidth,
    y,
  );
  ctx.textAlign = 'left';

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to encode bet image'));
      }
    }, 'image/png');
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export type ShareBetImageResult = 'shared' | 'downloaded' | 'copied' | 'unsupported';

/**
 * Renders the bet as a PNG (see renderBetCardImage) and shares it - Web
 * Share API's file support first (what most mobile share sheets expect for
 * an image), falling back to just downloading the PNG so the player can
 * still share it manually from their gallery/downloads when the browser
 * can't share files directly (most desktop browsers).
 */
export async function shareBetImage(bet: PlacedBet, shareText: string): Promise<ShareBetImageResult> {
  const blob = await renderBetCardImage(bet);
  const filename = `bet-${bet.id.slice(0, 8)}.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: shareText });
      return 'shared';
    } catch {
      // Cancelled mid-share - not an error, just don't fall through to a download the player didn't ask for twice.
      return 'shared';
    }
  }

  downloadBlob(blob, filename);
  return 'downloaded';
}
