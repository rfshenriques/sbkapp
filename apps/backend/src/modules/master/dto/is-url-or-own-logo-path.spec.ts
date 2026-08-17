import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateBrandDto } from './create-brand.dto';

describe('IsUrlOrOwnLogoPath (via UpdateBrandDto)', () => {
  it('accepts the relative path BrandsService.setLogo stores after an upload', async () => {
    const dto = Object.assign(new UpdateBrandDto(), {
      name: 'Renamed Brand',
      logoLightUrl: '/backend/public/brands/brand-1/logo/SITE_LIGHT',
    });

    expect(await validate(dto)).toEqual([]);
  });

  it('accepts every logo slot path', async () => {
    for (const slot of ['SITE_LIGHT', 'SITE_DARK', 'SHARE_LIGHT', 'SHARE_DARK']) {
      const dto = Object.assign(new UpdateBrandDto(), {
        logoLightUrl: `/backend/public/brands/brand-1/logo/${slot}`,
      });
      expect(await validate(dto)).toEqual([]);
    }
  });

  it('accepts a plain external URL', async () => {
    const dto = Object.assign(new UpdateBrandDto(), { logoLightUrl: 'https://example.com/logo.png' });
    expect(await validate(dto)).toEqual([]);
  });

  it('accepts a logo field being entirely absent', async () => {
    const dto = Object.assign(new UpdateBrandDto(), { name: 'Renamed Brand' });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects a value that is neither a URL nor our own logo path', async () => {
    const dto = Object.assign(new UpdateBrandDto(), { logoLightUrl: 'not a url at all' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.property).toBe('logoLightUrl');
  });
});
