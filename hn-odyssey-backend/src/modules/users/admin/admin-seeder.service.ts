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
          { resource: Resource.SYSTEM_MONITORING, actions: [Action.MANAGE] },
          { resource: Resource.SYSTEM_USERS, actions: [Action.MANAGE] },
          { resource: Resource.SYSTEM_ROLES, actions: [Action.MANAGE] },
          { resource: Resource.SYSTEM_NOTIFICATIONS, actions: [Action.MANAGE] },
          {
            resource: Resource.SYSTEM_AUDIT,
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
          { resource: Resource.CATALOG_PRODUCTS, actions: [Action.READ] },
          { resource: Resource.CATALOG_CATEGORIES, actions: [Action.READ] },
          { resource: Resource.INVENTORY_STOCK, actions: [Action.MANAGE] },
          { resource: Resource.INVENTORY_TRANSFERS, actions: [Action.MANAGE] },
        ],
      },
      {
        name: 'Marketing Leader',
        slug: 'MARKETING_LEADER',
        description: 'Quản lý Catalog sản phẩm, chiến dịch và nội dung',
        level: RoleLevel.MANAGEMENT,
        is_active: true,
        permissions: [
          { resource: Resource.CATALOG_PRODUCTS, actions: [Action.MANAGE] },
          { resource: Resource.CATALOG_CATEGORIES, actions: [Action.MANAGE] },
          { resource: Resource.CATALOG_ATTRIBUTES, actions: [Action.MANAGE] },
          { resource: Resource.CATALOG_TAGS, actions: [Action.MANAGE] },
          { resource: Resource.PROMO_COUPONS, actions: [Action.MANAGE] },
          { resource: Resource.PROMO_FLASH_SALES, actions: [Action.MANAGE] },
          { resource: Resource.PROMO_COMBOS, actions: [Action.MANAGE] },
          { resource: Resource.CONTENT_BANNERS, actions: [Action.MANAGE] },
          { resource: Resource.CONTENT_PAGES, actions: [Action.MANAGE] },
          { resource: Resource.CONTENT_POSTS, actions: [Action.MANAGE] },
          { resource: Resource.CONTENT_MEDIA, actions: [Action.MANAGE] },
          { resource: Resource.CONTENT_CONFIG, actions: [Action.MANAGE] },
          { resource: Resource.REPORT_MARKETING, actions: [Action.MANAGE] },
        ],
      },
      {
        name: 'Nhân viên bán hàng (Sales Staff)',
        slug: 'SALES_STAFF',
        description: 'Xử lý đơn hàng, đổi trả và tư vấn khách hàng',
        level: RoleLevel.STAFF,
        is_active: true,
        permissions: [
          { resource: Resource.CATALOG_PRODUCTS, actions: [Action.READ] },
          { resource: Resource.INVENTORY_STOCK, actions: [Action.READ] },
          {
            resource: Resource.SALES_ORDERS,
            actions: [Action.READ, Action.UPDATE, Action.CANCEL, Action.PRINT],
          },
          {
            resource: Resource.SALES_TRADE_IN,
            actions: [
              Action.READ,
              Action.UPDATE,
              Action.RECEIVE,
              Action.APPROVE,
            ],
          },
          {
            resource: Resource.CRM_CUSTOMERS,
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
          { resource: Resource.CRM_CHAT, actions: [Action.MANAGE] },
          {
            resource: Resource.CRM_WARRANTY,
            actions: [Action.READ, Action.UPDATE],
          },
          {
            resource: Resource.CRM_REVIEWS,
            actions: [
              Action.READ,
              Action.REPLY,
              Action.APPROVE,
              Action.UNPUBLISH,
            ],
          },
          { resource: Resource.SALES_ORDERS, actions: [Action.READ] },
        ],
      },
      {
        name: 'Kế toán (Accountant)',
        slug: 'ACCOUNTANT',
        description: 'Xem báo cáo doanh thu và đối soát',
        level: RoleLevel.STAFF,
        is_active: true,
        permissions: [
          { resource: Resource.SALES_ORDERS, actions: [Action.READ] },
          {
            resource: Resource.REPORT_REVENUE,
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
        username: 'admin',
        firstName: 'Admin',
        lastName: 'System',
        phone: '0909000001',
        department: Department.MANAGEMENT,
        roles: ['SUPER_ADMIN'],
        employee_code: 'SA-1-1-0000',
      },
      {
        email: 'admin1@hnodyssey.com',
        username: 'admin1',
        firstName: 'Admin',
        lastName: '1',
        phone: '0909000011',
        department: Department.MANAGEMENT,
        roles: ['SUPER_ADMIN'],
        employee_code: 'SA-1-1-0001',
      },
      {
        email: 'admin2@hnodyssey.com',
        username: 'admin2',
        firstName: 'Admin',
        lastName: '2',
        phone: '0909000012',
        department: Department.MANAGEMENT,
        roles: ['SUPER_ADMIN'],
        employee_code: 'SA-1-1-0002',
      },
      {
        email: 'kho.truong@hnodyssey.com',
        username: 'kho_truong',
        firstName: 'Văn Kho',
        lastName: 'Nguyễn',
        phone: '0909000003',
        department: Department.WAREHOUSE,
        roles: ['WAREHOUSE_MANAGER'],
        employee_code: 'NVK-3-2-0000',
      },
      {
        email: 'sales.lead@hnodyssey.com',
        username: 'sales_lead',
        firstName: 'Doanh Số',
        lastName: 'Phạm',
        phone: '0909000005',
        department: Department.SALES,
        roles: ['SALES_STAFF'],
        employee_code: 'PDS-2-3-0000',
      },
      {
        email: 'mkt.lead@hnodyssey.com',
        username: 'mkt_lead',
        firstName: 'Sáng Tạo',
        lastName: 'Vũ',
        phone: '0909000007',
        department: Department.MARKETING,
        roles: ['MARKETING_LEADER'],
        employee_code: 'VST-4-2-0000',
      },
      {
        email: 'support.01@hnodyssey.com',
        username: 'support_01',
        firstName: 'Thân Thiện',
        lastName: 'Hoàng',
        phone: '0909000008',
        department: Department.SUPPORT,
        roles: ['SUPPORT_STAFF'],
        employee_code: 'HTT-6-3-0000',
      },
      {
        email: 'ketoan@hnodyssey.com',
        username: 'ketoan',
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
          ...s, // Object spread này sẽ tự động map 'username' xuống DB
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
