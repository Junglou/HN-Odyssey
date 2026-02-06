import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import {
  Order,
  OrderDocument,
} from 'src/modules/sales/orders/schemas/order.schema';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  //Chuyển đổi Guest (từ đơn hàng) thành Member

  async convertGuestToMember(orderId: string, password: string) {
    // 1. Tìm đơn hàng
    const order = await this.orderModel.findById(orderId);

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    if (!order.guest_info || !order.guest_info.email) {
      throw new BadRequestException(
        'Đơn hàng này không có thông tin khách vãng lai hợp lệ.',
      );
    }

    // 2. Check xem email đã tồn tại chưa
    const existingUser = await this.userModel.findOne({
      email: order.guest_info.email,
    });

    if (existingUser) {
      throw new BadRequestException(
        'Email này đã có tài khoản. Vui lòng đăng nhập để liên kết đơn hàng.',
      );
    }

    // 3. Tạo User mới
    const hashedPassword = await this.hashPassword(password);

    // Sử dụng Model để tạo user (Thay vì raw query) để đảm bảo Schema Validation
    const newUser = await this.userModel.create({
      email: order.guest_info.email,
      password: hashedPassword,
      name: order.guest_info.name,
      phone: order.guest_info.phone,
      role: 'CUSTOMER', // Enum Role
      is_active: true,
      avatar: '',
    });

    // 4. Cập nhật lại đơn hàng (Link đơn hàng với User mới)
    order.user_id = newUser._id;
    order.isGuest = false;

    // Xóa thông tin guest thừa (tuỳ chọn, giữ lại để đối chiếu cũng được)
    // order.guest_info = undefined;

    await order.save();

    return {
      success: true,
      message: 'Tạo tài khoản thành công từ đơn hàng.',
      userId: newUser._id,
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }
}
