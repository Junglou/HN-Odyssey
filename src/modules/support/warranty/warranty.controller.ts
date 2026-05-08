import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { WarrantyService } from './warranty.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Resource, Action } from 'src/common/enums/resource.enum';
import { ClaimStatus } from './schemas/warranty-claim.schema';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@Controller('warranty')
export class WarrantyController {
  constructor(private readonly warrantyService: WarrantyService) {}

  //  AC2: TRA CỨU PUBLIC (GUEST)
  @Get('lookup')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async guestLookup(
    @Query('order_code') orderCode: string,
    @Query('phone') phone: string,
  ) {
    return this.warrantyService.guestLookup(orderCode, phone);
  }

  //  AC4: GỬI YÊU CẦU BẢO HÀNH (RMA)
  @Post('claim')
  @UseGuards(JwtAuthGuard)
  async submitClaim(
    @Body('warranty_item_id') warrantyItemId: string,
    @Body('reason') reason: string,
    @Body('images') images: string[],
  ) {
    return this.warrantyService.submitClaim(warrantyItemId, reason, images);
  }

  //  AC8 & AC10: ADMIN CẬP NHẬT TRẠNG THÁI
  @Patch('admin/claim/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.WARRANTY, Action.UPDATE)
  async updateClaimStatus(
    @Param('id') claimId: string,
    // FIX: Sửa kiểu dữ liệu từ string thành ClaimStatus
    @Body('status') status: ClaimStatus,
    @Body('note') note: string,
    @Body('is_exchange') isExchange: boolean, // Có đổi mới 1-1 hay không
  ) {
    return this.warrantyService.updateClaimStatus(
      claimId,
      status,
      note,
      isExchange,
    );
  }
}
