import { useState, useEffect } from "react";
import axiosClient from "../../../../api/axiosClient";

export type DeviceType = "ALL" | "Desktop" | "Mobile" | "Tablet";
export type InteractionType = string;

export function useUserBehaviorHeatmap() {
  const [selectedPage, setSelectedPage] = useState<string>("ALL");
  const [device, setDevice] = useState<DeviceType>("ALL");
  const [interactionType, setInteractionType] =
    useState<InteractionType>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [pageOptions, setPageOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [interactionOptions, setInteractionOptions] = useState<string[]>([]);

  const [stats, setStats] = useState({
    visits: "0",
    clicks: "0",
    duration: "0s",
  });

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const response = await axiosClient.get(
          "/admin/reports/business/behavior-filters",
        );
        const data = response.data?.data || response.data;

        if (data.pages) {
          setPageOptions([{ label: "ALL", value: "ALL" }, ...data.pages]);
        }
        if (data.interactions) {
          setInteractionOptions(["ALL", ...data.interactions]);
        }
      } catch (error) {
        console.error("Lỗi khi lấy filters:", error);
      }
    };
    fetchFilters();
  }, []);

  useEffect(() => {
    if (!selectedPage || !interactionType) return;

    const fetchStatsData = async () => {
      try {
        setStats({ visits: "...", clicks: "...", duration: "..." });

        const queryParams: Record<string, string> = {};

        if (selectedPage !== "ALL") queryParams.page = selectedPage;
        if (device !== "ALL") queryParams.device = device;
        if (interactionType !== "ALL")
          queryParams.interaction_type = interactionType;

        if (startDate) queryParams.start_date = startDate;
        if (endDate) queryParams.end_date = endDate;

        if (startDate && endDate) {
          queryParams.time_filter = "CUSTOM";
        }

        const response = await axiosClient.get(
          "/admin/reports/business/behavior-abandonment",
          {
            params: queryParams,
          },
        );

        const data = response.data?.data || response.data;

        setStats({
          visits: data?.total_visits?.toLocaleString() || "0",
          clicks: data?.total_clicks?.toLocaleString() || "0",
          duration: data?.avg_duration_seconds
            ? `${Math.floor(data.avg_duration_seconds / 60)}m ${data.avg_duration_seconds % 60}s`
            : data?.avg_duration || "0s",
        });
      } catch {
        setStats({ visits: "0", clicks: "0", duration: "0s" });
      }
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
    pageOptions,
    interactionOptions,
  };
}
