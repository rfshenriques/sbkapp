import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';

/**
 * Real, well-known colors for teams already seen in the odds feed as of this
 * feature's launch - hand-picked from each club/country's actual branding,
 * not guessed. Applied once at startup via an idempotent upsert (only fills
 * in a null colorHex, never overwrites an admin's own edit) so the backoffice
 * doesn't start out with a wall of blank swatches for teams we already know.
 */
const KNOWN_TEAM_COLORS: Record<string, string> = {
  Arsenal: '#EF0107',
  Chelsea: '#034694',
  'Real Madrid': '#FEBE10',
  Barcelona: '#A50044',
  'Leeds United': '#1D4289',
  'Norwich City': '#FFF200',
  'Boston Bruins': '#FFB81C',
  'NY Rangers': '#0038A8',
  'New England Patriots': '#002244',
  'NY Jets': '#125740',
  'LA Lakers': '#552583',
  'Boston Celtics': '#007A33',
  Spain: '#C60B1E',
  Argentina: '#75AADB',
};

@Injectable()
export class TeamColorsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async onModuleInit() {
    for (const [name, colorHex] of Object.entries(KNOWN_TEAM_COLORS)) {
      const existing = await this.prisma.teamColor.findUnique({ where: { name } });
      if (!existing) {
        await this.prisma.teamColor.create({ data: { name, colorHex } });
      } else if (!existing.colorHex) {
        await this.prisma.teamColor.update({ where: { name }, data: { colorHex } });
      }
    }
  }

  async list() {
    return this.prisma.teamColor.findMany({ orderBy: { name: 'asc' } });
  }

  async listAssigned() {
    return this.prisma.teamColor.findMany({
      where: { OR: [{ colorHex: { not: null } }, { acronym: { not: null } }] },
      orderBy: { name: 'asc' },
    });
  }

  /** Only inserts names not already known - existing rows (and any colorHex already set on them) are left untouched. */
  async syncNames(names: string[]) {
    const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
    const existing = await this.prisma.teamColor.findMany({
      where: { name: { in: uniqueNames } },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((row) => row.name));
    const newNames = uniqueNames.filter((name) => !existingNames.has(name));

    if (newNames.length > 0) {
      await this.prisma.teamColor.createMany({
        data: newNames.map((name) => ({ name })),
        skipDuplicates: true,
      });
    }

    return this.list();
  }

  async setColor(id: string, fields: { colorHex?: string | null; acronym?: string | null }, actor: AuditActor) {
    const existing = await this.prisma.teamColor.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Team color not found');
    }

    const teamColor = await this.prisma.teamColor.update({
      where: { id },
      data: {
        ...(fields.colorHex !== undefined && { colorHex: fields.colorHex }),
        ...(fields.acronym !== undefined && { acronym: fields.acronym }),
      },
    });

    await this.auditLogService.record({
      actor,
      action: 'TEAM_COLOR_SET',
      targetType: 'TeamColor',
      targetId: teamColor.id,
      metadata: { name: teamColor.name, colorHex: teamColor.colorHex, acronym: teamColor.acronym },
    });

    return teamColor;
  }
}
