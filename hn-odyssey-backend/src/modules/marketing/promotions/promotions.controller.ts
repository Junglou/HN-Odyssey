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
import { BulkPromotionStatusDto } from './dto/bulk-status.dto';
import type { RequestWithUser } from 'src/common/interfaces/request-with-user.interface';
import type { QueryFlashSaleDto } from './flash-sales.service';
import type { QueryCouponDto } from './coupons.service';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('promotions')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class PromotionsController {
  constructor(
    private readonly promotionService: PromotionEngineService,
    private readonly couponsService: CouponsService,
    private readonly flashSalesService: FlashSalesService,
  ) {}

  // API FLASH SALE
  @Post('flash-sales')
  @RequirePermissions(Resource.PROMO_FLASH_SALES, Action.CREATE)
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
  @RequirePermissions(Resource.PROMO_FLASH_SALES, Action.READ)
  async getAllFlashSales(@Query() query: QueryFlashSaleDto) {
    const data = await this.flashSalesService.findAll(query);
    return new BaseResponse(true, 'Lấy danh sách Flash Sale thành công', data);
  }

  @Patch('flash-sales/:id')
  @RequirePermissions(Resource.PROMO_FLASH_SALES, Action.UPDATE)
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
  @Public()
  @Get('public/flash-sales/active')
  async getActiveFlashSaleForClient() {
    const data = await this.flashSalesService.getActiveFlashSales();
    return new BaseResponse(true, 'Thành công', data);
  }

  @Delete('flash-sales/:id')
  @RequirePermissions(Resource.PROMO_FLASH_SALES, Action.DELETE)
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
  @RequirePermissions(Resource.PROMO_COUPONS, Action.CREATE)
  async createCoupon(
    @Body() dto: CreateCouponDto,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.couponsService.createCoupon(dto, req.user?._id);
    return new BaseResponse(true, 'Tạo mã giảm giá thành công', data);
  }

  @Get('coupons')
  @RequirePermissions(Resource.PROMO_COUPONS, Action.READ)
  async getAllCoupons(@Query() query: QueryCouponDto) {
    const data = await this.couponsService.findAll(query);
    return new BaseResponse(true, 'Lấy danh sách mã giảm giá thành công', data);
  }

  @Public()
  @Get('public/coupons/active')
  async getActiveCouponsForClient() {
    const data = await this.couponsService.findActiveCoupons();
    return new BaseResponse(true, 'Thành công', data);
  }

  @Get('coupons/:id')
  @RequirePermissions(Resource.PROMO_COUPONS, Action.READ)
  async getCouponDetail(@Param('id') id: string) {
    const data = await this.couponsService.findOne(id);
    return new BaseResponse(true, 'Lấy thông tin mã giảm giá thành công', data);
  }

  // API Public cho Frontend Checkout (Không cần phân quyền Admin)
  @Public()
  @Post('coupons/apply')
  async applyCoupon(
    @Body('code') code: string,
    @Body('cart_total') cartTotal: number,
    @Req() req: RequestWithUser,
  ) {
    try {
      const data = await this.couponsService.applyCoupon(
        code,
        cartTotal,
        req.user?._id,
      );
      return new BaseResponse(true, 'Áp dụng mã giảm giá thành công', data);
    } catch {
      return new BaseResponse(false, 'Mã giảm giá không tồn tại', null);
    }
  }

  @Patch('coupons/:id')
  @RequirePermissions(Resource.PROMO_COUPONS, Action.UPDATE)
  async updateCoupon(
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.couponsService.updateCoupon(id, dto, req.user?._id);
    return new BaseResponse(true, 'Cập nhật mã giảm giá thành công', data);
  }

  @Delete('coupons/:id')
  @RequirePermissions(Resource.PROMO_COUPONS, Action.DELETE)
  async deleteCoupon(@Param('id') id: string, @Req() req: RequestWithUser) {
    const result = await this.couponsService.softDeleteCoupon(
      id,
      req.user?._id,
    );
    return new BaseResponse(true, result.message);
  }

  // TẠO COMBO
  @Post('combos')
  @RequirePermissions(Resource.PROMO_COMBOS, Action.CREATE)
  async createCombo(@Body() dto: CreateComboDto) {
    const data = await this.promotionService.createCombo(dto);
    return new BaseResponse(true, 'Tạo Combo/Discount thành công', data);
  }

  // LẤY DANH SÁCH
  @Get('combos')
  @RequirePermissions(Resource.PROMO_COMBOS, Action.READ)
  async getAllCombos() {
    const data = await this.promotionService.findAllCombos();
    return new BaseResponse(
      true,
      'Lấy danh sách Combo/Discount thành công',
      data,
    );
  }

  // CẬP NHẬT COMBO
  @Patch('combos/:id')
  @RequirePermissions(Resource.PROMO_COMBOS, Action.UPDATE)
  async updateCombo(
    @Param('id') id: string,
    @Body() dto: Partial<CreateComboDto>,
  ) {
    const data = await this.promotionService.updateCombo(id, dto);
    return new BaseResponse(true, 'Cập nhật Combo/Discount thành công', data);
  }

  // XÓA COMBO
  @Delete('combos/:id')
  @RequirePermissions(Resource.PROMO_COMBOS, Action.DELETE)
  async deleteCombo(@Param('id') id: string) {
    const result = await this.promotionService.deleteCombo(id);
    return new BaseResponse(true, result.message);
  }

  // BULK ACTIONS - FLASH SALES

  @Patch('flash-sales/bulk/status')
  @RequirePermissions(Resource.PROMO_FLASH_SALES, Action.CHANGE_STATUS)
  async bulkUpdateFlashSaleStatus(
    @Body() body: BulkPromotionStatusDto,
    @Req() req: RequestWithUser,
  ) {
    const result = await this.flashSalesService.bulkUpdateStatus(
      body.ids,
      body.action,
      req.user?._id,
    );
    return new BaseResponse(true, result.message);
  }

  @Post('flash-sales/bulk/delete')
  @RequirePermissions(Resource.PROMO_FLASH_SALES, Action.DELETE)
  async bulkDeleteFlashSales(
    @Body() body: { ids: string[] },
    @Req() req: RequestWithUser,
  ) {
    if (body.ids && body.ids.length > 0) {
      await this.flashSalesService.bulkDelete(body.ids, req.user?._id);
    }
    return new BaseResponse(true, 'Xóa Flash Sales hàng loạt thành công');
  }

  // BULK ACTIONS - COMBOS

  @Patch('combos/bulk/status')
  @RequirePermissions(Resource.PROMO_COMBOS, Action.CHANGE_STATUS)
  async bulkUpdateComboStatus(
    @Body() body: BulkPromotionStatusDto,
    @Req() req: RequestWithUser,
  ) {
    if (body.ids && body.ids.length > 0) {
      await this.promotionService.bulkUpdateStatus(
        body.ids,
        body.action,
        req.user?._id,
      );
    }
    return new BaseResponse(
      true,
      'Cập nhật trạng thái Combos hàng loạt thành công',
    );
  }

  @Post('combos/bulk/delete')
  @RequirePermissions(Resource.PROMO_COMBOS, Action.DELETE)
  async bulkDeleteCombos(
    @Body() body: { ids: string[] },
    @Req() req: RequestWithUser,
  ) {
    if (body.ids && body.ids.length > 0) {
      await this.promotionService.bulkDelete(body.ids, req.user?._id);
    }
    return new BaseResponse(true, 'Xóa Combos hàng loạt thành công');
  }

  // BULK ACTIONS - COUPONS

  @Patch('coupons/bulk/status')
  @RequirePermissions(Resource.PROMO_COUPONS, Action.CHANGE_STATUS)
  async bulkUpdateCouponStatus(
    @Body() body: BulkPromotionStatusDto,
    @Req() req: RequestWithUser,
  ) {
    if (body.ids && body.ids.length > 0) {
      await this.couponsService.bulkUpdateStatus(
        body.ids,
        body.action,
        req.user?._id,
      );
    }
    return new BaseResponse(
      true,
      'Cập nhật trạng thái Coupons hàng loạt thành công',
    );
  }

  @Post('coupons/bulk/delete')
  @RequirePermissions(Resource.PROMO_COUPONS, Action.DELETE)
  async bulkDeleteCoupons(
    @Body() body: { ids: string[] },
    @Req() req: RequestWithUser,
  ) {
    if (body.ids && body.ids.length > 0) {
      await this.couponsService.bulkDelete(body.ids, req.user?._id);
    }
    return new BaseResponse(true, 'Xóa Coupons hàng loạt thành công');
  }
}
