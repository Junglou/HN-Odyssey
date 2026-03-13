import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ToggleWishlistDto } from './dto/toggle-wishlist.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from 'src/common/enums/role.enum';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Wishlist (Danh sách yêu thích)')
@Controller('users/wishlist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
@ApiBearerAuth()
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({
    summary: 'AC4, AC5: Xem danh sách yêu thích (Cập nhật realtime)',
  })
  async getWishlist(@CurrentUser('_id') userId: string) {
    return this.wishlistService.getWishlist(userId);
  }

  @Post('toggle')
  @ApiOperation({ summary: 'AC2, AC3, AC6: Thêm / Bỏ sản phẩm khỏi Wishlist' })
  async toggleWishlist(
    @CurrentUser('_id') userId: string,
    @Body() dto: ToggleWishlistDto,
  ) {
    return this.wishlistService.toggleWishlist(
      userId,
      dto.productId,
      dto.variantId,
    );
  }
}
