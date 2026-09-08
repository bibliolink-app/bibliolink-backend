import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Book } from "./book.entity.js";
import { BooksController } from "./book.controller.js";
import { BooksService } from "./book.service.js";

@Module({
    imports: [TypeOrmModule.forFeature([Book])],
    controllers: [BooksController],
    providers: [BooksService],
})

export class BooksModule {}