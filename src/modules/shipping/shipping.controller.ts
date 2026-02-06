import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';
import { Public } from 'src/common/decorators/public.decorator';
import { CalculateShippingFeeDto } from './dto/calculate-fee.dto';
import { CartItem, OrderItem } from 'src/common/interfaces/oder.interface';

@ApiTags('Shipping (Vận chuyển)')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('calculate')
  @Public() // Cho phép Guest check phí ship
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tính phí vận chuyển (Ước tính)' })
  @ApiResponse({
    status: 200,
    description: 'Trả về số tiền phí vận chuyển (VNĐ)',
    type: Number,
  })
  async calculateFee(@Body() dto: CalculateShippingFeeDto) {
    // Ép kiểu items từ DTO sang interface mà Service yêu cầu
    // (Service chỉ cần quantity và weight nên items từ DTO là đủ)
    const fee = await this.shippingService.calculateShippingFee(
      dto.cityCode,
      dto.districtCode,
      dto.items as (CartItem | OrderItem)[],
      dto.isInstant,
    );

    return {
      shipping_fee: fee,
      currency: 'VND',
    };
  }
}
