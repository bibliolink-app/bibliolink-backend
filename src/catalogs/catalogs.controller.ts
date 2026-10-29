import { Controller, Get, Param, ParseEnumPipe, Query, } from '@nestjs/common';

import { CatalogsService } from './catalogs.service';
import { CatalogBookResponseDto, CatalogSearchResponseDto, } from './dto/catalog-book-response.dto';
import { ExternalBookReferenceDto } from './dto/external-book-reference.dto';
import { SearchCatalogDto } from './dto/search-catalog.dto';
import { BookProvider } from './entities/book-provider.entity';
import { BookProviderCode } from './enums/book-provider-code.enum';
import type { ExternalBook } from './interfaces/external-book.interface';

@Controller('catalogs')
export class CatalogsController {
    constructor(
        private readonly catalogsService: CatalogsService,
    ) { }

    // Proveedores registrados y su estado.
    @Get('providers')
    findAllProviders(): Promise<BookProvider[]> {
        return this.catalogsService.findAllProviders();
    }

    // Busca obras en los proveedores externos.
    @Get('search')
    async search(
        @Query() searchCatalogDto: SearchCatalogDto,
    ): Promise<CatalogSearchResponseDto> {
        const result = await this.catalogsService.search(searchCatalogDto);

        return {
            query: result.query,
            page: result.page,
            pageSize: result.pageSize,
            results: result.results.map((providerPage) => ({
                providerCode: providerPage.providerCode,
                items: providerPage.items.map((book) => this.toBookResponse(book)),
                page: providerPage.page,
                pageSize: providerPage.pageSize,
                totalItems: providerPage.totalItems,
                hasNextPage: providerPage.hasNextPage,
            })),
            unavailableProviders: result.unavailableProviders,
        };
    }

    // Detalle de una obra dentro de un proveedor concreto.
    @Get('providers/:providerCode/book')
    async findExternalBook(
        @Param('providerCode', new ParseEnumPipe(BookProviderCode))
        providerCode: BookProviderCode,
        @Query() externalBookReferenceDto: ExternalBookReferenceDto,
    ): Promise<CatalogBookResponseDto> {
        const book = await this.catalogsService.findExternalBook(
            providerCode,
            externalBookReferenceDto.reference,
        );

        return this.toBookResponse(book);
    }

    // Copia campo por campo solo lo público. `contentReference` y
    // `contentFormat` quedan fuera, y cualquier campo interno que se agregue
    // a `ExternalBook` en el futuro también, salvo que se sume aquí a propósito.
    private toBookResponse(book: ExternalBook): CatalogBookResponseDto {
        return {
            providerCode: book.providerCode,
            externalReference: book.externalReference,
            title: book.title,
            description: book.description,
            coverUrl: book.coverUrl,
            authors: book.authors,
            languageCodes: book.languageCodes,
        };
    }
}
