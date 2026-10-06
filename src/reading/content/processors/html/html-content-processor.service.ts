import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { DomUtils, parseDocument } from 'htmlparser2';
import sanitizeHtml from 'sanitize-html';
import { ReadingPageResponseDto } from '../../../dto/reading-page-response.dto';
import { ReadingContentType } from '../../../enums/reading-content-type.enum';
import { TARGET_PAGE_CHARACTERS } from '../../constants/reading-content.constants';




@Injectable()
export class HtmlContentProcessorService {
    process(content: Buffer, pageNumber: number): ReadingPageResponseDto {
        if (pageNumber < 1) {
            throw new UnprocessableEntityException('El número de página debe ser mayor o igual a 1.');
        }

        const sanitizedHtml = this.sanitizeContent(content);
        const pages = this.paginate(sanitizedHtml);
        const page = pages[pageNumber - 1];

        if (page === undefined) {
            throw new UnprocessableEntityException(
                'La página solicitada no existe.',
            );
        }

        return {
            pageNumber,
            contentType: ReadingContentType.HTML,
            content: page,
            hasNextPage: pageNumber < pages.length,
        };
    }

    private sanitize(html: string): string {
        return sanitizeHtml(html, {
            allowedTags: [
                'p',
                'h1',
                'h2',
                'h3',
                'h4',
                'h5',
                'h6',
                'blockquote',
                'ul',
                'ol',
                'li',
                'pre',
                'code',
                'strong',
                'em',
                'b',
                'i',
                'u',
                'br',
                'hr',
            ],
            allowedAttributes: {},
            disallowedTagsMode: 'discard',
        });
    }

    private paginate(html: string): string[] {
        const document = parseDocument(html);

        const blocks = document.children
            .map((node) => ({
                html: DomUtils.getOuterHTML(node),
                textLength: this.getTextLength(node),
            }))
            .filter((block) => block.textLength > 0);

        const pages: string[] = [];
        let currentPage = '';
        let currentLength = 0;

        for (const block of blocks) {
            const separatorLength = currentLength > 0 ? 1 : 0;

            if (
                currentLength > 0 &&
                currentLength + separatorLength + block.textLength >
                TARGET_PAGE_CHARACTERS
            ) {
                pages.push(currentPage);
                currentPage = '';
                currentLength = 0;
            }

            currentPage += block.html;
            currentLength += block.textLength;
        }

        if (currentPage) {
            pages.push(currentPage);
        }

        return pages;
    }

    private getTextLength(node: Parameters<typeof DomUtils.textContent>[0]): number {
        return DomUtils.textContent(node)
            .replace(/\s+/g, ' ')
            .trim()
            .length;
    }

    sanitizeContent(content: Buffer): string {
        const sanitizedHtml = this.sanitize(content.toString('utf8'));

        if (!sanitizedHtml.trim()) {
            throw new UnprocessableEntityException('El libro no contiene contenido HTML legible.');
        }

        return sanitizedHtml;
    }

}