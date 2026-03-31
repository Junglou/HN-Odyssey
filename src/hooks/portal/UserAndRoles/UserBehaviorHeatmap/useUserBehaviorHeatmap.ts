import { useState, useEffect } from "react";

// type
export type DeviceType = "Desktop" | "Mobile" | "Tablet";
export type InteractionType = "Click" | "Scroll" | "Hover";

// mock data
const DEFAULT_STATS = {
  visits: "15,240",
  clicks: "4,580",
  duration: "3m 45s",
};

const STATS_DATA_MAP: Record<InteractionType, typeof DEFAULT_STATS> = {
  Click: { visits: "15,240", clicks: "4,580", duration: "3m 45s" },
  Scroll: { visits: "12,100", clicks: "1,200", duration: "4m 10s" },
  Hover: { visits: "18,500", clicks: "8,900", duration: "2m 30s" },
};

export function useUserBehaviorHeatmap() {
  // state filter
  const [selectedPage, setSelectedPage] =
    useState<string>("Homepage (Current)");
  const [device, setDevice] = useState<DeviceType>("Desktop");
  const [interactionType, setInteractionType] =
    useState<InteractionType>("Click");

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [stats, setStats] = useState(DEFAULT_STATS);

  // tự động cập nhật số liệu filter
  useEffect(() => {
    const fetchStatsData = () => {
      setStats(STATS_DATA_MAP[interactionType]);
    };
    fetchStatsData();
  }, [selectedPage, device, interactionType, startDate, endDate]);

  return {
    selectedPage,
    setSelectedPage,
    device,
    setDevice,
    interactionType,
    setInteractionType,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    stats,
  };
}
