import { Injectable, Logger } from '@nestjs/common';
import { Command } from 'nestjs-command';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  UserBehavior,
  BehaviorAction,
  DeviceType,
} from './schemas/user-behavior.schema';
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';
import {
  Category,
  CategoryDocument,
} from 'src/modules/products/categories/schemas/category.schema';
import {
  Order,
  OrderDocument,
} from 'src/modules/sales/orders/schemas/order.schema';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { TrackingService } from './tracking.service';

type PersonaGroup = 'MEN' | 'WOMEN' | 'KID' | 'GEAR';

// Tên DANH MỤC GỐC (cấp cao nhất) cho từng nhóm, so khớp không phân biệt hoa thường.
// Nếu log báo nhóm nào 0 sản phẩm, đối chiếu với dòng "Danh mục gốc hiện có" rồi sửa ở đây.
const ROOT_CATEGORY_NAMES: Record<PersonaGroup, string[]> = {
  MEN: ['men'],
  WOMEN: ['women'],
  KID: ['kid', 'kids'],
  GEAR: ['equipment', 'emergency packs'],
};

interface PersonaConfig {
  key: string; // dùng trong session_id để nhận diện
  count: number; // số user ảo
  main: PersonaGroup; // nhóm xem chính
  side?: PersonaGroup; // nhóm xem phụ (ít)
}

const PERSONAS: PersonaConfig[] = [
  { key: 'men', count: 8, main: 'MEN', side: 'GEAR' },
  { key: 'women', count: 8, main: 'WOMEN', side: 'GEAR' },
  { key: 'parent', count: 4, main: 'KID', side: 'GEAR' },
  { key: 'outdoor', count: 4, main: 'GEAR' },
];

const RANDOM_SEED = 20261029; // cố định để mỗi lần chạy ra cùng một bộ dữ liệu
const ALGOLIA_SESSIONS = 300; // x2 sản phẩm = 600 conversion; cộng các đợt trước để vượt ngưỡng FBT 1.000/90 ngày

