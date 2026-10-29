
import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SearchCatalogDto } from '../catalogs/dto/search-catalog.dto';
import { BookProviderCode } from '../catalogs/enums/book-provider-code.enum';
import type { Language } from '../i18n/i18n.constants';
import {
    localizedParseEnumPipe,
    localizedParseIntPipe,
} from '../i18n/localized-pipes';
import { RequestLanguage } from '../i18n/request-language.decorator';
import { translate } from '../i18n/translate';
import { UserRole } from '../users/enums/user-role.enum';

import { BooksService } from './books.service';
import { BookDetailResponseDto } from './dto/book-detail-response.dto';
import { BulkImportBooksDto } from './dto/bulk-import-books.dto';
import { ImportBookDto } from './dto/import-book.dto';
import type {
    BulkImportResult,
    FailedImportSummary,
    ImportSearchResult,
} from './interfaces/import-result.interface';

@Controller('books')
export class BooksController {
    constructor(private readonly booksService: BooksService) {}

    @Post('import')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    importByReference(
        @Body() importBookDto: ImportBookDto,
    ): Promise<BookDetailResponseDto> {
        return this.booksService.importByReference(importBookDto);
    }

    @Post('import/search')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async importFromSearch(
        @Body() searchCatalogDto: SearchCatalogDto,
        @RequestLanguage() language: Language,
    ): Promise<ImportSearchResult> {
        const result = await this.booksService.importFromSearch(
            searchCatalogDto,
        );

        return this.translateFailures(result, language);
    }

    @Post('import/providers/:providerCode')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async importAllFromProvider(
        @Param(
            'providerCode',
            localizedParseEnumPipe(
                BookProviderCode,
                'VALIDATION_PROVIDER_INVALID',
            ),
        )
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

    @Post('import/all')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async importAllFromAllProviders(
        @Body() bulkImportBooksDto: BulkImportBooksDto,
        @RequestLanguage() language: Language,
    ): Promise<BulkImportResult> {
        const result = await this.booksService.importAllFromAllProviders(
            bulkImportBooksDto,
        );

        return this.translateFailures(result, language);
    }

    @Get()
    findAll(): Promise<BookDetailResponseDto[]> {
        return this.booksService.findAll();
    }

    @Get(':id')
    findOne(
        @Param(
            'id',
            localizedParseIntPipe('VALIDATION_BOOK_ID_INTEGER'),
        )
        id: number,
    ): Promise<BookDetailResponseDto> {
        return this.booksService.findOne(id);
    }

    private translateFailures<
        T extends { failed: FailedImportSummary[] },
    >(result: T, language: Language): T {
        return {
            ...result,
            failed: result.failed.map((failure) => ({
                ...failure,
                reason: translate(failure.code, language),
            })),
        };
    }
}
