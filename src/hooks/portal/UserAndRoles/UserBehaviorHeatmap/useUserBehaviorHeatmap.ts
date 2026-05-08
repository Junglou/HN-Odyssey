import { useState, useEffect } from "react";
import axiosClient from "../../../../api/axiosClient";

export type DeviceType = "Desktop" | "Mobile" | "Tablet";
export type InteractionType = string; // Đổi thành string linh động từ BE trả về

export function useUserBehaviorHeatmap() {
  // State filter
  const [selectedPage, setSelectedPage] = useState<string>("");
  const [device, setDevice] = useState<DeviceType>("Desktop");
  const [interactionType, setInteractionType] = useState<InteractionType>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // State lưu danh sách options động từ BE
  const [pageOptions, setPageOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [interactionOptions, setInteractionOptions] = useState<string[]>([]);

  const [stats, setStats] = useState({
    visits: "0",
    clicks: "0",
    duration: "0s",
  });

  // Gọi API lấy danh sách Filters động ngay khi vào trang
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const response = await axiosClient.get(
          "/admin/reports/business/behavior-filters",
        );
        const data = response.data?.data || response.data;

        if (data.pages) setPageOptions(data.pages);
        if (data.interactions) setInteractionOptions(data.interactions);

        // Gán giá trị mặc định nếu chưa chọn
        if (data.pages?.length > 0) setSelectedPage(data.pages[0].value);
        if (data.interactions?.length > 0)
          setInteractionType(data.interactions[0]);
      } catch (error) {
        console.error("Lỗi khi lấy filters:", error);
      }
    };
    fetchFilters();
  }, []);

  // Tự động gọi API số liệu khi các filter thay đổi
  useEffect(() => {
    if (!selectedPage || !interactionType) return; // Đợi filter load xong mới gọi API

    const fetchStatsData = async () => {
      try {
        setStats({ visits: "...", clicks: "...", duration: "..." });

        const queryParams: Record<string, string> = {
          page: selectedPage,
          device: device,
          interaction_type: interactionType,
        };

        if (startDate) queryParams.start_date = startDate;
        if (endDate) queryParams.end_date = endDate;

        if (startDate && endDate) {
          queryParams.start_date = startDate;
          queryParams.end_date = endDate;
          queryParams.time_filter = "CUSTOM"; // <--- CHÌA KHÓA NẰM Ở ĐÂY
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
      } catch (error) {
        console.error("Lỗi khi lấy dữ liệu User Behavior Heatmap:", error);
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
