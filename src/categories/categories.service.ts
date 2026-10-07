import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CategoryResponseDto } from './dto/category-response.dto';
import { BookCategory } from './entities/book-category.entity';

@Injectable()
export class CategoriesService {
    constructor(
        @InjectRepository(Category)
        private readonly categoriesRepository: Repository<Category>,
    ) { }


    async findAll(): Promise<CategoryResponseDto[]> {
        const rows = await this.categoriesRepository
            .createQueryBuilder('category')
            .leftJoin(
                BookCategory,
                'bookCategory',
                'bookCategory.category_id = category.category_id',
            )
            .select('category.category_id', 'categoryId')
            .addSelect('category.name', 'name')
            .addSelect('COUNT(bookCategory.book_id)', 'bookCount')
            .groupBy('category.category_id')
            .orderBy('bookCount', 'DESC')
            .addOrderBy('category.name', 'ASC')
            .getRawMany<{ categoryId: number; name: string; bookCount: string }>();

  
        return rows.map((row) => ({
            categoryId: Number(row.categoryId),
            name: row.name,
            bookCount: Number(row.bookCount),
        }));
    }
}