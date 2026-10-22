import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { AUDIT_LOG_VIEWS } from 'src/common/constants/audit-log-views.constant';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @RequirePermissions(Resource.SYSTEM_AUDIT, Action.READ)
  async getAuditLogs(@Query() query: QueryAuditLogDto) {
    return this.auditLogsService.findAll(query);
  }

  // Danh sách MongoDB View theo phòng ban (dùng cho dropdown lọc)
  @Get('views')
  @RequirePermissions(Resource.SYSTEM_AUDIT, Action.READ)
  getAuditViews() {
    return {
      data: AUDIT_LOG_VIEWS.map((v) => ({
        department: v.department,
        label: v.label,
        view: v.name,
      })),
    };
  }
}
