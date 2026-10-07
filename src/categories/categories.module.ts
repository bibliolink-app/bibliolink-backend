import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CategoriesController } from './categories.controller';

import { BookCategory } from './entities/book-category.entity';
import { Category } from './entities/category.entity';
import { CategoriesService } from './categories.service';

@Module({
    imports: [TypeOrmModule.forFeature([Category, BookCategory])],
    controllers: [CategoriesController],
    providers: [CategoriesService],
    exports: [CategoriesService],
})
export class CategoriesModule { }