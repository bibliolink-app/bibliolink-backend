
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { CatalogsModule } from '../catalogs/catalogs.module';
import { BookCategory } from '../categories/entities/book-category.entity';
import { Category } from '../categories/entities/category.entity';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { BookAuthor } from './entities/book-author.entity';
import { BookLanguage } from './entities/book-language.entity';
import { Book } from './entities/book.entity';
import { Language } from './entities/language.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Book,
            BookAuthor,
            BookLanguage,
            Language,
            Category,
            BookCategory,
        ]),
        CatalogsModule,
        AuthModule,
        PassportModule.register({ session: false }),
    ],
    controllers: [BooksController],
    providers: [BooksService],
    exports: [BooksService],
})
export class BooksModule {}
