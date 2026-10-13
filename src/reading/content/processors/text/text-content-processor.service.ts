import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ReadingPageResponseDto } from '../../../dto/reading-page-response.dto';
import { ReadingContentType } from '../../../enums/reading-content-type.enum';
import { TARGET_PAGE_CHARACTERS } from '../../constants/reading-content.constants';




@Injectable()
export class TextContentProcessorService {
    process(content: Buffer, pageNumber: number): ReadingPageResponseDto {
        if (pageNumber < 1) {
            throw new UnprocessableEntityException('El número de página debe ser mayor o igual a 1.');
        }

        const text = content
            .toString('utf8')
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .trim();

        if (!text) {
            throw new UnprocessableEntityException('El libro no contiene texto legible.');
        }

        const pages = this.paginate(text);
        const page = pages[pageNumber - 1];

        if (page === undefined) {
            throw new UnprocessableEntityException('La página solicitada no existe.');
        }

        return {
            pageNumber,
            contentType: ReadingContentType.HTML,
            content: this.toSafeHtml(page),
            hasNextPage: pageNumber < pages.length,
        };
    }

    private paginate(text: string): string[] {
        const paragraphs = text
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean);

        const pages: string[] = [];
        let currentPage = '';

        for (const paragraph of paragraphs) {
            if (
                currentPage.length > 0 &&
                currentPage.length + paragraph.length + 2 > TARGET_PAGE_CHARACTERS
            ) {
                pages.push(currentPage);
                currentPage = '';
            }

            if (paragraph.length > TARGET_PAGE_CHARACTERS) {
                const fragments = this.splitLongParagraph(paragraph);

                for (const fragment of fragments) {
                    if (currentPage) {
                        pages.push(currentPage);
                        currentPage = '';
                    }

                    pages.push(fragment);
                }

                continue;
            }

            currentPage = currentPage
                ? `${currentPage}\n\n${paragraph}`
                : paragraph;
        }

        if (currentPage) {
            pages.push(currentPage);
        }

        return pages;
    }

    private splitLongParagraph(paragraph: string): string[] {
        const fragments: string[] = [];
        let remaining = paragraph;

        while (remaining.length > TARGET_PAGE_CHARACTERS) {
            let splitAt = remaining.lastIndexOf(' ', TARGET_PAGE_CHARACTERS);

            if (splitAt <= 0) {
                splitAt = TARGET_PAGE_CHARACTERS;
            }

            fragments.push(remaining.slice(0, splitAt).trim());
            remaining = remaining.slice(splitAt).trim();
        }

        if (remaining) {
            fragments.push(remaining);
        }

        return fragments;
    }

    private toSafeHtml(text: string): string {
        return text
            .split(/\n{2,}/)
            .map((paragraph) => `<p>${this.escapeHtml(paragraph)}</p>`)
            .join('');
    }

    private escapeHtml(value: string): string {
        return value
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }
}