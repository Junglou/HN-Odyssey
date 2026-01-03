import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Department } from 'src/common/enums/department.enum';

@Injectable()
export class AuditLogsViewSetup implements OnModuleInit {
  private readonly logger = new Logger(AuditLogsViewSetup.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleInit() {
    await this.createViews();
  }

  private async createViews() {
    // 1. Lấy instance native của MongoDB
    const db = this.connection.db;

    // Kiểm tra kỹ: Nếu chưa có kết nối DB thì báo lỗi và dừng lại
    if (!db) {
      this.logger.error(
        'CRITICAL: Database connection not established. Cannot create Audit Log Views.',
      );
      return;
    }

    const mainCollection = 'audit_logs';
    const viewsToCreate = [
      {
        name: 'view_audit_management', 
        department: Department.MANAGEMENT,
      },
      {
        name: 'view_audit_sales',
        department: Department.SALES,
      },
      {
        name: 'view_audit_warehouse',
        department: Department.WAREHOUSE,
      },
      {
        name: 'view_audit_marketing',
        department: Department.MARKETING,
      },
      {
        name: 'view_audit_accounting', 
        department: Department.ACCOUNTING,
      },
      {
        name: 'view_audit_support',
        department: Department.SUPPORT,
      },
    ];

    try {
      const existingCollections = await db.listCollections().toArray();
      const existingNames = existingCollections.map((c) => c.name);

      for (const view of viewsToCreate) {
        if (!existingNames.includes(view.name)) {
          try {
            // Lệnh tạo View trong MongoDB
            await db.createCollection(view.name, {
              viewOn: mainCollection, // Dựa trên bảng chính audit_logs
              pipeline: [
                {
                  $match: {
                    department: view.department, // Lọc theo bộ phận
                  },
                },
                {
                  $project: {
                    _id: 1,
                    action: 1,
                    collection_name: 1,
                    actor_id: 1,
                    actor_employee_code: 1,
                    actor_email: 1,
                    target_id: 1,
                    detail: 1,
                    is_success: 1,
                    error_reason: 1,
                    ip: 1,
                    user_agent: 1,
                    department: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    __v: 1,
                  },
                },
              ],
            });
            this.logger.log(`[DB VIEW] Đã tạo View: ${view.name}`);
          } catch (error) {
            this.logger.error(`Lỗi tạo view ${view.name}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Lỗi khi setup Views: ${error.message}`);
    }
  }
}
