import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { Role, RoleSchema } from 'src/modules/users/roles/schemas/role.schema';
import { User, UserSchema } from 'src/modules/users/schemas/user.schema';
import { AuditLogsViewSetup } from './audit-logs-view.setup';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: Role.name, schema: RoleSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AuditLogsController],
  providers: [AuditLogsService, AuditLogsViewSetup],
  exports: [AuditLogsService, MongooseModule],
})
export class AuditLogsModule {}
