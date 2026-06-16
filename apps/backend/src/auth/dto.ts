import { IsIn, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

export class RequestOtpDto {
  // E.164-ish; Indian numbers. Keep validation forgiving but present.
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'phone must be 10-15 digits' })
  phone!: string;
}

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/)
  phone!: string;

  @IsString()
  @Length(6, 6, { message: 'code must be 6 digits' })
  code!: string;
}

export class SelectRoleDto {
  @IsIn(['worker', 'giver'])
  role!: 'worker' | 'giver';

  @IsString()
  @MinLength(2)
  displayName!: string;
}

export class UpdateWorkerProfileDto {
  @IsOptional() @IsString() bioMl?: string;
  @IsOptional() @IsString() bioEn?: string;
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() skills?: string[];
  @IsOptional() categoryIds?: string[];
  @IsOptional() @IsString() serviceAreaLabel?: string;
}
