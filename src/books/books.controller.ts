<<<<<<< Updated upstream
import { Body, Controller, Delete, Get, Param, ParseEnumPipe, ParseIntPipe, Patch, Post, } from '@nestjs/common';
=======
import { Body, Controller, Get, Param, Post, UseGuards, } from '@nestjs/common';
>>>>>>> Stashed changes

import { BookProviderCode } from '../catalogs/enums/book-provider-code.enum';
import { SearchCatalogDto } from '../catalogs/dto/search-catalog.dto';
<<<<<<< Updated upstream
=======
import type { Language } from '../i18n/i18n.constants';
import { localizedParseEnumPipe, localizedParseIntPipe } from '../i18n/localized-pipes';
import { RequestLanguage } from '../i18n/request-language.decorator';
import { translate } from '../i18n/translate';
import { UserRole } from '../users/enums/user-role.enum';
>>>>>>> Stashed changes
import { BooksService } from './books.service';
import { BookDetailResponseDto } from './dto/book-detail-response.dto';
import { BulkImportBooksDto } from './dto/bulk-import-books.dto';
import { CreateBookDto } from './dto/create-book.dto';
import { ImportBookDto } from './dto/import-book.dto';
<<<<<<< Updated upstream
import { UpdateBookDto } from './dto/update-book.dto';
import type { BulkImportResult, ImportSearchResult } from './interfaces/import-result.interface';
=======
import type { BulkImportResult, FailedImportSummary, ImportSearchResult } from './interfaces/import-result.interface';
>>>>>>> Stashed changes


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
<<<<<<< Updated upstream
    importFromSearch(
=======
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async importFromSearch(
>>>>>>> Stashed changes
        @Body() searchCatalogDto: SearchCatalogDto,
        @RequestLanguage() language: Language,
    ): Promise<ImportSearchResult> {
        const result = await this.booksService.importFromSearch(searchCatalogDto);

        return this.translateFailures(result, language);
    }

    // Guarda todas las obras de un único proveedor (carga masiva), avanzando
    // página a página hasta agotarlas o hasta el límite indicado en `maxPages`.
    @Post('import/providers/:providerCode')
<<<<<<< Updated upstream
    importAllFromProvider(
        @Param('providerCode', new ParseEnumPipe(BookProviderCode))
=======
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async importAllFromProvider(
        @Param('providerCode', localizedParseEnumPipe(BookProviderCode, 'VALIDATION_PROVIDER_INVALID'))
>>>>>>> Stashed changes
        providerCode: BookProviderCode,
        @Body() bulkImportBooksDto: BulkImportBooksDto,
        @RequestLanguage() language: Language,
    ): Promise<BulkImportResult> {
        const result = await this.booksService.importAllFromProvider(
            providerCode,
            bulkImportBooksDto,
        );

        return this.translateFailures(result, language);
    }

    // Guarda todas las obras de todos los proveedores activos.
    @Post('import/all')
<<<<<<< Updated upstream
    importAllFromAllProviders(
=======
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async importAllFromAllProviders(
>>>>>>> Stashed changes
        @Body() bulkImportBooksDto: BulkImportBooksDto,
        @RequestLanguage() language: Language,
    ): Promise<BulkImportResult> {
        const result = await this.booksService.importAllFromAllProviders(bulkImportBooksDto);

        return this.translateFailures(result, language);
    }

    @Get()
    findAll(): Promise<BookDetailResponseDto[]> {
        return this.booksService.findAll();
    }

    @Get(':id')
    findOne(
        @Param('id', localizedParseIntPipe('VALIDATION_BOOK_ID_INTEGER')) id: number,
    ): Promise<BookDetailResponseDto> {
        return this.booksService.findOne(id);
    }

<<<<<<< Updated upstream
    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() updateBookDto: UpdateBookDto) {
        return this.booksService.update(id, updateBookDto);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.booksService.remove(id);
=======
    // El motivo de cada obra que no se pudo guardar va dentro de una
    // respuesta exitosa, así que no pasa por `HttpExceptionFilter`: se
    // traduce aquí.
    private translateFailures<T extends { failed: FailedImportSummary[] }>(
        result: T,
        language: Language,
    ): T {
        return {
            ...result,
            failed: result.failed.map((failure) => ({
                ...failure,
                reason: translate(failure.code, language),
            })),
        };
>>>>>>> Stashed changes
    }
}
