import { describe, expect, it } from 'vitest';
import {
  buildStakeLimitWorkbook,
  parseStakeLimitWorkbook,
  StakeLimitWorkbookError,
  type StakeLimitSheetRow,
} from './stake-limit-workbook';

describe('stake limit workbook', () => {
  it('round-trips rows through build then parse', async () => {
    const rows: StakeLimitSheetRow[] = [
      { scope: 'GLOBAL', scopeValue: '', tier: 0, maxStakeCents: 100_000, maxLiabilityCents: 500_000 },
      { scope: 'SPORT', scopeValue: 'Football', tier: 1, maxStakeCents: 50_000, maxLiabilityCents: null },
      { scope: 'MARKET', scopeValue: 'Match Result', tier: 0, maxStakeCents: null, maxLiabilityCents: 20_000 },
    ];

    const buffer = await buildStakeLimitWorkbook(rows);
    const parsed = await parseStakeLimitWorkbook(buffer);

    expect(parsed).toEqual(rows);
  });

  it('skips fully blank rows', async () => {
    const buffer = await buildStakeLimitWorkbook([
      { scope: 'GLOBAL', scopeValue: '', tier: 0, maxStakeCents: 100_000, maxLiabilityCents: null },
    ]);
    const parsed = await parseStakeLimitWorkbook(buffer);
    expect(parsed).toHaveLength(1);
  });

  it('converts EUR amounts to cents', async () => {
    const buffer = await buildStakeLimitWorkbook([
      { scope: 'GLOBAL', scopeValue: '', tier: 0, maxStakeCents: 1_234, maxLiabilityCents: null },
    ]);
    const parsed = await parseStakeLimitWorkbook(buffer);
    expect(parsed[0]?.maxStakeCents).toBe(1_234);
  });

  it('rejects an invalid scope', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Stake Limits');
    sheet.addRow(['Scope', 'Scope Value', 'Tier (0 = all)', 'Max Stake (EUR)', 'Max Liability (EUR)']);
    sheet.addRow(['PLANET', 'Football', 0, 100, '']);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await expect(parseStakeLimitWorkbook(buffer)).rejects.toThrow(StakeLimitWorkbookError);
  });

  it('rejects a non-GLOBAL row missing a scope value', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Stake Limits');
    sheet.addRow(['Scope', 'Scope Value', 'Tier (0 = all)', 'Max Stake (EUR)', 'Max Liability (EUR)']);
    sheet.addRow(['SPORT', '', 0, 100, '']);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await expect(parseStakeLimitWorkbook(buffer)).rejects.toThrow(/scope value is required/);
  });

  it('rejects a negative amount', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Stake Limits');
    sheet.addRow(['Scope', 'Scope Value', 'Tier (0 = all)', 'Max Stake (EUR)', 'Max Liability (EUR)']);
    sheet.addRow(['GLOBAL', '', 0, -50, '']);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await expect(parseStakeLimitWorkbook(buffer)).rejects.toThrow(/must be a non-negative number/);
  });

  it('rejects a tier outside 0-4', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Stake Limits');
    sheet.addRow(['Scope', 'Scope Value', 'Tier (0 = all)', 'Max Stake (EUR)', 'Max Liability (EUR)']);
    sheet.addRow(['GLOBAL', '', 9, 100, '']);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await expect(parseStakeLimitWorkbook(buffer)).rejects.toThrow(/tier must be a whole number/);
  });
});
