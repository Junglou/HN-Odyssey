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
  addresses?: IAddress[];
}

@Injectable()
export class AddressesService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  // Model này là schema User gốc, không có trường `addresses` (chỉ Customer có).
  // Nên đọc bằng lean() và ghi bằng updateOne({ strict: false }) để không phụ thuộc
  // việc Mongoose có nhận ra đây là Customer hay không.
  private async loadAddresses(userId: string): Promise<IAddress[]> {
    const user = (await this.userModel
      .findById(userId)
      .select('addresses')
      .lean()
      .exec()) as unknown as CustomerWithAddresses | null;
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user.addresses || [];
  }

  private async saveAddresses(userId: string, addresses: IAddress[]) {
    const result = await this.userModel
      .updateOne({ _id: userId }, { $set: { addresses } }, { strict: false })
      .exec();
    if (result.matchedCount === 0) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
  }

  async getMyAddresses(userId: string) {
    const addresses = await this.loadAddresses(userId);
    return { success: true, data: addresses };
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    const addresses = await this.loadAddresses(userId);

    // AC8: Giới hạn tối đa 10 địa chỉ để chống spam DB
    if (addresses.length >= 10) {
      throw new BadRequestException(
        'Bạn chỉ được lưu tối đa 10 địa chỉ giao hàng',
      );
    }

    // AC5: Địa chỉ đầu tiên luôn là mặc định
    const shouldBeDefault = addresses.length === 0 || dto.is_default === true;

    const newAddress: IAddress = {
      ...dto,
      is_default: shouldBeDefault,
      _id: new Types.ObjectId(),
    };

    const next: IAddress[] = [
      ...(shouldBeDefault
        ? addresses.map((addr) => ({ ...addr, is_default: false }))
        : addresses),
      newAddress,
    ];

    await this.saveAddresses(userId, next);

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
    const addresses = await this.loadAddresses(userId);
    const index = addresses.findIndex(
      (addr) => addr._id?.toString() === addressId,
    );

    // AC9: Bảo mật IDOR - Kiểm tra địa chỉ có thuộc về User này không
    if (index === -1) {
      throw new NotFoundException('Không tìm thấy địa chỉ cần cập nhật');
    }

    // Chỉ lấy các trường client thực sự gửi lên
    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as Partial<IAddress>;

    const current = addresses[index];
    // AC4: tích "Đặt làm mặc định" thì các địa chỉ khác về false.
    // Địa chỉ đang là mặc định thì không cho bỏ tích (luôn phải có một mặc định).
    const makeDefault = changes.is_default === true && !current.is_default;
    if (current.is_default) changes.is_default = true;

    const next: IAddress[] = addresses.map((addr, i) => {
      if (i === index) return { ...addr, ...changes };
      return makeDefault ? { ...addr, is_default: false } : addr;
    });

    await this.saveAddresses(userId, next);

    return {
      success: true,
      message: 'Cập nhật địa chỉ thành công', // AC10: Message cho Toast
      data: next[index],
    };
  }

  async deleteAddress(userId: string, addressId: string) {
    const addresses = await this.loadAddresses(userId);
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

    await this.saveAddresses(
      userId,
      addresses.filter((_, i) => i !== index),
    );

    // AC10: Trả về Message để Frontend show Toast
    return { success: true, message: 'Xóa địa chỉ thành công' };
  }
}
