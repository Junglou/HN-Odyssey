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

export class ExportItemDto {
  @IsNotEmpty({ message: 'SKU không được để trống' })
  @IsString()
  sku: string;

  @IsOptional()
  @IsString()
  product_name?: string;

  @IsNotEmpty({ message: 'Số lượng xuất không được để trống' })
  @IsNumber({}, { message: 'Số lượng phải là một số' })
  @Min(1, { message: 'Số lượng xuất phải lớn hơn 0' })
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateExportNoteDto {
  @IsNotEmpty({ message: 'Bắt buộc chọn kho hàng' })
  @IsString()
  warehouse: string;

  @IsNotEmpty({ message: 'Bắt buộc nhập lý do xuất' })
  @IsString()
  exportReason: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray({ message: 'Danh sách sản phẩm xuất phải là một mảng' })
  @ValidateNested({ each: true })
  @Type(() => ExportItemDto)
  @IsNotEmpty({ message: 'Phiếu xuất không được rỗng' })
  items: ExportItemDto[];
}
