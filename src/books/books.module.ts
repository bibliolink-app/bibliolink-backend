import { Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from './entities/book.entity';
import { Language } from './entities/language.entity';
import { BookLanguage } from './entities/book-language.entity';
import { BookAuthor } from './entities/book-author.entity';

@Module({
   imports: [TypeOrmModule.forFeature([Book, BookAuthor, BookLanguage, Language])],
  controllers: [BooksController],
  providers: [BooksService],
})
export class BooksModule {}
