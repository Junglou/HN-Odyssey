import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { RedeemRewardDto, QueryLoyaltyHistoryDto } from './dto/loyalty.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

interface RequestUser {
  _id: string;
  email: string;
  roles: string[];
}

@Controller('loyalty')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('my-info')
  @Roles(Role.CUSTOMER)
  async getMyInfo(@CurrentUser() user: RequestUser) {
    return this.loyaltyService.getMyLoyaltyInfo(user._id);
  }

  @Get('estimate-checkout')
  @Roles(Role.CUSTOMER)
  async estimateCheckoutPoints(
    @CurrentUser() user: RequestUser,
    @Query('amount') amount: string,
  ) {
    return this.loyaltyService.estimateCheckoutPoints(user._id, Number(amount));
  }

  @Get('history')
  @Roles(Role.CUSTOMER)
  async getMyHistory(
    @CurrentUser() user: RequestUser,
    @Query() query: QueryLoyaltyHistoryDto,
  ) {
    return this.loyaltyService.getHistory(user._id, query);
  }

  @Post('redeem')
  @Roles(Role.CUSTOMER)
  async redeemPoints(
    @CurrentUser() user: RequestUser,
    @Body() dto: RedeemRewardDto,
  ) {
    return this.loyaltyService.redeemPoints(user._id, dto);
  }
}
