import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { PlaceBetDto } from './dto/place-bet.dto';

@Injectable()
export class PamService {
  constructor(private readonly prisma: PrismaService) {}

  async getWallet(userId: string): Promise<{ balanceCents: number }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { balanceCents: user.balanceCents };
  }

  async placeBet(userId: string, dto: PlaceBetDto) {
    const combinedOdds = dto.selections.reduce((total, selection) => total * selection.odds, 1);
    const potentialPayoutCents = Math.round(dto.stakeCents * combinedOdds);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.balanceCents < dto.stakeCents) {
        throw new BadRequestException('Insufficient balance');
      }

      await tx.user.update({
        where: { id: userId },
        data: { balanceCents: { decrement: dto.stakeCents } },
      });

      return tx.bet.create({
        data: {
          userId,
          stakeCents: dto.stakeCents,
          combinedOdds,
          potentialPayoutCents,
          selections: {
            create: dto.selections.map((selection) => ({
              matchId: selection.matchId,
              marketId: selection.marketId,
              selectionId: selection.selectionId,
              matchLabel: selection.matchLabel,
              marketName: selection.marketName,
              selectionName: selection.selectionName,
              odds: selection.odds,
            })),
          },
        },
        include: { selections: true },
      });
    });
  }

  async getBets(userId: string) {
    return this.prisma.bet.findMany({
      where: { userId },
      include: { selections: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
