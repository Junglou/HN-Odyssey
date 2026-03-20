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
  @IsNotEmpty({ message: 'product_id không được để trống' })
  @IsString()
  product_id: string;

  // AC4: Bắt buộc chọn biến thể (SKU)
  @IsNotEmpty({ message: 'SKU không được để trống' })
  @IsString()
  sku: string;

  // AC3: Số lượng dương
  @IsNotEmpty({ message: 'Số lượng xuất không được để trống' })
  @IsNumber({}, { message: 'Số lượng phải là một số' })
  @Min(1, { message: 'Số lượng xuất phải lớn hơn 0' })
  quantity: number;
}

export class CreateExportNoteDto {
  // AC3: Bắt buộc nhập lý do xuất
  @IsNotEmpty({
    message: 'Bắt buộc phải nhập lý do xuất kho (ví dụ: Xuất hủy, Xuất mẫu)',
  })
  @IsString()
  note: string;

  @IsOptional()
  @IsString()
  reference_code?: string;

  @IsArray({ message: 'Danh sách sản phẩm xuất phải là một mảng' })
  @ValidateNested({ each: true })
  @Type(() => ExportItemDto)
  @IsNotEmpty({ message: 'Phiếu xuất không được rỗng' })
  items: ExportItemDto[];

  @IsOptional() @IsString() file_name?: string;
}
