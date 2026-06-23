export function useSecondCharm() {
  // Dữ liệu cho 3 bước hoạt động
  const steps = [
    {
      id: 1,
      title: "Upload Photos",
      desc: "Take clear photos of your item from multiple angles and upload them to our platform",
    },
    {
      id: 2,
      title: "Choose Evaluation",
      desc: "Select between in-store visit or free shipping for professional assessment",
    },
    {
      id: 3,
      title: "Receive Reward",
      desc: "Get store credit, exclusive vouchers, or after-sales services once the evaluation is complete.",
    },
  ];

  // Dữ liệu cho 4 lý do chọn chương trình
  const features = [
    {
      id: "best_prices",
      title: "Best Prices",
      desc: "Competitive market rates guaranteed",
    },
    {
      id: "fast_process",
      title: "Fast Process",
      desc: "Quick evaluation and payment",
    },
    {
      id: "secure",
      title: "Secure",
      desc: "Safe transactions & data protection",
    },
    {
      id: "eco_friendly",
      title: "Eco-Friendly",
      desc: "Sustainable recycling practices",
    },
  ];

  // Dữ liệu cho phần FAQs
  const faqs = [
    {
      id: 1,
      question: "How long does the evaluation take?",
      answer:
        "In-store evaluations are instant. Shipped items are evaluated within 2-3 business days of receipt.",
    },
    {
      id: 2,
      question: "What payment methods do you offer?",
      answer:
        "We offer direct bank transfer, PayPal, check, or store credit with a 10% bonus.",
    },
    {
      id: 3,
      question: "What if I don't accept the offer?",
      answer:
        "No problem! We'll return your item free of charge if you choose shipping, or you can take it home if you visited a store.",
    },
    {
      id: 4,
      question: "What condition should items be in?",
      answer:
        "We accept items in good to excellent condition. Minor wear is acceptable, but items must be functional.",
    },
  ];

  return { steps, features, faqs };
}
