import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*', // Cấu hình lại domain frontend khi deploy thực tế
  },
  namespace: 'inventory', // Frontend sẽ kết nối tới wss://domain/inventory
})
export class StockGateway {
  @WebSocketServer()
  server: Server;

  // Hàm để StockService gọi khi có thay đổi dữ liệu
  emitStockUpdate(productId: string, sku: string, newStock: number) {
    this.server.emit('stock_updated', {
      product_id: productId,
      sku: sku,
      new_stock: newStock,
      timestamp: new Date().toISOString(),
    });
  }
}
