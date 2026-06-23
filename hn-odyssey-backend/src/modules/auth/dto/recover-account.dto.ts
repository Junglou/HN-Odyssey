import { IsNotEmpty, IsString, MinLength, IsEmail } from 'class-validator';

export class RecoverAccountDto {
  @IsString()
  @IsNotEmpty()
  account: string;

  @IsString()
  @IsNotEmpty()
  code: string; // Token

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  confirmNewPassword: string;

  @IsEmail()
  @IsNotEmpty()
  newEmail: string;
}
