// imports
import TradeInHero from "../../components/secondCharm/TradeInHero";
import HowItWorks from "../../components/secondCharm/HowItWorks";
import TradeInForm from "../../components/secondCharm/TradeInForm";
import Features from "../../components/secondCharm/Features";
import FaqSection from "../../components/secondCharm/FaqSection";
import "./SecondCharmPage.css";

// container
export default function SecondCharmPage() {
  // render
  return (
    <div className="second-charm-page-wrapper">
      <TradeInHero />
      <HowItWorks />
      <TradeInForm />
      <Features />
      <FaqSection />
    </div>
  );
}
