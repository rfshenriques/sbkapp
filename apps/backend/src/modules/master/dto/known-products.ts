/**
 * Free-text product keys, validated here rather than as a DB enum, so
 * adding a new product doesn't require a migration - just add it here and
 * whatever creates a Brand starts sending flags for it. See BrandProductFlag
 * in schema.prisma.
 */
export const KNOWN_PRODUCTS = ['CASHOUT', 'BET_BUILDER'] as const;

export type KnownProduct = (typeof KNOWN_PRODUCTS)[number];
