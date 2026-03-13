import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { Customer, CustomerSchema } from './customers/schemas/customer.schema';
import { Staff, StaffSchema } from './admin/schemas/staff.schema';
import { UsersService } from '../users/user.Service';
import { AdminModule } from './admin/admin.module';
import { RolesModule } from './roles/roles.module';
import { AddressesModule } from './addresses/addresses.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { CustomersModule } from './customers/customers.module';

const userModels = MongooseModule.forFeature([
  {
    name: User.name,
    schema: UserSchema,
    discriminators: [
      { name: Customer.name, schema: CustomerSchema },
      { name: Staff.name, schema: StaffSchema },
    ],
  },
]);

@Module({
  imports: [
    userModels,
    forwardRef(() => AdminModule),
    RolesModule,
    WishlistModule,
    AddressesModule,
    CustomersModule,
  ],

  providers: [UsersService],
  exports: [
    UsersService,
    userModels,
    MongooseModule,
    RolesModule,
    AddressesModule,
  ],
})
export class UsersModule {}
