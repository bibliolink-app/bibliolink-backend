import { Injectable, UnprocessableEntityException } from '@nestjs/common';

import { BookContentFormat } from '../../catalogs/enums/book-content-format.enum';
import { ReadingPageResponseDto } from '../dto/reading-page-response.dto';
import { EpubContentProcessorService } from './processors/epub/epub-content-processor.service';
import { HtmlContentProcessorService } from './processors/html/html-content-processor.service';
import { PdfContentProcessorService } from './processors/pdf/pdf-content-processor.service';
import { TextContentProcessorService } from './processors/text/text-content-processor.service';
import { ReadingContentFetcherService } from './reading-content-fetcher.service';

@Injectable()
export class ReadingContentService {
    constructor(
        private readonly readingContentFetcherService: ReadingContentFetcherService,
        private readonly textContentProcessorService: TextContentProcessorService,
        private readonly htmlContentProcessorService: HtmlContentProcessorService,
        private readonly epubContentProcessorService: EpubContentProcessorService,
        private readonly pdfContentProcessorService: PdfContentProcessorService,
    ) { }

    async getPage(contentReference: string, contentFormat: BookContentFormat, pageNumber: number): Promise<ReadingPageResponseDto> {
        const content = await this.readingContentFetcherService.fetchContent(contentReference);

        switch (contentFormat) {
            case BookContentFormat.TEXT:
                return this.textContentProcessorService.process(content, pageNumber);
            case BookContentFormat.HTML:
                return this.htmlContentProcessorService.process(content, pageNumber);
            case BookContentFormat.EPUB:
                return this.epubContentProcessorService.process(content, pageNumber);
            case BookContentFormat.PDF:
                return this.pdfContentProcessorService.process(content, pageNumber);
            case BookContentFormat.EXTERNAL_PAGE:
            case BookContentFormat.UNSUPPORTED:
                throw new UnprocessableEntityException('El formato del contenido no es compatible con el lector.');
        }
    }
}