import { Injectable } from '@nestjs/common';
import algoliasearch from 'algoliasearch';
import { ConfigService } from '@nestjs/config';
import { ProductDocument } from '../products/catalog/schemas/product.schema';

// 1. Tự định nghĩa Interface để chặn đứng lỗi "any" từ thư viện ngoài
interface SecuredApiKeyParams {
  filters?: string;
  validUntil?: number;
  userToken?: string;
  [key: string]: string | number | undefined;
}

interface IAlgoliaIndex {
  saveObject(object: Record<string, unknown>): Promise<unknown>;
  deleteObject(objectID: string): Promise<unknown>;
  setSettings(settings: Record<string, unknown>): Promise<unknown>;
  clearObjects(): Promise<unknown>;
}

interface IAlgoliaClient {
  initIndex(indexName: string): IAlgoliaIndex;
  generateSecuredApiKey(
    parentKey: string,
    restrictions: SecuredApiKeyParams,
  ): string;
}

@Injectable()
export class AlgoliaService {
  private client: IAlgoliaClient;
  private index: IAlgoliaIndex;

  constructor(private configService: ConfigService) {
    const rawClient = algoliasearch(
      this.configService.get<string>('ALGOLIA_APP_ID') || '',
      this.configService.get<string>('ALGOLIA_ADMIN_KEY') || '',
    );

    this.client = rawClient as unknown as IAlgoliaClient;

    this.index = this.client.initIndex(
      this.configService.get<string>('ALGOLIA_INDEX_NAME') || 'products',
    );
  }

  // [THÊM MỚI] Hàm thiết lập Replicas tự động bằng Code
  async setupAlgoliaIndicesAndReplicas() {
    const primaryName =
      this.configService.get<string>('ALGOLIA_INDEX_NAME') || 'products';

    // Tên các Index con (Phải khớp với tên sẽ dùng trên Frontend)
    const replicaPriceAsc = `${primaryName}_price_asc`;
    const replicaPriceDesc = `${primaryName}_price_desc`;
    const replicaNewest = `${primaryName}_newest`;

    try {
      console.log('[Algolia] Đang khởi tạo Replicas...');

      // 1. Khai báo Replicas cho Index gốc (Sử dụng Standard Replicas để sort)
      await this.index.setSettings({
        replicas: [
          `standard(${replicaPriceAsc})`,
          `standard(${replicaPriceDesc})`,
          `standard(${replicaNewest})`,
        ],
      });

      // 2. Cấu hình tiêu chí Sort (Ranking) cho từng Replica

      // GIÁ TĂNG DẦN
      const indexPriceAsc = this.client.initIndex(replicaPriceAsc);
      await indexPriceAsc.setSettings({
        // Ưu tiên asc(sale_price) lên đầu tiên
        ranking: [
          'asc(sale_price)',
          'typo',
          'geo',
          'words',
          'filters',
          'proximity',
          'attribute',
          'exact',
          'custom',
        ],
      });

      // GIÁ GIẢM DẦN
      const indexPriceDesc = this.client.initIndex(replicaPriceDesc);
      await indexPriceDesc.setSettings({
        // Ưu tiên desc(sale_price) lên đầu tiên
        ranking: [
          'desc(sale_price)',
          'typo',
          'geo',
          'words',
          'filters',
          'proximity',
          'attribute',
          'exact',
          'custom',
        ],
      });

      // MỚI NHẤT
      const indexNewest = this.client.initIndex(replicaNewest);
      await indexNewest.setSettings({
        // Ưu tiên desc(created_at) lên đầu tiên
        ranking: [
          'desc(created_at)',
          'typo',
          'geo',
          'words',
          'filters',
          'proximity',
          'attribute',
          'exact',
          'custom',
        ],
      });

      console.log('[Algolia] Thiết lập Replicas thành công!');
      return { message: 'Đã khởi tạo Primary và Replicas thành công.' };
    } catch (error) {
      console.error('[Algolia] Lỗi khi tạo Replicas:', error);
      throw error;
    }
  }

