import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
  Ip,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { UserAgent } from '../../../common/decorators/user-agent.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { IUser } from '../../../common/interfaces/user.interface';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-auth.guard';
import { BuyNowDto } from './dto/buy-now.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: IUser | null,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    const userId = user ? user._id : null;
    return this.ordersService.createOrder(userId, dto, ip, userAgent);
  }

  // API dành cho Admin/Shipper
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    return this.ordersService.updateStatus(id, status, user._id, ip, userAgent);
  }

  @Public()
  @Post('test/init-buy-now')
  async initBuyNow(@Body() body: BuyNowDto) {
    return this.ordersService.createBuyNowSession(body);
  }
}
