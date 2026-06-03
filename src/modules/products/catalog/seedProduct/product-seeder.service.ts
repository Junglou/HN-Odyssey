import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { fakerVI as faker } from '@faker-js/faker';
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';
import { ProductStatus } from '../../../../common/enums/product-status.enum';
import {
  Category,
  CategoryDocument,
} from 'src/modules/products/categories/schemas/category.schema';
import {
  Attribute,
  AttributeDocument,
} from 'src/modules/products/attributes/schemas/attribute.schema';
import { AttributeType } from 'src/common/enums/attribute-type.enum';

interface ISeedAttribute {
  code: string;
  value: string;
}

interface ISeedVariant {
  sku: string;
  price: number;
  sale_price: number;
  stock: number;
  thumbnail: string;
  attributes: ISeedAttribute[];
}

interface IMockProduct {
  name: string;
  sku: string;
  slug: string;
  description: string;
  short_description: string;
  warehouse_id: Types.ObjectId;
  gallery: any[];
  images: string[];
  thumbnail: string;
  video: string;
  min_purchase_qty: number;
  max_purchase_qty: number;
  is_member_only: boolean;
  member_prices: Record<string, number>;
  rank_required: number;
  allowed_tiers: string[];
  categories: Types.ObjectId[];
  tags: string[];
  specs: any[];
  attributes: ISeedAttribute[];
  price: number;
  sale_price: number;
  sale_start_date: Date | null;
  sale_end_date: Date | null;
  is_flash_sale: boolean;
  margin_tier: number;
  variants: ISeedVariant[];
  has_variants: boolean;
  stock: number;
  stock_on_hold: number;
  min_stock: number;
  max_stock: number;
  allow_backorder: boolean;
  weight: number;
  status: ProductStatus;
  seo_config: any;
  view_count: number;
  sold_count: number;
  rating_average: number;
  review_count: number;
  is_deleted: boolean;
  created_at: Date;
}

