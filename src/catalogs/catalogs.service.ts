import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Repository } from 'typeorm';

import { BOOK_CATALOG_PROVIDERS } from './constants/catalogs.constants';
import { BOOK_PROVIDERS_SEED } from './data/book-providers.seed';
import { SearchCatalogDto } from './dto/search-catalog.dto';
import { BookProvider } from './entities/book-provider.entity';
import { BookProviderCode } from './enums/book-provider-code.enum';
import type { BookCatalogProvider } from './interfaces/book-catalog-provider.interface';
import type { CatalogSearchResult } from './interfaces/catalog-search-result.interface';
import type { ExternalBook, ExternalBookPage, } from './interfaces/external-book.interface';

@Injectable()
export class CatalogsService {
    constructor(
        @InjectPinoLogger(CatalogsService.name)
        private readonly logger: PinoLogger,

        @InjectRepository(BookProvider)
        private readonly bookProvidersRepository: Repository<BookProvider>,

        // Todas las integraciones registradas en `CatalogsModule`.
        @Inject(BOOK_CATALOG_PROVIDERS)
        private readonly catalogProviders: BookCatalogProvider[],
    ) { }

    // Registra en `book_providers` los proveedores que el código sabe
    // consultar. Es idempotente: puede ejecutarse en cada seed sin duplicar
    // filas ni pisar el estado `active` que haya definido un administrador.
    async seedProviders(): Promise<void> {
        const existingProviders =
            await this.bookProvidersRepository.find();

        const existingCodes = new Set(
            existingProviders.map((provider) => provider.code),
        );

        const missingProviders = BOOK_PROVIDERS_SEED.filter(
            (provider) => !existingCodes.has(provider.code),
        );

        if (missingProviders.length === 0) {
            this.logger.info(
                'Los proveedores de contenido ya estaban registrados. No se realizarán cambios.',
            );

            return;
        }

        const savedProviders = await this.bookProvidersRepository.save(
            missingProviders.map((provider) =>
                this.bookProvidersRepository.create(provider),
            ),
        );

        this.logger.info(
            { providerCodes: savedProviders.map((provider) => provider.code) },
            'Proveedores de contenido registrados correctamente.',
        );
    }

    // Lista los proveedores tal como están guardados en la base de datos.
    findAllProviders(): Promise<BookProvider[]> {
        this.logger.debug('Listing book providers');

        return this.bookProvidersRepository.find({
            order: { name: 'ASC' },
        });
    }

    // Devuelve el identificador interno de un proveedor. Lo necesitará el
    // módulo de libros para llenar la columna `provider_id` de `books`.
    async findProviderIdByCode(
        providerCode: BookProviderCode,
    ): Promise<number> {
        const provider = await this.bookProvidersRepository.findOne({
            where: { code: providerCode },
        });

        if (!provider) {
            throw new NotFoundException(
                `El proveedor "${providerCode}" no está registrado. Ejecute el seed de proveedores.`,
            );
        }

        return provider.providerId;
    }

    // Busca obras en uno o en todos los proveedores activos.
    async search(
        searchCatalogDto: SearchCatalogDto,
    ): Promise<CatalogSearchResult> {
        const query = searchCatalogDto.query ?? '';

        const providers = searchCatalogDto.provider
            ? [await this.resolveProvider(searchCatalogDto.provider)]
            : await this.resolveActiveProviders();

        const criteria = {
            query,
            language: searchCatalogDto.language,
            page: searchCatalogDto.page,
            pageSize: searchCatalogDto.pageSize,
        };

        // `allSettled` evita que la caída de una API externa deje sin
        // resultados a las demás.
        const settledPages = await Promise.allSettled(
            providers.map((provider) => provider.search(criteria)),
        );

        const results: ExternalBookPage[] = [];
        const unavailableProviders: string[] = [];

        settledPages.forEach((settledPage, index) => {
            const providerCode = providers[index]!.code;

            if (settledPage.status === 'fulfilled') {
                results.push(settledPage.value);

                return;
            }

            unavailableProviders.push(providerCode);

            this.logger.warn(
                { err: settledPage.reason, providerCode },
                'El proveedor externo no respondió a la búsqueda del catálogo',
            );
        });

        this.logger.debug(
            {
                operation: 'search',
                providerCount: providers.length,
                unavailableProviders,
            },
            'Catalog search completed',
        );

        return {
            query,
            page: searchCatalogDto.page,
            pageSize: searchCatalogDto.pageSize,
            results,
            unavailableProviders,
        };
    }

    // Recupera una obra puntual de un proveedor a partir de su referencia.
    async findExternalBook(
        providerCode: BookProviderCode,
        externalReference: string,
    ): Promise<ExternalBook> {
        const provider = await this.resolveProvider(providerCode);

        const book = await provider.findByExternalReference(externalReference);

        if (!book) {
            throw new NotFoundException(
                `El proveedor "${providerCode}" no tiene una obra con la referencia indicada.`,
            );
        }

        return book;
    }

    // Busca la implementación de un proveedor y confirma que esté habilitado.
    private async resolveProvider(
        providerCode: BookProviderCode,
    ): Promise<BookCatalogProvider> {
        const provider = this.catalogProviders.find(
            (candidate) => candidate.code === providerCode,
        );

        if (!provider) {
            throw new NotFoundException(
                `El proveedor "${providerCode}" no está soportado.`,
            );
        }

        const storedProvider = await this.bookProvidersRepository.findOne({
            where: { code: providerCode },
        });

        // Un proveedor desactivado por un administrador deja de consultarse.
        if (storedProvider && !storedProvider.active) {
            throw new NotFoundException(
                `El proveedor "${providerCode}" está desactivado.`,
            );
        }

        return provider;
    }

    // Selecciona las integraciones marcadas como activas en la base de datos.
    private async resolveActiveProviders(): Promise<BookCatalogProvider[]> {
        const storedProviders = await this.bookProvidersRepository.find({
            where: { active: true },
        });

        // Antes de ejecutar el seed la tabla está vacía; en ese caso se
        // consultan todas las integraciones disponibles.
        if (storedProviders.length === 0) {
            this.logger.warn(
                'No hay proveedores activos en la base de datos. Se consultarán todas las integraciones disponibles.',
            );

            return [...this.catalogProviders];
        }

        const activeCodes = new Set(
            storedProviders.map((provider) => provider.code),
        );

        return this.catalogProviders.filter((provider) =>
            activeCodes.has(provider.code),
        );
    }
}
