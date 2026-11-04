import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { localizedError } from '../../../../i18n/localized-error';
import yauzl, { type Entry, type ZipFile } from 'yauzl';

import { envs } from '../../../../config/envs';

@Injectable()
export class EpubArchiveService {
    async readEntry(epub: Buffer, entryName: string): Promise<Buffer> {
        const zipFile = await this.open(epub);

        try {
            return await this.findAndReadEntry(zipFile, entryName);
        } finally {
            zipFile.close();
        }
    }

    private open(epub: Buffer): Promise<ZipFile> {
        return new Promise((resolve, reject) => {
            yauzl.fromBuffer(
                epub,
                {
                    lazyEntries: true,
                    validateEntrySizes: true,
                },
                (error, zipFile) => {
                    if (error || !zipFile) {
                        reject(
                            new UnprocessableEntityException(
                                localizedError('READING_EPUB_INVALID'),
                            ),
                        );
                        return;
                    }

                    resolve(zipFile);
                },
            );
        });
    }

    private findAndReadEntry(
        zipFile: ZipFile,
        entryName: string,
    ): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            zipFile.readEntry();

            zipFile.on('entry', (entry: Entry) => {
                if (entry.fileName !== entryName) {
                    zipFile.readEntry();
                    return;
                }

                if (entry.uncompressedSize > envs.reading.contentMaxBytes) {
                    reject(
                        new UnprocessableEntityException(
                            localizedError('READING_EPUB_ENTRY_TOO_LARGE'),
                        ),
                    );
                    return;
                }

                zipFile.openReadStream(entry, (error, stream) => {
                    if (error || !stream) {
                        reject(
                            new UnprocessableEntityException(
                                localizedError('READING_EPUB_ENTRY_READ_FAILED'),
                            ),
                        );
                        return;
                    }

                    const chunks: Buffer[] = [];
                    let totalBytes = 0;

                    stream.on('data', (chunk: Buffer) => {
                        totalBytes += chunk.length;

                        if (totalBytes > envs.reading.contentMaxBytes) {
                            reject(
                                new UnprocessableEntityException(
                                    localizedError('READING_EPUB_ENTRY_TOO_LARGE'),
                                ),
                            );

                            stream.destroy();
                            return;
                        }

                        chunks.push(chunk);
                    });

                    stream.on('end', () => {
                        resolve(Buffer.concat(chunks, totalBytes));
                    });

                    stream.on('error', () => {
                        reject(
                            new UnprocessableEntityException(
                                localizedError('READING_EPUB_ENTRY_READ_FAILED'),
                            ),
                        );
                    });
                });
            });

            zipFile.on('end', () => {
                reject(
                    new UnprocessableEntityException(
                        localizedError('READING_EPUB_ENTRY_NOT_FOUND', { entryName }),
                    ),
                );
            });

            zipFile.on('error', () => {
                reject(
                    new UnprocessableEntityException(
                        localizedError('READING_EPUB_STRUCTURE_PROCESSING_FAILED'),
                    ),
                );
            });
        });
    }
}