// Bộ sinh số ngẫu nhiên có seed (mulberry32)
const createRng = (seed: number) => {
  let state = seed;
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

interface LeanCategory {
  _id: Types.ObjectId;
  name: string;
  parent_id: Types.ObjectId | null;
}

interface LeanProduct {
  _id: Types.ObjectId;
  categories: Types.ObjectId[];
}

@Injectable()
export class RecommendationDemoSeedCommand {
  private readonly logger = new Logger(RecommendationDemoSeedCommand.name);
  private rng = createRng(RANDOM_SEED);

  constructor(
    @InjectModel(UserBehavior.name) private behaviorModel: Model<UserBehavior>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly trackingService: TrackingService,
  ) {}

  @Command({
    command: 'seed:reco-demo',
    describe:
      'Seed hành vi user ảo (Python CF) + conversion Algolia. KHÔNG tạo/sửa sản phẩm.',
  })
  async run(): Promise<void> {
    this.rng = createRng(RANDOM_SEED);

    const groups = await this.loadProductGroups();
    if (!groups) return;

    await this.cleanupOldSeed();

    const behaviorCount = await this.seedBehaviors(groups);
    this.logger.log(
      `Đã ghi ${behaviorCount} hành vi của user ảo vào user_behaviors.`,
    );

    await this.seedAlgoliaConversions(groups);

    this.logger.log('XONG. Bước tiếp theo: POST http://127.0.0.1:8000/train');
  }

  // Chỉ ĐỌC categories + products để chia nhóm, không ghi gì vào 2 collection này
  private async loadProductGroups(): Promise<Record<
    PersonaGroup,
    string[]
  > | null> {
    const categories = await this.categoryModel
      .find({})
      .select('_id name parent_id')
      .lean<LeanCategory[]>();

    const byId = new Map(categories.map((c) => [String(c._id), c]));

    const rootNameOf = (categoryId: string): string => {
      let current = byId.get(categoryId);
      for (let depth = 0; current?.parent_id && depth < 10; depth++) {
        const parent = byId.get(String(current.parent_id));
        if (!parent) break;
        current = parent;
      }
      return current ? current.name.trim().toLowerCase() : '';
    };

    const groupOfRoot = (rootName: string): PersonaGroup | null => {
      const found = (Object.keys(ROOT_CATEGORY_NAMES) as PersonaGroup[]).find(
        (g) => ROOT_CATEGORY_NAMES[g].includes(rootName),
      );
      return found ?? null;
    };

    // Lọc giống CollaborativeFilteringService (ACTIVE, chưa xóa, còn hàng)
    const products = await this.productModel
      .find({
        status: ProductStatus.ACTIVE,
        is_deleted: false,
        stock: { $gt: 0 },
      })
      .select('_id categories')
      .lean<LeanProduct[]>();

    const groups: Record<PersonaGroup, string[]> = {
      MEN: [],
      WOMEN: [],
      KID: [],
      GEAR: [],
    };

    for (const p of products) {
      const matched = new Set<PersonaGroup>();
      for (const catId of p.categories || []) {
        const g = groupOfRoot(rootNameOf(String(catId)));
        if (g) matched.add(g);
      }
      matched.forEach((g) => groups[g].push(String(p._id)));
    }

    const rootNames = categories.filter((c) => !c.parent_id).map((c) => c.name);
    this.logger.log(`Danh mục gốc hiện có: ${rootNames.join(', ')}`);
    (Object.keys(groups) as PersonaGroup[]).forEach((g) =>
      this.logger.log(`Nhóm ${g}: ${groups[g].length} sản phẩm`),
    );

    if (groups.MEN.length < 2 || groups.WOMEN.length < 2) {
      this.logger.error(
        'Nhóm MEN hoặc WOMEN có dưới 2 sản phẩm. Sửa ROOT_CATEGORY_NAMES cho khớp danh mục gốc ở trên. ĐÃ DỪNG, chưa ghi/xóa dữ liệu nào.',
      );
      return null;
    }
    return groups;
  }

  // Chỉ xóa dữ liệu do seed tạo ra; hành vi và đơn hàng thật giữ nguyên
  private async cleanupOldSeed(): Promise<void> {
    const behaviors = await this.behaviorModel.deleteMany({
      session_id: { $regex: /^seed_/ },
    });
    const orders = await this.orderModel.deleteMany({
      order_code: { $regex: /^SEED_/ },
    });
    this.logger.log(
      `Đã xóa ${behaviors.deletedCount} hành vi seed cũ và ${orders.deletedCount} đơn seed cũ.`,
    );
  }

  private async seedBehaviors(
    groups: Record<PersonaGroup, string[]>,
  ): Promise<number> {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const docs: Record<string, unknown>[] = [];

    PERSONAS.forEach((persona, personaIdx) => {
      for (let u = 0; u < persona.count; u++) {
        // ID dạng 5eed... để nhìn vào là biết user ảo
        const userId = new Types.ObjectId(
          `5eed${personaIdx.toString(16).padStart(4, '0')}${u.toString(16).padStart(16, '0')}`,
        );
        const sessionId = `seed_reco_${persona.key}_${u}`;
        const device = this.pick([
          DeviceType.DESKTOP,
          DeviceType.MOBILE,
          DeviceType.TABLET,
        ]);

        const mainPool = groups[persona.main];
        const mainItems = this.sample(
          mainPool,
          Math.max(2, Math.ceil(mainPool.length * 0.6)),
        );
        const sideItems = persona.side
          ? this.sample(
              groups[persona.side],
              Math.min(2, groups[persona.side].length),
            )
          : [];

        const push = (productId: string, action: BehaviorAction) => {
          const createdAt = new Date(
            now - this.randInt(1, 20) * DAY_MS - this.randInt(0, 86399) * 1000,
          );
          docs.push({
            session_id: sessionId,
            user_id: userId,
            action,
            path:
              action === BehaviorAction.PURCHASE
                ? '/checkout/success'
                : `/product/${productId}`,
            source: 'Seed_Reco_Demo',
            device,
            dwell_time_seconds: this.randInt(15, 90),
            is_bounce: false,
            metadata: { product_id: productId },
            createdAt,
            updatedAt: createdAt,
          });
        };

        mainItems.forEach((pid) => {
          const views = this.randInt(2, 4);
          for (let v = 0; v < views; v++)
            push(pid, BehaviorAction.VIEW_PRODUCT);
          if (this.rng() < 0.4) push(pid, BehaviorAction.ADD_TO_CART);
          if (this.rng() < 0.15) push(pid, BehaviorAction.PURCHASE);
        });
        sideItems.forEach((pid) => push(pid, BehaviorAction.VIEW_PRODUCT));
      }
    });

    if (docs.length > 0) {
      // Ghi qua driver để giữ createdAt rải theo ngày (Mongoose timestamps sẽ ghi đè thành "bây giờ")
      await this.behaviorModel.collection.insertMany(docs);
    }
    return docs.length;
  }

  private async seedAlgoliaConversions(
    groups: Record<PersonaGroup, string[]>,
  ): Promise<void> {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    const groupKeys = (Object.keys(groups) as PersonaGroup[]).filter(
      (g) => groups[g].length >= 2,
    );

    let attempted = 0;
    for (let i = 0; i < ALGOLIA_SESSIONS; i++) {
      const group = groupKeys[i % groupKeys.length];
      const userToken = `seed_reco_algolia_${i}`;

      for (const productId of this.sample(groups[group], 2)) {
        // KHÔNG truyền queryID: event chỉ để model học, không được tính vào CTR/CVR
        await this.trackingService.sendAlgoliaInsight(
          'ADD_TO_CART',
          userToken,
          productId,
          'Seed',
        );
        attempted++;
        await delay(30);
      }
    }
    this.logger.log(
      `Đã gửi ${attempted} conversion seed lên Algolia (kiểm tra log phía trên nếu có dòng lỗi Insights).`,
    );
  }

  private randInt(min: number, max: number): number {
    return min + Math.floor(this.rng() * (max - min + 1));
  }

  private pick<T>(items: T[]): T {
    return items[Math.floor(this.rng() * items.length)];
  }

  private sample(items: string[], size: number): string[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.min(size, copy.length));
  }
}
