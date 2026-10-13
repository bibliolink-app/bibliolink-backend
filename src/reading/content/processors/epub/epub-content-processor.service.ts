import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { posix } from 'node:path';
import { XMLParser } from 'fast-xml-parser';

import { ReadingPageResponseDto } from '../../../dto/reading-page-response.dto';
import { ReadingContentType } from '../../../enums/reading-content-type.enum';
import { EpubArchiveService } from './epub-archive.service';
import { HtmlContentProcessorService } from '../html/html-content-processor.service';



type UnknownRecord = Record<string, unknown>;

interface EpubManifestItem {
    href: string;
    mediaType: string;
}

@Injectable()
export class EpubContentProcessorService {
    private readonly xmlParser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        removeNSPrefix: true,
        trimValues: true,
    });

    constructor(
        private readonly epubArchiveService: EpubArchiveService,
        private readonly htmlContentProcessorService: HtmlContentProcessorService,
    ) { }

    async process(epub: Buffer, pageNumber: number): Promise<ReadingPageResponseDto> {
        if (pageNumber < 1) {
            throw new UnprocessableEntityException('El número de página debe ser mayor o igual a 1.');
        }

        const packagePath = await this.getPackagePath(epub);
        const readingOrder = await this.getReadingOrder(epub, packagePath);
        const chapterPath = readingOrder[pageNumber - 1];

        if (!chapterPath) {
            throw new UnprocessableEntityException('La página solicitada no existe.');
        }

        const chapter = await this.epubArchiveService.readEntry(epub, chapterPath);
        const content = this.htmlContentProcessorService.sanitizeContent(chapter);

        return {
            pageNumber,
            contentType: ReadingContentType.HTML,
            content,
            hasNextPage: pageNumber < readingOrder.length,
        };
    }

    private async getPackagePath(epub: Buffer): Promise<string> {
        const container = await this.epubArchiveService.readEntry(
            epub,
            'META-INF/container.xml',
        );

        const parsed: unknown = this.xmlParser.parse(
            container.toString('utf8'),
        );

        const root = this.asRecord(parsed);
        const containerNode = this.asRecord(root?.container);
        const rootfiles = this.asRecord(containerNode?.rootfiles);
        const candidates = this.asArray(rootfiles?.rootfile);

        for (const candidate of candidates) {
            const rootfile = this.asRecord(candidate);

            if (!rootfile) {
                continue;
            }

            const fullPath = rootfile['full-path'];

            if (typeof fullPath === 'string' && fullPath.trim()) {
                return this.normalizeEntryPath(fullPath);
            }
        }

        throw new UnprocessableEntityException(
            'El EPUB no contiene una referencia válida a su paquete principal.',
        );
    }

    private async getReadingOrder(
        epub: Buffer,
        packagePath: string,
    ): Promise<string[]> {
        const packageContent = await this.epubArchiveService.readEntry(
            epub,
            packagePath,
        );

        const parsed: unknown = this.xmlParser.parse(
            packageContent.toString('utf8'),
        );

        const root = this.asRecord(parsed);
        const packageNode = this.asRecord(root?.package);
        const manifest = this.asRecord(packageNode?.manifest);
        const spine = this.asRecord(packageNode?.spine);

        if (!manifest || !spine) {
            throw new UnprocessableEntityException(
                'El EPUB no contiene una estructura de lectura válida.',
            );
        }

        const manifestItems = this.buildManifest(manifest);
        const itemReferences = this.asArray(spine.itemref);
        const readingOrder: string[] = [];

        for (const reference of itemReferences) {
            const itemRef = this.asRecord(reference);

            if (!itemRef) {
                continue;
            }

            if (itemRef.linear === 'no') {
                continue;
            }

            const idref = itemRef.idref;

            if (typeof idref !== 'string') {
                throw new UnprocessableEntityException(
                    'El EPUB contiene una referencia de lectura inválida.',
                );
            }

            const item = manifestItems.get(idref);

            if (!item) {
                throw new UnprocessableEntityException(
                    'El EPUB contiene una referencia a un recurso inexistente.',
                );
            }

            if (
                item.mediaType !== 'application/xhtml+xml' &&
                item.mediaType !== 'text/html'
            ) {
                continue;
            }

            readingOrder.push(
                this.resolvePackageEntryPath(
                    packagePath,
                    item.href,
                ),
            );
        }

        if (readingOrder.length === 0) {
            throw new UnprocessableEntityException(
                'El EPUB no contiene capítulos compatibles con el lector.',
            );
        }

        return readingOrder;
    }

    private buildManifest(
        manifest: UnknownRecord,
    ): Map<string, EpubManifestItem> {
        const items = this.asArray(manifest.item);
        const result = new Map<string, EpubManifestItem>();

        for (const value of items) {
            const item = this.asRecord(value);

            if (!item) {
                continue;
            }

            const id = item.id;
            const href = item.href;
            const mediaType = item['media-type'];

            if (
                typeof id !== 'string' ||
                typeof href !== 'string' ||
                typeof mediaType !== 'string'
            ) {
                continue;
            }

            result.set(id, {
                href,
                mediaType,
            });
        }

        return result;
    }

    private resolvePackageEntryPath(
        packagePath: string,
        href: string,
    ): string {
        const rawPath = href
            .split('#', 1)[0]
            .split('?', 1)[0];

        if (!rawPath) {
            throw new UnprocessableEntityException(
                'El EPUB contiene una referencia interna inválida.',
            );
        }

        if (/^[a-z][a-z0-9+.-]*:/i.test(rawPath) || rawPath.startsWith('//')) {
            throw new UnprocessableEntityException(
                'El EPUB contiene una referencia externa no permitida.',
            );
        }

        let decodedPath: string;

        try {
            decodedPath = decodeURIComponent(rawPath);
        } catch {
            throw new UnprocessableEntityException(
                'El EPUB contiene una referencia interna inválida.',
            );
        }

        const packageDirectory = posix.dirname(packagePath);
        const resolvedPath = posix.normalize(
            posix.join(packageDirectory, decodedPath),
        );

        return this.normalizeEntryPath(resolvedPath);
    }

    private normalizeEntryPath(value: string): string {
        const normalized = posix
            .normalize(value.replaceAll('\\', '/'))
            .replace(/^\.\/+/, '');

        if (
            !normalized ||
            normalized === '..' ||
            normalized.startsWith('../') ||
            normalized.startsWith('/')
        ) {
            throw new UnprocessableEntityException(
                'El EPUB contiene una ruta interna inválida.',
            );
        }

        return normalized;
    }

    private asRecord(value: unknown): UnknownRecord | null {
        if (
            typeof value !== 'object' ||
            value === null ||
            Array.isArray(value)
        ) {
            return null;
        }

        return value as UnknownRecord;
    }

    private asArray(value: unknown): unknown[] {
        if (value === undefined || value === null) {
            return [];
        }

        return Array.isArray(value) ? value : [value];
    }
}