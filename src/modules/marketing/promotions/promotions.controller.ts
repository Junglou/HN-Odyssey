import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PromotionEngineService } from './promotion-engine.service';
import { CreateComboDto } from './dto/create-combo.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { BaseResponse } from 'src/common/dtos/base-response.dto';
import { CreateFlashSaleDto } from './dto/create-flash-sale.dto';
import { FlashSalesService } from './flash-sales.service';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import type { RequestWithUser } from 'src/common/interfaces/request-with-user.interface';
import type { QueryFlashSaleDto } from './flash-sales.service';
import type { QueryCouponDto } from './coupons.service';

@Controller('promotions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PromotionsController {
  constructor(
    private readonly promotionService: PromotionEngineService,
    private readonly couponsService: CouponsService,
    private readonly flashSalesService: FlashSalesService,
  ) {}

  // API FLASH SALE
  @Post('flash-sales')
  @RequirePermissions(Resource.PROMOTIONS, Action.CREATE)
  async createFlashSale(
    @Body() dto: CreateFlashSaleDto,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.flashSalesService.createFlashSale(
      dto,
      req.user?._id,
    );
    return new BaseResponse(
      true,
      'Tạo chương trình Flash Sale thành công',
      data,
    );
  }

  @Get('flash-sales')
  @RequirePermissions(Resource.PROMOTIONS, Action.READ)
  async getAllFlashSales(@Query() query: QueryFlashSaleDto) {
    const data = await this.flashSalesService.findAll(query);
    return new BaseResponse(true, 'Lấy danh sách Flash Sale thành công', data);
  }

  @Patch('flash-sales/:id')
  @RequirePermissions(Resource.PROMOTIONS, Action.UPDATE)
  async updateFlashSale(
    @Param('id') id: string,
    @Body() dto: Partial<CreateFlashSaleDto>,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.flashSalesService.updateFlashSale(
      id,
      dto,
      req.user?._id,
    );
    return new BaseResponse(true, 'Cập nhật Flash Sale thành công', data);
  }

  // API Public cho Frontend trang chủ
  @Get('public/flash-sales/active')
  async getActiveFlashSaleForClient() {
    const data = await this.flashSalesService.getActiveFlashSales();
    return new BaseResponse(true, 'Thành công', data);
  }

  @Delete('flash-sales/:id')
  @RequirePermissions(Resource.PROMOTIONS, Action.DELETE)
  async hardDeleteFlashSale(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ) {
    const result = await this.flashSalesService.hardDeleteFlashSale(
      id,
      req.user?._id,
    );
    return new BaseResponse(true, result.message);
  }

  // API MÃ GIẢM GIÁ (COUPONS)

  @Post('coupons')
  @RequirePermissions(Resource.PROMOTIONS, Action.CREATE)
  async createCoupon(
    @Body() dto: CreateCouponDto,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.couponsService.createCoupon(dto, req.user?._id);
    return new BaseResponse(true, 'Tạo mã giảm giá thành công', data);
  }

  @Get('coupons')
  @RequirePermissions(Resource.PROMOTIONS, Action.READ)
  async getAllCoupons(@Query() query: QueryCouponDto) {
    const data = await this.couponsService.findAll(query);
    return new BaseResponse(true, 'Lấy danh sách mã giảm giá thành công', data);
  }

  @Get('coupons/:id')
  @RequirePermissions(Resource.PROMOTIONS, Action.READ)
  async getCouponDetail(@Param('id') id: string) {
    const data = await this.couponsService.findOne(id);
    return new BaseResponse(true, 'Lấy thông tin mã giảm giá thành công', data);
  }

  // API Public cho Frontend Checkout (Không cần phân quyền Admin)
  @Post('coupons/apply')
  async applyCoupon(
    @Body('code') code: string,
    @Body('cart_total') cartTotal: number,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.couponsService.applyCoupon(
      code,
      cartTotal,
      req.user?._id,
    );
    return new BaseResponse(true, 'Áp dụng mã giảm giá thành công', data);
  }

  @Patch('coupons/:id')
  @RequirePermissions(Resource.PROMOTIONS, Action.UPDATE)
  async updateCoupon(
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.couponsService.updateCoupon(id, dto, req.user?._id);
    return new BaseResponse(true, 'Cập nhật mã giảm giá thành công', data);
  }

  @Delete('coupons/:id')
  @RequirePermissions(Resource.PROMOTIONS, Action.DELETE)
  async deleteCoupon(@Param('id') id: string, @Req() req: RequestWithUser) {
    const result = await this.couponsService.softDeleteCoupon(
      id,
      req.user?._id,
    );
    return new BaseResponse(true, result.message);
  }

  //TẠO COMBO
  @Post('combos')
  @RequirePermissions(Resource.PROMOTIONS, Action.CREATE)
  async createCombo(@Body() dto: CreateComboDto) {
    return this.promotionService.createCombo(dto);
  }

  //LẤY DANH SÁCH
  @Get('combos')
  @RequirePermissions(Resource.PROMOTIONS, Action.READ)
  async getAllCombos() {
    return this.promotionService.findAllCombos();
  }
}
