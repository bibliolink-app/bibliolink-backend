import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { localizedError } from '../../../../i18n/localized-error';
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
            throw new UnprocessableEntityException(localizedError('VALIDATION_PAGE_MIN', { min: 1 }));
        }

        const packagePath = await this.getPackagePath(epub);
        const readingOrder = await this.getReadingOrder(epub, packagePath);
        const chapterPath = readingOrder[pageNumber - 1];

        if (!chapterPath) {
            throw new UnprocessableEntityException(localizedError('READING_PAGE_NOT_FOUND'));
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
            localizedError('READING_EPUB_PACKAGE_REFERENCE_INVALID'),
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
                localizedError('READING_EPUB_READING_STRUCTURE_INVALID'),
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
                    localizedError('READING_EPUB_READING_REFERENCE_INVALID'),
                );
            }

            const item = manifestItems.get(idref);

            if (!item) {
                throw new UnprocessableEntityException(
                    localizedError('READING_EPUB_RESOURCE_NOT_FOUND'),
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
                localizedError('READING_EPUB_CHAPTERS_UNSUPPORTED'),
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
                localizedError('READING_EPUB_INTERNAL_REFERENCE_INVALID'),
            );
        }

        if (/^[a-z][a-z0-9+.-]*:/i.test(rawPath) || rawPath.startsWith('//')) {
            throw new UnprocessableEntityException(
                localizedError('READING_EPUB_EXTERNAL_REFERENCE_NOT_ALLOWED'),
            );
        }

        let decodedPath: string;

        try {
            decodedPath = decodeURIComponent(rawPath);
        } catch {
            throw new UnprocessableEntityException(
                localizedError('READING_EPUB_INTERNAL_REFERENCE_INVALID'),
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
                localizedError('READING_EPUB_INTERNAL_PATH_INVALID'),
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
