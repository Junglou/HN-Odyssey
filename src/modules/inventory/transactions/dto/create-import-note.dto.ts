import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class ImportItemDto {
  @IsNotEmpty({ message: 'product_id không được để trống' })
  @IsString()
  product_id: string;

  // AC2: Bắt buộc phải truyền SKU (Để biết chính xác là biến thể nào)
  @IsNotEmpty({ message: 'SKU không được để trống' })
  @IsString()
  sku: string;

  // AC3: Số lượng phải là số nguyên dương lớn hơn 0
  @IsNotEmpty({ message: 'Số lượng nhập không được để trống' })
  @IsNumber({}, { message: 'Số lượng phải là một số' })
  @Min(1, { message: 'Số lượng nhập phải lớn hơn 0' })
  quantity: number;
}

export class CreateImportNoteDto {
  // AC6: Bắt buộc nhập Ghi chú
  @ValidateIf((o: CreateImportNoteDto) => !o.reference_code)
  @IsNotEmpty({ message: 'Bắt buộc phải nhập ghi chú hoặc mã tham chiếu' })
  @IsString()
  note?: string;

  @ValidateIf((o: CreateImportNoteDto) => !o.note)
  @IsNotEmpty({ message: 'Bắt buộc phải nhập ghi chú hoặc mã tham chiếu' })
  @IsString()
  reference_code?: string;

  // AC4: Phiếu nhập đa dòng
  @IsArray({ message: 'Danh sách sản phẩm nhập phải là một mảng' })
  @ValidateNested({ each: true })
  @Type(() => ImportItemDto)
  @IsNotEmpty({ message: 'Phiếu nhập không được rỗng' })
  items: ImportItemDto[];

  @IsOptional() @IsString() file_name?: string;
}
