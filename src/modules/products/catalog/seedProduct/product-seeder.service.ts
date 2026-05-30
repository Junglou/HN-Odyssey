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
  private readonly MY_BRAND = 'HN-Odyssey';

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

    const attributeData = [
      {
        name: 'Màu sắc',
        code: 'color',
        display_type: AttributeType.COLOR_SWATCH,
        values: [
          { label: 'Đen Obsidian', value: 'black', meta: '#000000' },
          { label: 'Xanh Navy', value: 'navy', meta: '#000080' },
          { label: 'Cam Cứu Hộ', value: 'orange', meta: '#FFA500' },
        ],
      },
      {
        name: 'Kích cỡ',
        code: 'size',
        display_type: AttributeType.BUTTON,
        values: [
          { label: 'Size S', value: 's' },
          { label: 'Size M', value: 'm' },
          { label: 'Size L', value: 'l' },
        ],
      },
      {
        name: 'Chất liệu',
        code: 'material',
        display_type: AttributeType.BUTTON,
        values: [
          { label: 'Gore-Tex', value: 'gore-tex' },
          { label: 'Merino Wool', value: 'merino' },
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
      const materialAttr = dbAttributes.find((a) => a.code === 'material')!;

      const randomColor = faker.helpers.arrayElement(colorAttr.values);
      const randomSize = faker.helpers.arrayElement(sizeAttr.values);
      const randomMaterial = faker.helpers.arrayElement(materialAttr.values);

      let name = `${this.MY_BRAND} ${randomMaterial.label} ${activity} ${type}`;
      const baseSku = `HNO-${faker.string.alphanumeric(6).toUpperCase()}`;
      const price = faker.number.int({ min: 1200000, max: 25000000 });
      let forcedTags: string[] = [];

      if (i === 0) {
        name = `${this.MY_BRAND} Merino Wool Hiking Socks`;
        forcedTags = ['phu-kien', 'Trending'];
      } else if (i === 1) {
        name = `Gói bảo hành rách vải mở rộng 12 tháng`;
        forcedTags = ['service', 'warranty'];
      }

      // Đẩy text thô của danh mục vào thuộc tính tag để tăng hiệu quả máy học không gian vector
      const categorySemanticText = randomCategory.name.toLowerCase();
      const currentTags = [
        'Outdoor',
        'Trekking',
        this.MY_BRAND,
        randomMaterial.value,
        categorySemanticText,
        ...forcedTags,
      ];

      const hasVariants = faker.datatype.boolean();
      const variants: any[] = [];
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
            price: price,
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
        specs: [{ name: 'Hoạt động', values: [activity] }],
        price: price,
        sale_price:
          faker.helpers.maybe(() => Math.round(price * 0.8), {
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
        weight: faker.number.int({ min: 250, max: 3500 }),
        status: ProductStatus.ACTIVE,
        seo_config: {
          meta_title: name,
          meta_description: `Mua ${name}`,
          meta_keywords: `${this.MY_BRAND}, outdoor`,
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
