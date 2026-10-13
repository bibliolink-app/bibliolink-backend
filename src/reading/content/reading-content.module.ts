import { Module } from '@nestjs/common';

import { EpubArchiveService } from './processors/epub/epub-archive.service';
import { EpubContentProcessorService } from './processors/epub/epub-content-processor.service';
import { HtmlContentProcessorService } from './processors/html/html-content-processor.service';
import { PdfContentProcessorService } from './processors/pdf/pdf-content-processor.service';
import { TextContentProcessorService } from './processors/text/text-content-processor.service';
import { ReadingContentFetcherService } from './reading-content-fetcher.service';
import { ReadingContentService } from './reading-content.service';

@Module({
    providers: [
        ReadingContentService,
        ReadingContentFetcherService,
        TextContentProcessorService,
        HtmlContentProcessorService,
        EpubArchiveService,
        EpubContentProcessorService,
        PdfContentProcessorService,
    ],
    exports: [ReadingContentService],
})
export class ReadingContentModule { }