import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { InsuranceBetAdminController } from './insurance-bet-admin.controller';
import { InsuranceBetService } from './insurance-bet.service';
import { PublicInsuranceBetController } from './public-insurance-bet.controller';

@Module({
  imports: [AdminModule],
  controllers: [InsuranceBetAdminController, PublicInsuranceBetController],
  providers: [InsuranceBetService],
  exports: [InsuranceBetService],
})
export class InsuranceBetModule {}
