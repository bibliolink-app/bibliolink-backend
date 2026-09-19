import { Module } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { CatalogsController } from './catalogs.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookProvider } from './entities/book-provider.entity';

@Module({
  imports:[TypeOrmModule.forFeature([BookProvider])],
  controllers: [CatalogsController],
  providers: [CatalogsService],
})
export class CatalogsModule {}
