// hook
export function useLoyaltyLanding() {
  const steps = [
    {
      id: 1,
      title: "1. Sign Up",
      desc: "Create your free Explorer Rewards account in under 2 minutes",
    },
    {
      id: 2,
      title: "2. Shop & Earn",
      desc: "Earn 1 point for every $1 spent on survival gear and clothing",
    },
    {
      id: 3,
      title: "3. Reach Tiers",
      desc: "Unlock higher tiers for better rewards and exclusive benefits",
    },
    {
      id: 4,
      title: "4. Redeem",
      desc: "Use your points for discounts, free gear, and exclusive experiences",
    },
  ];

  const tiers = [
    {
      id: "bronze",
      title: "Bronze Explorer",
      spent: "$0 - $499 spent",
      benefits: [
        "1 point per $1 spent",
        "Birthday discount",
        "Member-only sales",
        "Free shipping on orders $75+",
      ],
    },
    {
      id: "silver",
      title: "Silver Explorer",
      spent: "$500 - $999 spent",
      isPopular: true,
      benefits: [
        "1.25 points per $1 spent",
        "All Bronze benefits",
        "Early access to new products",
        "Free shipping on all orders",
        "Quarterly survival guides",
      ],
    },
    {
      id: "gold",
      title: "Gold Explorer",
      spent: "$1000+ spent",
      benefits: [
        "1.5 points per $1 spent",
        "All Silver benefits",
        "VIP customer support",
        "Exclusive survival workshops",
        "Annual gear testing events",
      ],
    },
  ];

  const rewards = [
    { id: 1, title: "$5 Off", points: "500 points", note: "On orders $50+" },
    {
      id: 2,
      title: "$15 Off",
      points: "1,200 points",
      note: "On orders $100+",
    },
    {
      id: 3,
      title: "Free Multi-Tool",
      points: "2,000 points",
      note: "Premium quality",
    },
    {
      id: 4,
      title: "Survival Workshop",
      points: "5,000 points",
      note: "Expert-led session",
    },
  ];

  const benefits = [
    {
      id: 1,
      title: "Early Access",
      desc: "Be the first to shop new survival gear releases and seasonal collections",
    },
    {
      id: 2,
      title: "Expert Guides",
      desc: "Access exclusive survival guides, tips, and techniques from wilderness experts",
    },
    {
      id: 3,
      title: "Community Access",
      desc: "Join our private community of outdoor enthusiasts and survival experts",
    },
  ];

  return { steps, tiers, rewards, benefits };
}
