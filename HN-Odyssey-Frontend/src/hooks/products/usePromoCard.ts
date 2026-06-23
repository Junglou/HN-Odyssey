import { useNavigate } from "react-router-dom";

export function usePromoCard(targetUrl: string) {
  const navigate = useNavigate();

  const handleBannerClick = () => {
    if (targetUrl) {
      navigate(targetUrl);
    }
  };

  return {
    handleBannerClick,
  };
}
