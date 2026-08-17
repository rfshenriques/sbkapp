import { buildMessage, ValidateBy, type ValidationOptions } from 'class-validator';
import { isColorZone } from './brand-color';

/** Validates the { light, dark } color-zone JSON shape (see brand-color.ts) on an UpdateBrandDto/CreateBrandDto field. */
export function IsColorZone(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isColorZone',
      validator: {
        validate: (value: unknown): boolean => isColorZone(value),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must have light and dark values, each either a solid hex or a gradient`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
