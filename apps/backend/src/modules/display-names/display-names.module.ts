import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { DisplayNamesController } from './display-names.controller';
import { DisplayNamesService } from './display-names.service';
import { PublicDisplayNamesController } from './public-display-names.controller';

@Module({
  imports: [AdminModule],
  controllers: [DisplayNamesController, PublicDisplayNamesController],
  providers: [DisplayNamesService],
})
export class DisplayNamesModule {}
