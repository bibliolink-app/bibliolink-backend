import { Controller, Get, Param, ParseEnumPipe, Query, } from '@nestjs/common';

import { CatalogsService } from './catalogs.service';
import { ExternalBookReferenceDto } from './dto/external-book-reference.dto';
import { SearchCatalogDto } from './dto/search-catalog.dto';
import { BookProvider } from './entities/book-provider.entity';
import { BookProviderCode } from './enums/book-provider-code.enum';
import type { CatalogSearchResult } from './interfaces/catalog-search-result.interface';
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
    search(
        @Query() searchCatalogDto: SearchCatalogDto,
    ): Promise<CatalogSearchResult> {
        return this.catalogsService.search(searchCatalogDto);
    }

    // Detalle de una obra dentro de un proveedor concreto.
    @Get('providers/:providerCode/book')
    findExternalBook(
        @Param('providerCode', new ParseEnumPipe(BookProviderCode))
        providerCode: BookProviderCode,
        @Query() externalBookReferenceDto: ExternalBookReferenceDto,
    ): Promise<ExternalBook> {
        return this.catalogsService.findExternalBook(
            providerCode,
            externalBookReferenceDto.reference,
        );
    }
}
