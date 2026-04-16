import { Module } from '@nestjs/common';
import { WarrantyModule } from './warranty/warranty.module';
// import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    // ChatModule,
    WarrantyModule,
  ],
  controllers: [],
  providers: [],
  exports: [WarrantyModule],
})
export class SupportModule {}
