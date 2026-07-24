import ExcelJS from 'exceljs';
import type { LimitScope } from './stake-limits';

export interface StakeLimitSheetRow {
  scope: LimitScope;
  scopeValue: string;
  tier: number;
  maxStakeCents: number | null;
  maxLiabilityCents: number | null;
}

const HEADERS = ['Scope', 'Scope Value', 'Tier (0 = all)', 'Max Stake (EUR)', 'Max Liability (EUR)'];
const VALID_SCOPES: readonly LimitScope[] = ['GLOBAL', 'SPORT', 'COUNTRY', 'LEAGUE', 'MARKET'];

/** Amounts are stored as cents everywhere else in this codebase, but a trader editing this in Excel thinks in whole currency, not cents. */
export async function buildStakeLimitWorkbook(rows: StakeLimitSheetRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Stake Limits');
  sheet.addRow(HEADERS);
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow([
      row.scope,
      row.scopeValue,
      row.tier,
      row.maxStakeCents === null ? '' : row.maxStakeCents / 100,
      row.maxLiabilityCents === null ? '' : row.maxLiabilityCents / 100,
    ]);
  }

  sheet.columns.forEach((column) => {
    column.width = 24;
  });

  // exceljs's writeBuffer() resolves to its own bundled Buffer-like type,
  // structurally incompatible with Node's - re-wrapping through the
  // underlying ArrayBuffer guarantees a plain Node Buffer instead.
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as unknown as ArrayBuffer);
}

export class StakeLimitWorkbookError extends Error {}

function toCentsOrNull(raw: unknown, rowNumber: number, label: string): number | null {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new StakeLimitWorkbookError(`Row ${rowNumber}: ${label} must be a non-negative number, or blank for no cap`);
  }
  return Math.round(value * 100);
}

/**
 * Parses a re-uploaded workbook back into rows ready for
 * StakeLimitService.bulkReplace. Validates every row up front and throws
 * on the first problem found (rather than silently skipping bad rows) -
 * a trader re-uploading a file expects it to either fully apply or fully
 * fail, not partially apply.
 */
export async function parseStakeLimitWorkbook(buffer: Buffer): Promise<StakeLimitSheetRow[]> {
  const workbook = new ExcelJS.Workbook();
  // Two @types/node versions resolve in this workspace, so exceljs's bundled
  // Buffer type and Node's own Buffer<ArrayBufferLike> are structurally
  // incompatible at the type level even though they're the same class at
  // runtime - a plain type assertion is the standard escape hatch here.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new StakeLimitWorkbookError('The uploaded file has no sheets');
  }

  const rows: StakeLimitSheetRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    // ExcelJS Row#values is 1-indexed - values[0] is always empty.
    const values = row.values as unknown[];
    const scope = String(values[1] ?? '').trim().toUpperCase();
    const scopeValue = String(values[2] ?? '').trim();
    const tierRaw = values[3];
    const maxStakeRaw = values[4];
    const maxLiabilityRaw = values[5];

    const isBlankRow =
      !scope && !scopeValue && tierRaw === undefined && maxStakeRaw === undefined && maxLiabilityRaw === undefined;
    if (isBlankRow) {
      return;
    }

    if (!VALID_SCOPES.includes(scope as LimitScope)) {
      throw new StakeLimitWorkbookError(
        `Row ${rowNumber}: scope must be one of ${VALID_SCOPES.join(', ')} - got "${scope}"`,
      );
    }
    const tier = Number(tierRaw ?? 0);
    if (!Number.isInteger(tier) || tier < 0 || tier > 4) {
      throw new StakeLimitWorkbookError(`Row ${rowNumber}: tier must be a whole number 0-4`);
    }
    if (scope !== 'GLOBAL' && !scopeValue) {
      throw new StakeLimitWorkbookError(`Row ${rowNumber}: scope value is required for scope ${scope}`);
    }

    rows.push({
      scope: scope as LimitScope,
      scopeValue: scope === 'GLOBAL' ? '' : scopeValue,
      tier,
      maxStakeCents: toCentsOrNull(maxStakeRaw, rowNumber, 'Max Stake'),
      maxLiabilityCents: toCentsOrNull(maxLiabilityRaw, rowNumber, 'Max Liability'),
    });
  });

  return rows;
}