  async syncProduct(product: ProductDocument, categoryHierarchy: string[]) {
    const attrs: Record<string, string[]> = {};

    if (product.attributes && product.attributes.length > 0) {
      product.attributes.forEach((a) => {
        if (!attrs[a.code]) attrs[a.code] = [];
        if (!attrs[a.code].includes(a.value)) {
          attrs[a.code].push(a.value);
        }
      });
    }

    // Ép kiểu an toàn để trích xuất created_at
    const productData = product as unknown as {
      created_at?: Date | string | number;
      is_flash_sale?: boolean;
      margin_tier?: number;
      allow_backorder?: boolean;
      has_variants?: boolean;
      review_count?: number;
    };

    const createdAtTime = productData.created_at
      ? new Date(productData.created_at).getTime()
      : Date.now();

    // ĐÃ BỔ SUNG TOÀN BỘ CÁC TRƯỜNG CÒN THIẾU VÀO ĐÂY
    const record: Record<string, unknown> = {
      objectID: product._id.toString(),
      name: product.name,
      sku: product.sku,
      slug: product.slug,
      brand: product.brand,
      image_url: product.thumbnail,
      description: product.description,
      short_description: product.short_description,
      price: product.price,
      sale_price: product.sale_price > 0 ? product.sale_price : product.price,
      stock: product.stock,
      sold_count: product.sold_count,
      view_count: product.view_count,
      rating_average: product.rating_average,
      categories: categoryHierarchy,
      attributes: attrs,
      tags: product.tags || [],
      status: product.status,
      is_deleted: product.is_deleted,
      created_at: createdAtTime,
      thumbnail: product.thumbnail,

      //  BỔ SUNG CÁC TRƯỜNG MỚI ĐỂ FRONTEND & AI XỬ LÝ
      is_flash_sale: productData.is_flash_sale ?? false,
      margin_tier: productData.margin_tier ?? 1,
      allow_backorder: productData.allow_backorder ?? false,
      has_variants: productData.has_variants ?? false,
      review_count: productData.review_count ?? 0,
    };

    await this.index.saveObject(record);
  }

  async removeProduct(productId: string) {
    await this.index.deleteObject(productId);
  }

  generateSecuredApiKey(userId?: string): string {
    const searchKey =
      this.configService.get<string>('ALGOLIA_SEARCH_KEY') || '';

    const params: SecuredApiKeyParams = {
      filters: 'status:ACTIVE AND is_deleted:false',
      validUntil: Math.floor(Date.now() / 1000) + 3600,
    };

    if (userId) {
      params.userToken = userId;
    }

    return this.client.generateSecuredApiKey(searchKey, params);
  }

  // 2. THÊM HÀM MỚI NÀY: Đồng bộ cấu hình bộ lọc lên Algolia
  async updateFacetsConfig(filterableCodes: string[]) {
    // Các bộ lọc core bắt buộc phải có
    const baseFacets = [
      'searchable(categories)',
      'searchable(brand)',
      'searchable(tags)',
      'filterOnly(status)',
      'filterOnly(is_deleted)',
    ];

    // Map các code thuộc tính động từ DB (VD: attributes.color, attributes.size)
    // Dùng 'searchable()' để Frontend có thể làm thanh search nhỏ bên trong bộ lọc (nếu list quá dài)
    const dynamicFacets = filterableCodes.map(
      (code) => `searchable(attributes.${code})`,
    );

    const finalFacets = [...baseFacets, ...dynamicFacets];

    // Cập nhật settings của Index trên Algolia
    await this.index.setSettings({
      attributesForFaceting: finalFacets,
    });

    console.log(
      '[Algolia] Đã đồng bộ cấu hình Facets thành công:',
      dynamicFacets,
    );
  }

  async clearAllProducts() {
    try {
      await this.index.clearObjects();
      console.log('[Algolia] Đã xóa sạch dữ liệu trên Index.');
      return { message: 'Dữ liệu đã được làm sạch.' };
    } catch (error) {
      console.error('[Algolia] Lỗi khi xóa Index:', error);
      throw error;
    }
  }
}
