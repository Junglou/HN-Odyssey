import "./OrderShippingNote.css";
import { CircleCheck } from 'lucide-react';

interface OrderNoteProp {
  title: string;
  date: string;
  time: string;
}

const OrderShippingNote = ({title, date, time}:OrderNoteProp) => {
  
  return (
    <div className="order-tracking-note">
      <CircleCheck size={40}/>
      <div className="order-tracking-text-container">
        <div className="order-tracking-text">
          <span>{title}</span>
        </div>
        <div className="order-tracking-time">
          <span>{date}</span>
          <span>{time}</span>
        </div>
      </div>
    </div>
  );
};

export default OrderShippingNote;
