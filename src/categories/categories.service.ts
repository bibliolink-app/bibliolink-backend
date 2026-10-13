import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Repository } from 'typeorm';

import { BooksService } from '../books/books.service';
import { BookCategoryCode } from '../catalogs/enums/book-category-code.enum';
import { CategoryBooksResponseDto } from './dto/category-books-response.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { FindCategoryBooksDto } from './dto/find-category-books.dto';
import { BookCategory } from './entities/book-category.entity';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
    constructor(
        @InjectPinoLogger(CategoriesService.name)
        private readonly logger: PinoLogger,

        @InjectRepository(Category)
        private readonly categoriesRepository: Repository<Category>,

        // Arma las obras de una categoría con sus autores, idiomas y categorías.
        private readonly booksService: BooksService,
    ) { }

    // Lista toda la taxonomía con la cantidad de obras de cada categoría, de
    // la más usada a la menos usada. Incluye las que todavía no tienen obras.
    async findAll(): Promise<CategoryResponseDto[]> {
        const rows = await this.categoriesRepository
            .createQueryBuilder('category')
            .leftJoin(
                BookCategory,
                'bookCategory',
                'bookCategory.category_id = category.category_id',
            )
            .select('category.category_id', 'categoryId')
            .addSelect('category.code', 'code')
            .addSelect('category.name', 'name')
            .addSelect('COUNT(bookCategory.book_id)', 'bookCount')
            .groupBy('category.category_id')
            .orderBy('bookCount', 'DESC')
            .addOrderBy('category.name', 'ASC')
            .getRawMany<{ categoryId: number; code: BookCategoryCode; name: string; bookCount: string }>();

        // MySQL devuelve `COUNT` como texto; se convierte a número.
        return rows.map((row) => ({
            categoryId: Number(row.categoryId),
            code: row.code,
            name: row.name,
            bookCount: Number(row.bookCount),
        }));
    }

    // Una página de las obras guardadas que pertenecen a una categoría.
    async findBooks(
        code: BookCategoryCode,
        findCategoryBooksDto: FindCategoryBooksDto,
    ): Promise<CategoryBooksResponseDto> {
        this.logger.debug({ code, operation: 'findBooks' }, 'Listing books of a category');

        const category = await this.categoriesRepository.findOne({
            where: { code },
        });

        // El código es válido (lo comprueba el controller), pero la fila no
        // existe: falta correr la migración de la taxonomía.
        if (!category) {
            throw new NotFoundException('La categoría no existe.');
        }

        const { page, pageSize } = findCategoryBooksDto;

        const { items, totalItems } = await this.booksService.findPageByCategoryId(
            category.categoryId,
            page,
            pageSize,
        );

        return {
            category: {
                code: category.code,
                name: category.name,
            },
            page,
            pageSize,
            totalItems,
            hasNextPage: page * pageSize < totalItems,
            items,
        };
    }
}
