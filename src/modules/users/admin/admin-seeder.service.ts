import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Staff } from 'src/modules/users/admin/schemas/staff.schema';
import { Role } from 'src/modules/users/roles/schemas/role.schema';
import { UserStatus } from 'src/common/enums/user-status.enum';
import { Resource, Action } from 'src/common/enums/resource.enum';
import { Department } from 'src/common/enums/department.enum';
import { RoleLevel } from 'src/common/enums/role-level.enum';

@Injectable()
export class AdminSeederService implements OnModuleInit {
  private readonly logger = new Logger(AdminSeederService.name);

  constructor(
    @InjectModel(Staff.name) private readonly staffModel: Model<Staff>,
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
  ) {}

  async onModuleInit() {
    await this.seedRoles();
    await this.seedStaffs();
  }

  // 1. TẠO CÁC ROLE MẪU
  private async seedRoles() {
    const roles = [
      {
        name: 'Super Admin',
        slug: 'SUPER_ADMIN',
        description: 'Quản trị viên tối cao (Full quyền hệ thống)',
        level: RoleLevel.BOARD,
        is_active: true,
        is_system: true,
        permissions: [
          { resource: Resource.SYSTEM, actions: [Action.MANAGE] },
          { resource: Resource.USERS, actions: [Action.MANAGE] },
          { resource: Resource.ROLES, actions: [Action.MANAGE] },
          {
            resource: Resource.AUDIT_LOGS,
            actions: [Action.READ, Action.EXPORT],
          },
        ],
      },
      {
        name: 'Trưởng kho (Warehouse Manager)',
        slug: 'WAREHOUSE_MANAGER',
        description:
          'Quản lý tồn kho, nhập xuất và nhà cung cấp (Không sửa thông tin sản phẩm)',
        level: RoleLevel.MANAGEMENT,
        is_active: true,
        permissions: [
          { resource: Resource.PRODUCTS, actions: [Action.READ] },
          { resource: Resource.CATEGORIES, actions: [Action.READ] },
          { resource: Resource.INVENTORY, actions: [Action.MANAGE] },
          { resource: Resource.TRANSFERS, actions: [Action.MANAGE] },
          { resource: Resource.SUPPLIERS, actions: [Action.MANAGE] },
          { resource: Resource.SHIPPING, actions: [Action.MANAGE] },
        ],
      },
      {
        name: 'Marketing Leader',
        slug: 'MARKETING_LEADER',
        description: 'Quản lý Catalog sản phẩm, chiến dịch và nội dung',
        level: RoleLevel.MANAGEMENT,
        is_active: true,
        permissions: [
          { resource: Resource.PRODUCTS, actions: [Action.MANAGE] },
          { resource: Resource.CATEGORIES, actions: [Action.MANAGE] },
          { resource: Resource.ATTRIBUTES, actions: [Action.MANAGE] },
          { resource: Resource.PROMOTIONS, actions: [Action.MANAGE] },
          { resource: Resource.BLOG, actions: [Action.MANAGE] },
          { resource: Resource.NOTIFICATIONS, actions: [Action.MANAGE] },
          { resource: Resource.LOYALTY, actions: [Action.MANAGE] },
        ],
      },
      {
        name: 'Nhân viên bán hàng (Sales Staff)',
        slug: 'SALES_STAFF',
        description: 'Xử lý đơn hàng, đổi trả và tư vấn khách hàng',
        level: RoleLevel.STAFF,
        is_active: true,
        permissions: [
          { resource: Resource.PRODUCTS, actions: [Action.READ] },
          { resource: Resource.INVENTORY, actions: [Action.READ] },
          {
            resource: Resource.ORDERS,
            actions: [
              Action.READ,
              Action.UPDATE,
              Action.APPROVE,
              Action.CANCEL,
            ],
          },
          {
            resource: Resource.RETURNS,
            actions: [Action.READ, Action.UPDATE, Action.APPROVE],
          },
          {
            resource: Resource.TRADE_IN,
            actions: [Action.READ, Action.UPDATE, Action.APPROVE],
          },
          {
            resource: Resource.CUSTOMERS,
            actions: [Action.READ, Action.CREATE, Action.UPDATE],
          },
        ],
      },
      {
        name: 'CSKH (Support)',
        slug: 'SUPPORT_STAFF',
        description: 'Hỗ trợ khách hàng qua Chat và Bảo hành',
        level: RoleLevel.STAFF,
        is_active: true,
        permissions: [
          { resource: Resource.SUPPORT, actions: [Action.MANAGE] },
          {
            resource: Resource.WARRANTY,
            actions: [Action.READ, Action.CREATE, Action.UPDATE],
          },
          {
            resource: Resource.REVIEWS,
            actions: [Action.READ, Action.APPROVE, Action.DELETE],
          },
          { resource: Resource.ORDERS, actions: [Action.READ] },
        ],
      },
      {
        name: 'Kế toán (Accountant)',
        slug: 'ACCOUNTANT',
        description: 'Xem báo cáo doanh thu và đối soát',
        level: RoleLevel.STAFF,
        is_active: true,
        permissions: [
          { resource: Resource.ORDERS, actions: [Action.READ] },
          {
            resource: Resource.REPORTS,
            actions: [Action.READ, Action.EXPORT],
          },
          {
            resource: Resource.PAYMENT,
            actions: [Action.READ, Action.EXPORT],
          },
          { resource: Resource.DASHBOARD, actions: [Action.READ] },
        ],
      },
    ];

    for (const role of roles) {
      await this.roleModel.updateOne(
        { slug: role.slug },
        { $set: role },
        { upsert: true },
      );
      this.logger.log(`[SEED] Synced Role: ${role.name}`);
    }
  }

