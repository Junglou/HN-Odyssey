import "./OrderShipping.css";
import OrderShippingNote from "./OrderShippingNote.tsx"

const OrderShipping = () => {
  
  return (
    <div className="box-container">

      <div className="box-content">
        <div className="order-tracking-lbl">
          <span className="lbl-text">Order tracking</span>
        </div>
        <div className="order-tracking-content">
          <OrderShippingNote 
          title={"Order Completed"} 
          date={"26/12/2025"} 
          time={"14:58"}/>
          <OrderShippingNote 
          title={"Order Completed"} 
          date={"26/12/2025"} 
          time={"14:58"}/>
          <OrderShippingNote 
          title={"Order Completed"} 
          date={"26/12/2025"} 
          time={"14:58"}/>
          <OrderShippingNote 
          title={"Order Completed"} 
          date={"26/12/2025"} 
          time={"14:58"}/>
          <OrderShippingNote 
          title={"Order Completed"} 
          date={"26/12/2025"} 
          time={"14:58"}/>
          <OrderShippingNote 
          title={"Order Completed"} 
          date={"26/12/2025"} 
          time={"14:58"}/>
          <OrderShippingNote 
          title={"Order Completed"} 
          date={"26/12/2025"} 
          time={"14:58"}/>
          <OrderShippingNote 
          title={"Order Completed"} 
          date={"26/12/2025"} 
          time={"14:58"}/>
          <OrderShippingNote 
          title={"Order Completed"} 
          date={"26/12/2025"} 
          time={"14:58"}/>
          <OrderShippingNote 
          title={"Order Completed"} 
          date={"26/12/2025"} 
          time={"14:58"}/>
        </div>
      </div>
    </div>
  );
};

export default OrderShipping;