@Injectable()
export class ProductSeederService {
  private readonly logger = new Logger(ProductSeederService.name);
  private readonly MY_BRAND = 'HN-Odyssey';

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Attribute.name)
    private readonly attributeModel: Model<AttributeDocument>,
  ) {}

  // Đổi mặc định lên 100 sản phẩm
  async seedProducts(count: number = 100): Promise<void> {
    this.logger.log('Bắt đầu dọn dẹp toàn bộ dữ liệu Catalog...');
    await Promise.all([
      this.productModel.deleteMany({}),
      this.categoryModel.deleteMany({}),
      this.attributeModel.deleteMany({}),
    ]);

    // 1. Đồng bộ danh mục chuẩn trekking gear
    const categoryData = [
      {
        name: 'Backpacks',
        slug: 'backpacks',
        description: 'Trekking & Hiking Backpacks',
        display_order: 1,
      },
      {
        name: 'Tents & Shelters',
        slug: 'tents-shelters',
        description: 'Camping Tents and Shelters',
        display_order: 2,
      },
      {
        name: 'Footwear',
        slug: 'footwear',
        description: 'Hiking Boots and Shoes',
        display_order: 3,
      },
      {
        name: 'Apparel',
        slug: 'apparel',
        description: 'Outdoor Clothing & Jackets',
        display_order: 4,
      },
      {
        name: 'Accessories',
        slug: 'accessories',
        description: 'Navigation, Hydration & Gears',
        display_order: 5,
      },
    ];
    await this.categoryModel.insertMany(categoryData);
    const dbCategories = await this.categoryModel.find().exec();

    // 2. Khởi tạo bộ lọc attributes chuẩn
    const attributeData = [
      {
        name: 'Color',
        code: 'color',
        display_type: AttributeType.COLOR_SWATCH,
        values: [
          { label: 'Forest Green', value: 'forest-green', meta: '#228B22' },
          { label: 'Desert Sand', value: 'desert-sand', meta: '#EDC9AF' },
          { label: 'Charcoal', value: 'charcoal', meta: '#36454F' },
        ],
      },
      {
        name: 'Size (Apparel)',
        code: 'size',
        display_type: AttributeType.BUTTON,
        values: [
          { label: 'Size S', value: 's' },
          { label: 'Size M', value: 'm' },
          { label: 'Size L', value: 'l' },
          { label: 'Size XL', value: 'xl' },
        ],
      },
      {
        name: 'Capacity (Backpacks)',
        code: 'capacity',
        display_type: AttributeType.BUTTON,
        values: [
          { label: '20 Liters', value: '20l' },
          { label: '40 Liters', value: '40l' },
          { label: '65+ Liters', value: '65l' },
        ],
      },
    ];
    await this.attributeModel.insertMany(attributeData);
    const dbAttributes = await this.attributeModel.find().exec();

    const mockProducts: IMockProduct[] = [];
    const itemTypes = [
      'Jacket',
      'Backpack',
      'Base Layer',
      'Hiking Boots',
      'Tent',
      'Fleece',
    ];

    for (let i = 0; i < count; i++) {
      const type = faker.helpers.arrayElement(itemTypes);
      const activity = faker.helpers.arrayElement([
        'Alpine',
        'Trail',
        'Camping',
        'Expedition',
      ]);
      const randomCategory =
        faker.helpers.arrayElement(dbCategories) || dbCategories[0];

      const colorAttr = dbAttributes.find((a) => a.code === 'color')!;
      const sizeAttr = dbAttributes.find((a) => a.code === 'size')!;

      // Cập nhật 'material' thành 'capacity' để map đúng với dbAttributes
      const capacityAttr = dbAttributes.find((a) => a.code === 'capacity')!;

      const randomColor = faker.helpers.arrayElement(colorAttr.values);
      const randomSize = faker.helpers.arrayElement(sizeAttr.values);
      const randomCapacity = faker.helpers.arrayElement(capacityAttr.values);

      let name = `${this.MY_BRAND} ${randomCapacity.label} ${activity} ${type}`;
      const baseSku = `HNO-${faker.string.alphanumeric(6).toUpperCase()}`;

      // 3. Điều chỉnh giá tiền chuẩn USD (từ $20.00 đến $350.00)
      const price = faker.number.float({
        min: 20,
        max: 350,
        fractionDigits: 2,
      });
      let forcedTags: string[] = [];

      if (i === 0) {
        name = `${this.MY_BRAND} Merino Wool Hiking Socks`;
        forcedTags = ['phu-kien', 'Trending'];
      } else if (i === 1) {
        name = `Extended 12-Month Warranty Pack`;
        forcedTags = ['service', 'warranty'];
      } else {
        // Rải ngẫu nhiên tag Trending cho khoảng 30% sản phẩm để đảm bảo AI Engine luôn có Data Fallback
        if (faker.datatype.boolean({ probability: 0.3 })) {
          forcedTags.push('Trending');
        }
      }

      const categorySemanticText = randomCategory.name.toLowerCase();
      const currentTags = [
        'Outdoor',
        'Trekking',
        this.MY_BRAND,
        randomCapacity.value,
        categorySemanticText,
        ...forcedTags,
      ];

      const hasVariants = faker.datatype.boolean();
      const variants: ISeedVariant[] = [];
      let totalStock = 0;

      if (hasVariants) {
        const numVariants = faker.number.int({ min: 2, max: 4 });
        for (let v = 0; v < numVariants; v++) {
          const vColor = faker.helpers.arrayElement(colorAttr.values);
          const vSize = faker.helpers.arrayElement(sizeAttr.values);
          const vStock = faker.number.int({ min: 5, max: 50 });
          totalStock += vStock;

          variants.push({
            sku: `${baseSku}-${vColor.value.toUpperCase()}-${vSize.value.toUpperCase()}`,
            price: price, // Giữ nguyên giá gốc cho biến thể
            sale_price: 0,
            stock: vStock,
            thumbnail: `https://picsum.photos/seed/${faker.string.uuid()}/400/400`,
            attributes: [
              { code: 'color', value: vColor.value },
              { code: 'size', value: vSize.value },
            ],
          });
        }
      } else {
        totalStock = faker.number.int({ min: 10, max: 150 });
      }

      // Xử lý lấy tất cả thuộc tính từ biến thể để đồng bộ lên mảng thuộc tính gốc
      let rootAttributes: ISeedAttribute[] = [];

      if (hasVariants) {
        // Định nghĩa type Map để trình biên dịch tự động nhận diện giá trị khi set
        const attrMap = new Map<string, ISeedAttribute>();

        variants.forEach((v) => {
          v.attributes.forEach((a) => {
            attrMap.set(`${a.code}_${a.value}`, {
              code: a.code,
              value: a.value,
            });
          });
        });

        // Bổ sung capacity mặc định vì biến thể ở trên chỉ tạo ngẫu nhiên color và size
        attrMap.set(`capacity_${randomCapacity.value}`, {
          code: capacityAttr.code,
          value: randomCapacity.value,
        });

        rootAttributes = Array.from(attrMap.values());
      } else {
        rootAttributes = [
          { code: colorAttr.code, value: randomColor.value },
          { code: sizeAttr.code, value: randomSize.value },
          { code: capacityAttr.code, value: randomCapacity.value },
        ];
      }

      mockProducts.push({
        name: name,
        sku: baseSku,
        slug:
          faker.helpers.slugify(name).toLowerCase() +
          '-' +
          faker.string.alphanumeric(4),
        description: `Trang bị ${name} sinh ra để chịu đựng thời tiết khắc nghiệt. Sản phẩm chính hãng ${this.MY_BRAND}.`,
        short_description: `Hiệu suất tối đa cho ${activity}.`,
        warehouse_id: new Types.ObjectId(),
        gallery: [
          {
            url: `https://picsum.photos/seed/${faker.string.uuid()}/800/800`,
            type: 'IMAGE',
            display_order: 0,
          },
        ],
        images: [`https://picsum.photos/seed/${faker.string.uuid()}/800/800`],
        thumbnail: `https://picsum.photos/seed/${faker.string.uuid()}/400/400`,
        video: '',
        min_purchase_qty: 1,
        max_purchase_qty: 5,
        is_member_only: false,
        member_prices: { GOLD: parseFloat((price * 0.9).toFixed(2)) },
        rank_required: 0,
        allowed_tiers: [],
        categories: [randomCategory._id],
        attributes: rootAttributes, // Sử dụng mảng thuộc tính đã được gom nhóm chuẩn
        tags: currentTags,
        specs: [{ name: 'Activity', values: [activity] }],
        price: price,
        sale_price:
          faker.helpers.maybe(() => parseFloat((price * 0.8).toFixed(2)), {
            probability: 0.25,
          }) || 0,
        sale_start_date: null,
        sale_end_date: null,
        is_flash_sale: faker.datatype.boolean({ probability: 0.1 }),
        margin_tier: faker.number.int({ min: 1, max: 5 }),
        variants: variants,
        has_variants: hasVariants,
        stock: totalStock,
        stock_on_hold: 0,
        min_stock: 5,
        max_stock: 300,
        allow_backorder: false,
        weight: 0.5,
        status: ProductStatus.ACTIVE,
        seo_config: {
          meta_title: name,
          meta_description: `Buy ${name} at ${this.MY_BRAND}`,
          meta_keywords: `${this.MY_BRAND}, outdoor, ${activity}`,
        },
        view_count: faker.number.int({ min: 50, max: 3000 }),
        sold_count: faker.number.int({ min: 5, max: 500 }),
        rating_average: faker.number.float({
          min: 3.5,
          max: 5,
          fractionDigits: 1,
        }),
        review_count: faker.number.int({ min: 1, max: 80 }),
        is_deleted: false,
        created_at: faker.date.past({ years: 0.5 }),
      });
    }

    await this.productModel.insertMany(mockProducts);
    this.logger.log(`Đã nạp ${count} Products vào Database.`);
  }
}
