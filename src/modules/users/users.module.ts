import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { Customer, CustomerSchema } from './customers/schemas/customer.schema';
import { Staff, StaffSchema } from './admin/schemas/staff.schema';
import { UsersService } from '../users/user.Service';
import { AdminModule } from './admin/admin.module';
import { RolesModule } from './roles/roles.module';

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
  imports: [userModels, forwardRef(() => AdminModule), RolesModule],

  providers: [UsersService],
  exports: [UsersService, userModels, MongooseModule, RolesModule],
})
export class UsersModule {}
