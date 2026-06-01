import RecommendationList from "../common/RecommendationList";
import { useProfileRecommendations } from "../../hooks/profile/useProfileRecommendations";
import "./ProfileRecommendations.css";

interface ProfileRecommendationsProps {
  /** Render inside an existing `.section-recs` column (e.g. address page footer links). */
  embedded?: boolean;
}

const ProfileRecommendations = ({
  embedded = false,
}: ProfileRecommendationsProps) => {
  const products = useProfileRecommendations();
  const list = <RecommendationList products={products} />;

  if (embedded) {
    return <div className="profile-recommendations-embedded">{list}</div>;
  }

  return (
    <div className="grid-section section-recs profile-recommendations">
      {list}
    </div>
  );
};

export default ProfileRecommendations;
