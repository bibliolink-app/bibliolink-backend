import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';

@Injectable()
export class BooksService {
  constructor(
    @InjectPinoLogger(BooksService.name)
    private readonly logger: PinoLogger,
  ) {}

  create(createBookDto: CreateBookDto) {
    this.logger.debug({ operation: 'create' }, 'Book scaffold method completed without persistence');
    return 'This action adds a new book';
  }

  findAll() {
    this.logger.debug({ operation: 'findAll' }, 'Book scaffold method completed without persistence');
    return `This action returns all books`;
  }

  findOne(id: number) {
    this.logger.debug({ bookId: id, operation: 'findOne' }, 'Book scaffold method completed without persistence');
    return `This action returns a #${id} book`;
  }

  update(id: number, updateBookDto: UpdateBookDto) {
    this.logger.debug({ bookId: id, operation: 'update' }, 'Book scaffold method completed without persistence');
    return `This action updates a #${id} book`;
  }

  remove(id: number) {
    this.logger.debug({ bookId: id, operation: 'remove' }, 'Book scaffold method completed without persistence');
    return `This action removes a #${id} book`;
  }
}
