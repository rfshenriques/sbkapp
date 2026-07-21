import { IsEmail, IsOptional, IsPhoneNumber, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  /**
   * Which brand this player is joining. Required because there's no
   * domain-based tenant resolution yet (see PROJECT_BRIEF.md Section 10) -
   * once that exists, this can be inferred from the request's hostname
   * instead of the client having to send it explicitly.
   */
  @IsString()
  brandId!: string;

  @IsEmail()
  email!: string;

  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message: 'Username must be 3-20 characters: letters, numbers, or underscores only',
  })
  username!: string;

  @IsPhoneNumber(undefined, {
    message: 'Phone must be a valid international number, e.g. +15551234567',
  })
  phone!: string;

  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;

  /**
   * Marketing attribution, captured client-side on the register page's
   * first mount (see the frontend's RegisterPage) - all optional since
   * a direct visit has no referrer or UTM params to send.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  referrerUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  utmSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  utmMedium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  utmCampaign?: string;
}
