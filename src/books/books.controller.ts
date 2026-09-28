import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, } from '@nestjs/common';

import { SearchCatalogDto } from '../catalogs/dto/search-catalog.dto';
import { BooksService } from './books.service';
import { BookDetailResponseDto } from './dto/book-detail-response.dto';
import { CreateBookDto } from './dto/create-book.dto';
import { ImportBookDto } from './dto/import-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import type { ImportSearchResult } from './interfaces/import-result.interface';

@Controller('books')
export class BooksController {
    constructor(private readonly booksService: BooksService) { }

    @Post()
    create(@Body() createBookDto: CreateBookDto) {
        return this.booksService.create(createBookDto);
    }

    // Trae una obra puntual de un proveedor y la guarda en `books`.
    @Post('import')
    importByReference(
        @Body() importBookDto: ImportBookDto,
    ): Promise<BookDetailResponseDto> {
        return this.booksService.importByReference(importBookDto);
    }

    // Busca en los proveedores externos (mismos parámetros que
    // `GET /catalogs/search`) y guarda cada obra que devuelva.
    @Post('import/search')
    importFromSearch(
        @Body() searchCatalogDto: SearchCatalogDto,
    ): Promise<ImportSearchResult> {
        return this.booksService.importFromSearch(searchCatalogDto);
    }

    @Get()
    findAll(): Promise<BookDetailResponseDto[]> {
        return this.booksService.findAll();
    }

    @Get(':id')
    findOne(
        @Param('id', ParseIntPipe) id: number,
    ): Promise<BookDetailResponseDto> {
        return this.booksService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() updateBookDto: UpdateBookDto) {
        return this.booksService.update(id, updateBookDto);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.booksService.remove(id);
    }
}
