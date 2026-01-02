import { IsString, IsOptional, MinLength } from 'class-validator';

export class SearchSuggestionDto {
  @IsOptional()
  @IsString()
  keyword: string;

  @IsOptional()
  deviceId: string;
}
