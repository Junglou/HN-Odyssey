import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Command, Option } from 'nestjs-command';
import { Model, Types } from 'mongoose';
import {
  AdCampaign,
  AdCampaignDocument,
} from 'src/modules/marketing/campaigns/schemas/ad-campaign.schema';
import {
  AD_SPEND_MIGRATION_NOTE,
  AdSpendEntry,
  AdSpendEntryDocument,
} from 'src/modules/marketing/campaigns/schemas/ad-spend-entry.schema';
import { toVnParts, vnStartOfDay } from 'src/common/utils/date-range.util';
import {
  roundMoney,
  toCents,
  toVnDayIndex,
  vnDayKey,
} from 'src/common/utils/ad-spend-allocation.util';

const vnDayStart = (date: Date): Date => {
  const p = toVnParts(new Date(date));
  return vnStartOfDay(p.y, p.m, p.d);
};

const dayLabel = (date: Date): string => vnDayKey(toVnDayIndex(date));

/**
 * Mục 4.4 báo cáo Ad Spend Ledger: chuyển ad_spend tổng cũ thành 1 dòng nhật ký / chiến dịch.
 * Chạy lại an toàn: chiến dịch đã có dòng "Migrated from legacy total" sẽ bị bỏ qua.
 */
@Injectable()
export class MigrateAdSpendCommand {
  private readonly logger = new Logger(MigrateAdSpendCommand.name);

  constructor(
    @InjectModel(AdCampaign.name)
    private readonly campaignModel: Model<AdCampaignDocument>,
    @InjectModel(AdSpendEntry.name)
    private readonly adSpendModel: Model<AdSpendEntryDocument>,
  ) {}

  @Command({
    command: 'migrate:ad-spend',
    describe:
      'Chuyển ad_spend tổng cũ của chiến dịch thành dòng nhật ký chi phí',
  })
  async migrate(
    @Option({
      name: 'dry-run',
      describe: 'Chỉ in kết quả, không ghi vào DB',
      type: 'boolean',
      default: false,
      required: false,
    })
    dryRun: boolean,
  ): Promise<void> {
    const prefix = dryRun ? '[DRY-RUN] ' : '';
    const today = vnDayStart(new Date());
    const campaigns = await this.campaignModel
      .find({ ad_spend: { $gt: 0 } })
      .select('name ad_spend start_date end_date')
      .lean();

    let created = 0;
    let skipped = 0;

    for (const c of campaigns) {
      const campaignId = new Types.ObjectId(String(c._id));

      const migrated = await this.adSpendModel.exists({
        campaign_id: campaignId,
        note: AD_SPEND_MIGRATION_NOTE,
      });
      if (migrated) {
        skipped++;
        continue;
      }

      // Dòng nhập qua API mới trước khi migrate đã được $inc vào ad_spend → chỉ chuyển phần còn lại
      const [active] = await this.adSpendModel.aggregate<{ total: number }>([
        { $match: { campaign_id: campaignId, is_voided: false } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      const legacy = roundMoney(c.ad_spend - (active?.total ?? 0));
      if (toCents(legacy) <= 0) {
        skipped++;
        continue;
      }

      // Kỳ: start_date → end_date (hoặc hôm nay nếu chưa kết thúc / end_date ở tương lai)
      let periodStart = vnDayStart(c.start_date);
      let periodEnd = c.end_date ? vnDayStart(c.end_date) : today;
      if (periodEnd > today) periodEnd = today;
      if (periodStart > today) periodStart = today;
      if (periodEnd < periodStart) periodEnd = periodStart;

      this.logger.log(
        `${prefix}"${c.name}": $${legacy} (${dayLabel(periodStart)} → ${dayLabel(periodEnd)})`,
      );

      if (!dryRun) {
        await this.adSpendModel.create({
          campaign_id: campaignId,
          amount: legacy,
          period_start: periodStart,
          period_end: periodEnd,
          note: AD_SPEND_MIGRATION_NOTE,
          created_by: null,
        });
      }
      created++;
    }

    this.logger.log(
      `${prefix}Hoàn tất: tạo ${created} dòng, bỏ qua ${skipped} chiến dịch.`,
    );
    if (!dryRun) await this.verifyTotals();
  }

  // Tiêu chí 9: ad_spend (cache) của mọi chiến dịch phải bằng Σ amount các dòng chưa hủy
  private async verifyTotals(): Promise<void> {
    const sums = await this.adSpendModel.aggregate<{
      _id: Types.ObjectId;
      total: number;
    }>([
      { $match: { is_voided: false } },
      { $group: { _id: '$campaign_id', total: { $sum: '$amount' } } },
    ]);
    const sumMap = new Map(sums.map((s) => [String(s._id), s.total]));

    const campaigns = await this.campaignModel
      .find()
      .select('name ad_spend')
      .lean();

    let mismatched = 0;
    for (const c of campaigns) {
      const cache = toCents(c.ad_spend || 0);
      const ledger = toCents(sumMap.get(String(c._id)) ?? 0);
      if (cache !== ledger) {
        mismatched++;
        this.logger.warn(
          `LỆCH "${c.name}": ad_spend = $${cache / 100}, tổng nhật ký = $${ledger / 100}`,
        );
      }
    }

    if (mismatched === 0) {
      this.logger.log(
        'Kiểm tra: ad_spend của mọi chiến dịch khớp tổng nhật ký.',
      );
    }
  }
}
