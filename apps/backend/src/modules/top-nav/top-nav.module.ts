import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { PublicTopNavItemController } from './public-top-nav-item.controller';
import { TopNavItemAdminController } from './top-nav-item-admin.controller';
import { TopNavItemService } from './top-nav-item.service';

@Module({
  imports: [AdminModule],
  controllers: [TopNavItemAdminController, PublicTopNavItemController],
  providers: [TopNavItemService],
  exports: [TopNavItemService],
})
export class TopNavModule {}
