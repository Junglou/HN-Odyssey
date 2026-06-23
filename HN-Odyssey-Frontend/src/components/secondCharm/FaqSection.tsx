import { useState } from "react";
import { useSecondCharm } from "../../hooks/secondCharm/useSecondCharm";
import { ChevronDownSolidIcon } from "../../assets/icons/SecondCharmIcons";
import "./FaqSection.css";

export default function FaqSection() {
  const { faqs } = useSecondCharm();
  const [openId, setOpenId] = useState<number | null>(null);

  const toggleFaq = (id: number) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <section className="sc-faq-section">
      <div className="sc-faq-container">
        <h2 className="sc-faq-title">Frequently Asked Questions</h2>

        <div className="sc-faq-list">
          {faqs.map((faq) => (
            <div
              key={faq.id}
              className={`sc-faq-item ${openId === faq.id ? "open" : ""}`}
              onClick={() => toggleFaq(faq.id)}
            >
              <div className="sc-faq-question-box">
                <div className="sc-faq-question-left">
                  <span className="sc-faq-icon">?</span>
                  <h3 className="sc-faq-question">{faq.question}</h3>
                </div>
                <ChevronDownSolidIcon className="sc-faq-toggle-icon" />
              </div>

              <div className="sc-faq-answer-wrapper">
                <p className="sc-faq-answer">{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
