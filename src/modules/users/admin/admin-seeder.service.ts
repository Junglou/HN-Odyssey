import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Staff } from 'src/modules/users/admin/schemas/staff.schema';
import { Role } from 'src/modules/users/roles/schemas/role.schema';
import { UserStatus } from 'src/common/enums/user-status.enum';
import { Resource, Action } from 'src/common/enums/resource.enum';
import { Department } from 'src/common/enums/department.enum';

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
        permissions: [
          //Kho chỉ được XEM thông tin sản phẩm để biết đường nhập hàng
          { resource: Resource.PRODUCTS, actions: [Action.READ] },
          { resource: Resource.CATEGORIES, actions: [Action.READ] },

          // Quyền chính của kho: Quản lý số lượng và vận chuyển
          { resource: Resource.INVENTORY, actions: [Action.MANAGE] }, // Tồn kho & Kiểm kê
          { resource: Resource.TRANSFERS, actions: [Action.MANAGE] }, // Nhập/Xuất kho
          { resource: Resource.SUPPLIERS, actions: [Action.MANAGE] }, // Nhà cung cấp
          { resource: Resource.SHIPPING, actions: [Action.MANAGE] },
        ],
      },
      {
        name: 'Marketing Leader',
        slug: 'MARKETING_LEADER',
        description: 'Quản lý Catalog sản phẩm, chiến dịch và nội dung',
        permissions: [
          //Marketing nắm quyền sinh sát thông tin sản phẩm
          { resource: Resource.PRODUCTS, actions: [Action.MANAGE] },
          { resource: Resource.CATEGORIES, actions: [Action.MANAGE] },
          { resource: Resource.ATTRIBUTES, actions: [Action.MANAGE] },

          // Các quyền Marketing khác
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
        permissions: [
          // Được xem sản phẩm và tồn kho để tư vấn
          { resource: Resource.PRODUCTS, actions: [Action.READ] },
          { resource: Resource.INVENTORY, actions: [Action.READ] },

          // Quyền chính về đơn hàng
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
        permissions: [
          { resource: Resource.ORDERS, actions: [Action.READ] },
          { resource: Resource.REPORTS, actions: [Action.READ, Action.EXPORT] },
          { resource: Resource.PAYMENT, actions: [Action.READ, Action.EXPORT] },
          { resource: Resource.DASHBOARD, actions: [Action.READ] },
        ],
      },
    ];

    for (const role of roles) {
      const exists = await this.roleModel.findOne({ slug: role.slug });
      if (!exists) {
        await this.roleModel.create(role);
        this.logger.log(`[SEED] Created Role: ${role.name}`);
      }
    }
  }

  // 2. TẠO NHÂN VIÊN MẪU (Giữ nguyên, chỉ cần đảm bảo Department đúng)
  private async seedStaffs() {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('HnOdyssey@2025', salt);

    const staffs = [
      // 1. BAN QUẢN TRỊ
      {
        email: 'admin@hnodyssey.com',
        firstName: 'Admin',
        lastName: 'System',
        phone: '0909000001',
        department: Department.MANAGEMENT,
        roles: ['SUPER_ADMIN'],
        employee_code: 'EMP001',
      },
      // 2. KHO VẬN
      {
        email: 'kho.truong@hnodyssey.com',
        firstName: 'Nguyễn',
        lastName: 'Văn Kho',
        phone: '0909000003',
        department: Department.WAREHOUSE,
        roles: ['WAREHOUSE_MANAGER'],
        employee_code: 'WH001',
      },
      // 3. KINH DOANH (SALES)
      {
        email: 'sales.lead@hnodyssey.com',
        firstName: 'Phạm',
        lastName: 'Doanh Số',
        phone: '0909000005',
        department: Department.SALES,
        roles: ['SALES_STAFF'],
        employee_code: 'SALE001',
      },
      // 4. MARKETING
      {
        email: 'mkt.lead@hnodyssey.com',
        firstName: 'Vũ',
        lastName: 'Sáng Tạo',
        phone: '0909000007',
        department: Department.MARKETING,
        roles: ['MARKETING_LEADER'],
        employee_code: 'MKT001',
      },
      // 5. CSKH
      {
        email: 'support.01@hnodyssey.com',
        firstName: 'Hoàng',
        lastName: 'Thân Thiện',
        phone: '0909000008',
        department: Department.SUPPORT,
        roles: ['SUPPORT_STAFF'],
        employee_code: 'CS001',
      },
      // 6. KẾ TOÁN
      {
        email: 'ketoan@hnodyssey.com',
        firstName: 'Trịnh',
        lastName: 'Thủ Quỹ',
        phone: '0909000009',
        department: Department.ACCOUNTING,
        roles: ['ACCOUNTANT'],
        employee_code: 'ACC001',
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
        this.logger.log(`[SEED] Created Staff: ${s.email} (${s.department})`);
      }
    }
  }
}
