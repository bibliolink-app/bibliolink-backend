import { Body, Controller, Delete, Get, Param, ParseEnumPipe, ParseIntPipe, Patch, Post, } from '@nestjs/common';

import { BookProviderCode } from '../catalogs/enums/book-provider-code.enum';
import { SearchCatalogDto } from '../catalogs/dto/search-catalog.dto';
import { BooksService } from './books.service';
import { BookDetailResponseDto } from './dto/book-detail-response.dto';
import { BulkImportBooksDto } from './dto/bulk-import-books.dto';
import { CreateBookDto } from './dto/create-book.dto';
import { ImportBookDto } from './dto/import-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import type { BulkImportResult, ImportSearchResult } from './interfaces/import-result.interface';

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

    // Guarda todas las obras de un único proveedor (carga masiva), avanzando
    // página a página hasta agotarlas o hasta el límite indicado en `maxPages`.
    @Post('import/providers/:providerCode')
    importAllFromProvider(
        @Param('providerCode', new ParseEnumPipe(BookProviderCode))
        providerCode: BookProviderCode,
        @Body() bulkImportBooksDto: BulkImportBooksDto,
    ): Promise<BulkImportResult> {
        return this.booksService.importAllFromProvider(
            providerCode,
            bulkImportBooksDto,
        );
    }

    // Guarda todas las obras de todos los proveedores activos.
    @Post('import/all')
    importAllFromAllProviders(
        @Body() bulkImportBooksDto: BulkImportBooksDto,
    ): Promise<BulkImportResult> {
        return this.booksService.importAllFromAllProviders(bulkImportBooksDto);
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
