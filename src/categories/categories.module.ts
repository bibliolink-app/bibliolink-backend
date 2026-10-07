import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BooksModule } from '../books/books.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { BookCategory } from './entities/book-category.entity';
import { Category } from './entities/category.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Category, BookCategory]),
        // Arma las obras de cada categoría (`GET /categories/:code/books`).
        BooksModule,
    ],
    controllers: [CategoriesController],
    providers: [CategoriesService],
    exports: [CategoriesService],
})
export class CategoriesModule { }
