import * as fs from 'fs';
import * as os from 'os';

interface CpuSnapshot {
  idle: number;
  total: number;
}

const SAMPLE_INTERVAL_MS = 2000;

const takeCpuSnapshot = (): CpuSnapshot =>
  os.cpus().reduce<CpuSnapshot>(
    (acc, cpu) => {
      const { user, nice, sys, idle, irq } = cpu.times;
      acc.idle += idle;
      acc.total += user + nice + sys + idle + irq;
      return acc;
    },
    { idle: 0, total: 0 },
  );

let lastSnapshot = takeCpuSnapshot();
let latestCpuPercent = 0;

// Đo CPU bằng chênh lệch thời gian rảnh giữa 2 lần lấy mẫu.
// Không dùng os.loadavg() vì trên Windows hàm này luôn trả về 0.
const sampler = setInterval(() => {
  const current = takeCpuSnapshot();
  const idleDiff = current.idle - lastSnapshot.idle;
  const totalDiff = current.total - lastSnapshot.total;
  if (totalDiff > 0) {
    latestCpuPercent = (1 - idleDiff / totalDiff) * 100;
  }
  lastSnapshot = current;
}, SAMPLE_INTERVAL_MS);
sampler.unref(); // không giữ process sống khi tắt server

const toGb = (bytes: number) => bytes / 1024 ** 3;

export const getCpuUsagePercent = (): number =>
  Number(Math.min(Math.max(latestCpuPercent, 0), 100).toFixed(1));

export const getRamUsage = () => {
  const total = os.totalmem();
  const used = total - os.freemem();
  return {
    percent: Number(((used / total) * 100).toFixed(1)),
    text: `${toGb(used).toFixed(1)}GB / ${toGb(total).toFixed(1)}GB`,
  };
};

export const getDiskUsage = () => {
  try {
    const stat = fs.statfsSync(process.cwd());
    const total = stat.blocks * stat.bsize;
    const used = total - stat.bfree * stat.bsize;
    return {
      percent: total > 0 ? Number(((used / total) * 100).toFixed(1)) : 0,
      text: `${toGb(used).toFixed(1)}GB / ${toGb(total).toFixed(1)}GB`,
    };
  } catch {
    return { percent: 0, text: 'Không thể đọc ổ đĩa' };
  }
};
