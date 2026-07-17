import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('connects to the database and can round-trip a user through Postgres', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    const prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const unique = crypto.randomUUID();
    const email = `test-${unique}@example.com`;
    const created = await prisma.user.create({
      data: {
        email,
        username: `user_${unique.slice(0, 8)}`,
        phone: `+1555${unique.replace(/\D/g, '').slice(0, 7)}`,
        passwordHash: 'hashed-password',
      },
    });

    const found = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(found.email).toBe(email);

    await prisma.user.delete({ where: { id: created.id } });
    await expect(prisma.user.findUnique({ where: { id: created.id } })).resolves.toBeNull();

    await prisma.onModuleDestroy();
  });
});
