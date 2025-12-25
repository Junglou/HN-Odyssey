import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Verification, VerificationSchema } from './schema/verification.schema';
import { UsersModule } from '../users/users.module';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  RecoveryRequest,
  RecoveryRequestSchema,
} from './schema/recovery-request.schema';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import {
  AuditLog,
  AuditLogSchema,
} from '../system/audit-logs/schemas/audit-log.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { Role, RoleSchema } from '../users/roles/schemas/role.schema';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: Verification.name, schema: VerificationSchema },
      { name: RecoveryRequest.name, schema: RecoveryRequestSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: Role.name, schema: RoleSchema },
    ]), // 2. Cấu hình JWT (Token) sử dụng registerAsync
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        global: true,
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    GoogleStrategy,
    FacebookStrategy,
    JwtRefreshStrategy,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
