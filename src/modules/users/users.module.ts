import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';

// Import các Module con
import { AdminModule } from './admin/admin.module';
import { CustomersModule } from './customers/customers.module';
import { AddressesModule } from './addresses/addresses.module';
import { WishlistModule } from './wishlist/wishlist.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    AdminModule,
    CustomersModule,
    AddressesModule,
    WishlistModule,
  ],
  controllers: [],
  providers: [],
  exports: [
    MongooseModule,
    AdminModule,
    CustomersModule,
    AddressesModule,
    WishlistModule,
  ],
})
export class UsersModule {}