  // 2. TẠO NHÂN VIÊN MẪU
  private async seedStaffs() {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('HnOdyssey@2025', salt);

    const staffs = [
      {
        email: 'admin@hnodyssey.com',
        firstName: 'Admin',
        lastName: 'System',
        phone: '0909000001',
        department: Department.MANAGEMENT,
        roles: ['SUPER_ADMIN'],
        employee_code: 'SA-1-1-0000',
      },
      {
        email: 'kho.truong@hnodyssey.com',
        firstName: 'Văn Kho',
        lastName: 'Nguyễn',
        phone: '0909000003',
        department: Department.WAREHOUSE,
        roles: ['WAREHOUSE_MANAGER'],
        employee_code: 'NVK-3-2-0000',
      },
      {
        email: 'sales.lead@hnodyssey.com',
        firstName: 'Doanh Số',
        lastName: 'Phạm',
        phone: '0909000005',
        department: Department.SALES,
        roles: ['SALES_STAFF'],
        employee_code: 'PDS-2-3-0000',
      },
      {
        email: 'mkt.lead@hnodyssey.com',
        firstName: 'Sáng Tạo',
        lastName: 'Vũ',
        phone: '0909000007',
        department: Department.MARKETING,
        roles: ['MARKETING_LEADER'],
        employee_code: 'VST-4-2-0000',
      },
      {
        email: 'support.01@hnodyssey.com',
        firstName: 'Thân Thiện',
        lastName: 'Hoàng',
        phone: '0909000008',
        department: Department.SUPPORT,
        roles: ['SUPPORT_STAFF'],
        employee_code: 'HTT-6-3-0000',
      },
      {
        email: 'ketoan@hnodyssey.com',
        firstName: 'Thủ Quỹ',
        lastName: 'Trịnh',
        phone: '0909000009',
        department: Department.ACCOUNTING,
        roles: ['ACCOUNTANT'],
        employee_code: 'TTQ-5-3-0000',
      },
    ];

    for (const s of staffs) {
      const exists = await this.staffModel.findOne({ email: s.email });
      if (!exists) {
        await this.staffModel.create({
          ...s,
          first_Name: s.firstName,
          last_Name: s.lastName,
          password: passwordHash,
          type: 'Staff',
          status: UserStatus.ACTIVE,
          token_version: 0,
        });
        this.logger.log(
          `[SEED] Created Staff: ${s.email} (${s.employee_code})`,
        );
      }
    }
  }
}
