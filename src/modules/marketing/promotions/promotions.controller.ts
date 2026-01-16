import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PromotionEngineService } from './promotion-engine.service';
import { CreateComboDto } from './dto/create-combo.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';

@Controller('promotions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PromotionsController {
  constructor(private readonly promotionService: PromotionEngineService) {}

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
