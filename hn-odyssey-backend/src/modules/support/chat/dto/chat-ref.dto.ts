import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ChatRefDto {
  @IsMongoId()
  conversationId: string;

  @IsMongoId()
  productId: string;

  @IsString()
  @MaxLength(100)
  sku: string;

  @IsNumber()
  clickedAt: number;
}

// Gói sẵn decorator để create-order.dto.ts không phải import thêm gì từ class-validator
export const IsOptionalChatRef = () =>
  applyDecorators(
    IsOptional(),
    ValidateNested(),
    Type(() => ChatRefDto),
  );
