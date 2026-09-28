import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CatalogsModule } from '../catalogs/catalogs.module';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { BookAuthor } from './entities/book-author.entity';
import { BookLanguage } from './entities/book-language.entity';
import { Book } from './entities/book.entity';
import { Language } from './entities/language.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Book, BookAuthor, BookLanguage, Language]),
        // Aporta `CatalogsService`: es la fuente de las obras externas que
        // este módulo persiste, y quien resuelve el `provider_id` de cada una.
        CatalogsModule,
    ],
    controllers: [BooksController],
    providers: [BooksService],
    exports: [BooksService],
})
export class BooksModule { }
