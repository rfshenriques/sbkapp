import { buildMessage, isURL, ValidateBy, type ValidationOptions } from 'class-validator';

/**
 * A brand's logo*Url/appIconUrl fields are either a staff-pasted external
 * URL, or the relative path BrandsService.setLogo writes after an upload
 * ("/backend/public/brands/:id/logo/:slot", see BrandLogoSlot) - plain
 * @IsUrl() rejects that relative path since it has no scheme/host, which
 * is exactly the bug where saving any other field failed after a logo
 * upload until the logo was removed again.
 */
const OWN_LOGO_PATH = /^\/backend\/public\/brands\/[^/]+\/logo\/((SITE|SHARE)_(LIGHT|DARK)|APP_ICON)$/;

export function IsUrlOrOwnLogoPath(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isUrlOrOwnLogoPath',
      validator: {
        validate: (value: unknown): boolean =>
          typeof value === 'string' && (OWN_LOGO_PATH.test(value) || isURL(value)),
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be a URL address or an uploaded logo path`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
