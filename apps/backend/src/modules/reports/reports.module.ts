import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AdminModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
