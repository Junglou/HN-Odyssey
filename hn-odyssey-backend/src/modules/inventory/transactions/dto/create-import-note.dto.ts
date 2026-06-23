import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ImportItemDto {
  @IsNotEmpty({ message: 'SKU không được để trống' })
  @IsString()
  sku: string;

  @IsOptional()
  @IsString()
  product_name?: string;

  @IsNotEmpty({ message: 'Số lượng nhập không được để trống' })
  @IsNumber({}, { message: 'Số lượng phải là một số' })
  @Min(1, { message: 'Số lượng nhập phải lớn hơn 0' })
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateImportNoteDto {
  @IsNotEmpty({ message: 'Bắt buộc chọn kho hàng' })
  @IsString()
  warehouse: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray({ message: 'Danh sách sản phẩm nhập phải là một mảng' })
  @ValidateNested({ each: true })
  @Type(() => ImportItemDto)
  @IsNotEmpty({ message: 'Phiếu nhập không được rỗng' })
  items: ImportItemDto[];
}
