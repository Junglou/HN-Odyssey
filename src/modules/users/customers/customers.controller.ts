import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Customers (Khách hàng)')
@Controller('users/customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post('convert-guest')
  @Public()
  @ApiOperation({ summary: 'Chuyển đổi Guest thành Member từ đơn hàng' })
  async convertGuestToMember(
    @Body() body: { orderId: string; password: string },
  ) {
    return this.customersService.convertGuestToMember(
      body.orderId,
      body.password,
    );
  }
}
