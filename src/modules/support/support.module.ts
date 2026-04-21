import { Module } from '@nestjs/common';
import { WarrantyModule } from './warranty/warranty.module';
import { ChatModule } from './chat/chat.module';
import { PoliciesModule } from './policy/policies.module';

@Module({
  imports: [ChatModule, WarrantyModule, PoliciesModule],
  controllers: [],
  providers: [],
  exports: [WarrantyModule, ChatModule, PoliciesModule],
})
export class SupportModule {}
