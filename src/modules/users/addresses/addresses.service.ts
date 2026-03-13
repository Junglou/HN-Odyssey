import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

// Khai báo Interface chuẩn để né ESLint
export interface IAddress {
  _id?: Types.ObjectId;
  name: string;
  phone: string;
  street: string;
  city_code: string;
  district_code: string;
  ward_code: string;
  is_default: boolean;
}

interface CustomerWithAddresses {
  _id: Types.ObjectId;
  addresses: IAddress[];
}

@Injectable()
export class AddressesService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async getMyAddresses(userId: string) {
    const user = (await this.userModel
      .findById(userId)
      .select('addresses')
      .lean()
      .exec()) as unknown as CustomerWithAddresses;
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return { success: true, data: user.addresses || [] };
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    const user = await this.userModel
      .findById(userId)
      .select('addresses')
      .exec();
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const addresses = (user.get('addresses') as IAddress[]) || [];

    // AC8: Giới hạn tối đa 10 địa chỉ để chống spam DB
    if (addresses.length >= 10) {
      throw new BadRequestException(
        'Bạn chỉ được lưu tối đa 10 địa chỉ giao hàng',
      );
    }

    // AC5: Nếu là địa chỉ đầu tiên -> Ép thành Mặc định
    const isFirst = addresses.length === 0;
    const shouldBeDefault = isFirst || dto.is_default;

    const newAddress: IAddress = {
      ...dto,
      is_default: shouldBeDefault || false,
      _id: new Types.ObjectId(),
    };

    if (shouldBeDefault) {
      // Reset toàn bộ các địa chỉ cũ về false
      addresses.forEach((addr) => (addr.is_default = false));
    }

    addresses.push(newAddress);
    user.set('addresses', addresses);
    await user.save();

    return {
      success: true,
      message: 'Thêm địa chỉ thành công',
      data: newAddress,
    };
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ) {
    const user = await this.userModel
      .findById(userId)
      .select('addresses')
      .exec();
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const addresses = (user.get('addresses') as IAddress[]) || [];
    const index = addresses.findIndex(
      (addr) => addr._id?.toString() === addressId,
    );

    // AC9: Bảo mật IDOR - Kiểm tra địa chỉ có thuộc về User này không
    if (index === -1) {
      throw new NotFoundException('Không tìm thấy địa chỉ cần cập nhật');
    }

    // AC4: Xử lý nếu người dùng tích chọn "Đặt làm mặc định"
    if (dto.is_default && !addresses[index].is_default) {
      // Reset các địa chỉ khác về false
      addresses.forEach((addr) => (addr.is_default = false));
    }

    // Cập nhật các trường thông tin mới (Merge data)
    addresses[index] = {
      ...addresses[index],
      ...dto,
    };

    user.set('addresses', addresses);
    await user.save();

    return {
      success: true,
      message: 'Cập nhật địa chỉ thành công', // AC10: Message cho Toast
      data: addresses[index],
    };
  }

  async deleteAddress(userId: string, addressId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('addresses')
      .exec();
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const addresses = (user.get('addresses') as IAddress[]) || [];
    const index = addresses.findIndex(
      (addr) => addr._id?.toString() === addressId,
    );

    // AC9 (Bảo mật IDOR): addressId không khớp trong mảng của user này -> Báo lỗi
    if (index === -1) {
      throw new NotFoundException('Không tìm thấy địa chỉ này');
    }

    // AC7: Không cho phép xóa địa chỉ mặc định
    if (addresses[index].is_default) {
      throw new BadRequestException(
        'Không thể xóa địa chỉ đang được đặt làm mặc định',
      );
    }

    addresses.splice(index, 1);
    user.set('addresses', addresses);
    user.markModified('addresses');
    await user.save();

    // AC10: Trả về Message để Frontend show Toast
    return { success: true, message: 'Xóa địa chỉ thành công' };
  }
}
