import { forwardRef, Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminSeederService } from './admin-seeder.service';
import { UsersModule } from '../users.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { AuditLogsModule } from 'src/modules/system/audit-logs/audit-logs.module';
import { Role, RoleSchema } from '../roles/schemas/role.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
    MongooseModule.forFeature([{ name: Role.name, schema: RoleSchema }]),
    AuditLogsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminSeederService],
  exports: [AdminService],
})
export class AdminModule {}
