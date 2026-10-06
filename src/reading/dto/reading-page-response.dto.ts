import { ReadingContentType } from '../enums/reading-content-type.enum';

export class ReadingPageResponseDto {
    pageNumber!: number;
    contentType!: ReadingContentType;
    content!: string;
    hasNextPage!: boolean;
}