import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CatalogsController } from './catalogs.controller';
import { CatalogsService } from './catalogs.service';
import { BOOK_CATALOG_PROVIDERS } from './constants/catalogs.constants';
import { BookProvider } from './entities/book-provider.entity';
import { CatalogHttpService } from './http/catalog-http.service';
import { ArxivProvider } from './providers/arxiv.provider';
import { GutendexProvider } from './providers/gutendex.provider';
import { OpenAlexProvider } from './providers/openalex.provider';
import { StandardEbooksProvider } from './providers/standard-ebooks.provider';

@Module({
    imports: [TypeOrmModule.forFeature([BookProvider])],
    controllers: [CatalogsController],
    providers: [
        CatalogsService,
        CatalogHttpService,
        GutendexProvider,
        StandardEbooksProvider,
        ArxivProvider,
        OpenAlexProvider,
        {
            // Reúne todas las integraciones bajo un mismo token para que el
            // servicio las recorra sin conocerlas una por una. Agregar un
            // proveedor nuevo consiste en implementarlo y sumarlo aquí.
            provide: BOOK_CATALOG_PROVIDERS,
            useFactory: (
                gutendexProvider: GutendexProvider,
                standardEbooksProvider: StandardEbooksProvider,
                arxivProvider: ArxivProvider,
                openAlexProvider: OpenAlexProvider,
            ) => [
                gutendexProvider,
                standardEbooksProvider,
                arxivProvider,
                openAlexProvider,
            ],
            inject: [
                GutendexProvider,
                StandardEbooksProvider,
                ArxivProvider,
                OpenAlexProvider,
            ],
        },
    ],
    exports: [CatalogsService],
})
export class CatalogsModule { }
