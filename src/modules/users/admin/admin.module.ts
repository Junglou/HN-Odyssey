import { forwardRef, Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminSeederService } from './admin-seeder.service';
import { UsersModule } from '../users.module';
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
  imports: [forwardRef(() => UsersModule), forwardRef(() => AuthModule)],
  controllers: [AdminController],
  providers: [AdminService, AdminSeederService],
  exports: [AdminService],
})
export class AdminModule {}
