// imports
import LoyaltyHero from "../../components/loytalty/LoyaltyHero";
import HowItWorks from "../../components/loytalty/HowItWorks";
import MembershipTiers from "../../components/loytalty/MembershipTiers";
import RedeemPoints from "../../components/loytalty/RedeemPoints";
import ExclusiveBenefits from "../../components/loytalty/ExclusiveBenefits";
import "./LoyaltyLandingPage.css";

// container
export default function LoyaltyLandingPage() {
  // render
  return (
    <div className="loyalty-page-wrapper">
      <LoyaltyHero />
      <HowItWorks />
      <MembershipTiers />
      <RedeemPoints />
      <ExclusiveBenefits />
    </div>
  );
}
