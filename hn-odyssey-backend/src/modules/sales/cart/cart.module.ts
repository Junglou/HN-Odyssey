import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { Cart, CartSchema } from './schemas/cart.schema';
import {
  Product,
  ProductSchema,
} from 'src/modules/products/catalog/schemas/product.schema';
import { AuditLogsModule } from 'src/modules/system/audit-logs/audit-logs.module';
import { PromotionsModule } from '../../marketing/promotions/promotions.module';
import { ShippingModule } from 'src/modules/shipping/shipping.module';
import { UserSchema } from 'src/modules/users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cart.name, schema: CartSchema },
      { name: Product.name, schema: ProductSchema },
      { name: 'User', schema: UserSchema },
    ]),
    AuditLogsModule,
    PromotionsModule,
    forwardRef(() => ShippingModule), // Bọc module bằng forwardRef để tránh lỗi phụ thuộc vòng
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService, MongooseModule],
})
export class CartModule {}
