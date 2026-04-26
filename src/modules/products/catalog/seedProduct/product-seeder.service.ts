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

interface IMockProduct {
  name: string;
  sku: string;
  slug: string;
  description: string;
  short_description: string;
  brand: string;
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
  attributes: any[];
  price: number;
  sale_price: number;
  sale_start_date: Date | null;
  sale_end_date: Date | null;
  is_flash_sale: boolean;
  margin_tier: number;
  variants: any[];
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

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Attribute.name)
    private readonly attributeModel: Model<AttributeDocument>,
  ) {}

  async seedProducts(count: number = 50): Promise<void> {
    this.logger.log('Bắt đầu dọn dẹp toàn bộ dữ liệu Catalog...');

    await Promise.all([
      this.productModel.deleteMany({}),
      this.categoryModel.deleteMany({}),
      this.attributeModel.deleteMany({}),
    ]);

    // 2. SEED CATEGORIES

    this.logger.log('Đang tạo Categories đồng bộ...');
    const categoryData = [
      {
        name: 'Áo Khoác Nam',
        slug: 'ao-khoac-nam',
        description: 'Áo khoác chống nước, giữ nhiệt',
        display_order: 1,
      },
      {
        name: 'Balo Leo Núi',
        slug: 'balo-leo-nui',
        description: 'Balo trợ lực, dã ngoại',
        display_order: 2,
      },
      {
        name: 'Giày Trekking',
        slug: 'giay-trekking',
        description: 'Giày đi rừng, leo núi',
        display_order: 3,
      },
      {
        name: 'Phụ Kiện Cắm Trại',
        slug: 'phu-kien-cam-trai',
        description: 'Lều, võng, đèn pin',
        display_order: 4,
      },
      {
        name: 'Quần Áo Giữ Nhiệt',
        slug: 'quan-ao-giu-nhiet',
        description: 'Đồ lót giữ nhiệt Base layer',
        display_order: 5,
      },
    ];
    await this.categoryModel.insertMany(categoryData);
    const dbCategories = await this.categoryModel.find().exec();

    // 3. SEED ATTRIBUTES

    this.logger.log('Đang tạo Attributes đồng bộ...');

    const attributeData = [
      {
        name: 'Màu sắc',
        code: 'color',
        display_type: AttributeType.COLOR_SWATCH,
        description: 'Màu sắc sản phẩm',
        is_filterable: true,
        sort_order: 1,
        values: [
          { label: 'Đen Obsidian', value: 'black', meta: '#000000' },
          { label: 'Xanh Navy', value: 'navy', meta: '#000080' },
          { label: 'Xanh Rêu', value: 'olive', meta: '#556B2F' },
          { label: 'Cam Cứu Hộ', value: 'orange', meta: '#FFA500' },
        ],
      },
      {
        name: 'Kích cỡ',
        code: 'size',
        display_type: AttributeType.BUTTON,
        description: 'Kích cỡ chuẩn quốc tế',
        is_filterable: true,
        sort_order: 2,
        values: [
          { label: 'Size S', value: 's' },
          { label: 'Size M', value: 'm' },
          { label: 'Size L', value: 'l' },
          { label: 'Size XL', value: 'xl' },
        ],
      },
      {
        name: 'Chất liệu',
        code: 'material',
        display_type: AttributeType.BUTTON,
        description: 'Chất liệu vải/cấu tạo',
        is_filterable: true,
        sort_order: 3,
        values: [
          { label: 'Gore-Tex', value: 'gore-tex' },
          { label: 'NetPlus®', value: 'netplus' },
          { label: 'Merino Wool', value: 'merino' },
        ],
      },
    ];
    await this.attributeModel.insertMany(attributeData);
    const dbAttributes = await this.attributeModel.find().exec();

    // 4. SEED PRODUCTS

    this.logger.log(`Đang tạo ${count} Products chủ đề Patagonia...`);
    const mockProducts: IMockProduct[] = [];
    const brands = [
      'Patagonia',
      'The North Face',
      "Arc'teryx",
      'Columbia',
      'Osprey',
      'Salomon',
    ];
    const itemTypes = [
      'Jacket',
      'Backpack',
      'Base Layer',
      'Hiking Boots',
      'Tent',
      'Fleece',
    ];
    const specialTags = ['bulky', 'fragile', 'Trending', 'single-only'];

    for (let i = 0; i < count; i++) {
      const brand = faker.helpers.arrayElement(brands);
      const type = faker.helpers.arrayElement(itemTypes);
      const activity = faker.helpers.arrayElement([
        'Alpine',
        'Trail',
        'Camping',
        'Expedition',
      ]);

      const randomCategory =
        faker.helpers.arrayElement(dbCategories) || dbCategories[0];

      const colorAttr =
        dbAttributes.find((a) => a.code === 'color') || dbAttributes[0];
      const sizeAttr =
        dbAttributes.find((a) => a.code === 'size') || dbAttributes[0];
      const materialAttr =
        dbAttributes.find((a) => a.code === 'material') || dbAttributes[0];

      const randomColor =
        faker.helpers.arrayElement(colorAttr.values) || colorAttr.values[0];
      const randomSize =
        faker.helpers.arrayElement(sizeAttr.values) || sizeAttr.values[0];
      const randomMaterial =
        faker.helpers.arrayElement(materialAttr.values) ||
        materialAttr.values[0];

      let name = `${brand} ${randomMaterial.label} ${activity} ${type}`;
      const baseSku = `${brand.substring(0, 3).toUpperCase()}-${faker.string.alphanumeric(6).toUpperCase()}`;

      let price = faker.number.int({ min: 1200000, max: 25000000 });
      let forcedTags: string[] = [];

      // Ép 5 sản phẩm đầu tiên thành các trường hợp đặc biệt để Test AI
      if (i === 0) {
        // SP 1: Móc khóa/Vớ rẻ để lấp Freeship (High-end)
        name = `${brand} Merino Wool Hiking Socks`;
        price = faker.number.int({ min: 450000, max: 750000 });
        forcedTags = ['phu-kien', 'Trending', 'vo-merino'];
      } else if (i === 1) {
        // SP 2: Gói dịch vụ bảo hành/gói quà
        name = `Gói bảo hành rách vải mở rộng 12 tháng`;
        price = 250000;
        forcedTags = ['service', 'warranty'];
      } else if (i === 2) {
        // SP 3: Lều cắm trại để test tương thích giỏ hàng (AC18)
        name = `${brand} 4-Person Camping Tent`;
        forcedTags = ['tent', 'cam-trai', 'leu', 'Trending'];
      } else if (i === 3) {
        // SP 4: Phụ kiện lều để gợi ý đi kèm Lều (AC18)
        name = `${brand} Heavy Duty Tent Pegs`;
        forcedTags = ['phu-kien-cam-trai', 'coc-leu', 'den-pin'];
      } else if (i === 4) {
        // SP 5: Chắc chắn có tag Trending để test Fallback giỏ hàng rỗng
        forcedTags = ['Trending'];
      }

      // Nối tag random với tag ép buộc
      const currentTags = [
        'Outdoor',
        'Trekking',
        brand,
        randomMaterial.value,
        ...forcedTags,
      ];
      if (faker.datatype.boolean({ probability: 0.15 })) {
        currentTags.push(faker.helpers.arrayElement(specialTags));
      }

      // LOGIC TẠO VARIANT
      const hasVariants = faker.datatype.boolean(); // Random 50% cơ hội có biến thể
      const variants: any[] = [];
      let totalStock = 0;

      if (hasVariants) {
        const numVariants = faker.number.int({ min: 2, max: 4 });
        for (let v = 0; v < numVariants; v++) {
          const vColor =
            faker.helpers.arrayElement(colorAttr.values) || colorAttr.values[0];
          const vSize =
            faker.helpers.arrayElement(sizeAttr.values) || sizeAttr.values[0];
          const vStock = faker.number.int({ min: 5, max: 50 });
          totalStock += vStock;

          variants.push({
            sku: `${baseSku}-${vColor.value.toUpperCase()}-${vSize.value.toUpperCase()}`,
            price: price + faker.number.int({ min: 0, max: 500000 }),
            sale_price:
              faker.helpers.maybe(() => Math.round(price * 0.8), {
                probability: 0.25,
              }) || 0,
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

      const productData: IMockProduct = {
        name: name,
        sku: baseSku,
        slug:
          faker.helpers.slugify(name).toLowerCase() +
          '-' +
          faker.string.alphanumeric(4),
        description: `Trang bị ${name} sinh ra để chịu đựng thời tiết khắc nghiệt. Sản phẩm chính hãng ${brand}.`,
        short_description: `Hiệu suất tối đa cho ${activity}.`,
        brand: brand,
        warehouse_id: new Types.ObjectId(),
        gallery: [
          {
            url: `https://picsum.photos/seed/${faker.string.uuid()}/800/800`,
            type: 'IMAGE',
            display_order: 0,
          },
        ],
        images: [
          `https://picsum.photos/seed/${faker.string.uuid()}/800/800`,
          `https://picsum.photos/seed/${faker.string.uuid()}/800/800`,
        ],
        thumbnail: `https://picsum.photos/seed/${faker.string.uuid()}/400/400`,
        video: '',
        min_purchase_qty: 1,
        max_purchase_qty: 5,
        is_member_only: false,
        member_prices: { GOLD: Math.round(price * 0.9) },
        rank_required: 0,
        allowed_tiers: [],

        categories: [randomCategory._id],

        attributes: [
          { code: colorAttr.code, value: randomColor.value },
          { code: sizeAttr.code, value: randomSize.value },
          { code: materialAttr.code, value: randomMaterial.value },
        ],

        tags: currentTags,
        specs: [
          { name: 'Hoạt động', values: [activity] },
          { name: 'Bảo hành', values: ['Trọn đời'] },
        ],
        price: price,
        sale_price:
          faker.helpers.maybe(() => Math.round(price * 0.8), {
            probability: 0.25,
          }) || 0,
        sale_start_date: null,
        sale_end_date: null,

        // TRƯỜNG MỚI CHO AI/SUGGESTION
        is_flash_sale: faker.datatype.boolean({ probability: 0.1 }),
        margin_tier: faker.number.int({ min: 1, max: 5 }),

        variants: variants,
        has_variants: hasVariants,
        stock: totalStock,

        stock_on_hold: 0,
        min_stock: 5,
        max_stock: 300,
        allow_backorder: faker.datatype.boolean({ probability: 0.2 }),
        weight: faker.number.int({ min: 250, max: 3500 }),
        status: ProductStatus.ACTIVE,
        seo_config: {
          meta_title: name,
          meta_description: `Mua ${name}`,
          meta_keywords: `${brand}, outdoor`,
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

        // TRƯỜNG MỚI CHO ALGOLIA RANKING NEWEST
        created_at: faker.date.past({ years: 0.5 }),
      };

      mockProducts.push(productData);
    }

    try {
      await this.productModel.insertMany(mockProducts);
      this.logger.log(
        `✅ Thành công! Đã nạp 5 Categories, 3 Attributes và ${count} Products chuẩn AI (Đã bao gồm FlashSale, Margin Tier, và Variants).`,
      );
    } catch (error) {
      this.logger.error('❌ Lỗi Seeder:', error);
    }
  }
}
