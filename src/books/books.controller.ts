import { Body, Controller, Get, Param, ParseEnumPipe, ParseIntPipe, Post, UseGuards, } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BookProviderCode } from '../catalogs/enums/book-provider-code.enum';
import { SearchCatalogDto } from '../catalogs/dto/search-catalog.dto';
import { UserRole } from '../users/enums/user-role.enum';
import { BooksService } from './books.service';
import { BookDetailResponseDto } from './dto/book-detail-response.dto';
import { BulkImportBooksDto } from './dto/bulk-import-books.dto';
import { ImportBookDto } from './dto/import-book.dto';
import type { BulkImportResult, ImportSearchResult } from './interfaces/import-result.interface';


@Controller('books')
export class BooksController {
    constructor(private readonly booksService: BooksService) { }

    // Las importaciones escriben en la base y llaman a las APIs externas (una
    // carga masiva puede ocupar la función hasta su tiempo máximo), así que
    // son solo para administradores. Los usuarios agregan obras a través de
    // `POST /favorites/external`, que importa una sola obra si hace falta.

    // Trae una obra puntual de un proveedor y la guarda en `books`.
    @Post('import')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    importByReference(
        @Body() importBookDto: ImportBookDto,
    ): Promise<BookDetailResponseDto> {
        return this.booksService.importByReference(importBookDto);
    }

    // Busca en los proveedores externos (mismos parámetros que
    // `GET /catalogs/search`) y guarda cada obra que devuelva.
    @Post('import/search')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    importFromSearch(
        @Body() searchCatalogDto: SearchCatalogDto,
    ): Promise<ImportSearchResult> {
        return this.booksService.importFromSearch(searchCatalogDto);
    }

    // Guarda todas las obras de un único proveedor (carga masiva), avanzando
    // página a página hasta agotarlas o hasta el límite indicado en `maxPages`.
    @Post('import/providers/:providerCode')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
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
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    importAllFromAllProviders(
        @Body() bulkImportBooksDto: BulkImportBooksDto,
    ): Promise<BulkImportResult> {
        return this.booksService.importAllFromAllProviders(bulkImportBooksDto);
    }

    // La consulta del catálogo local es pública.
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
}
