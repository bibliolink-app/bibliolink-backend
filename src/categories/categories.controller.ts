import { Controller, Get, Param, ParseEnumPipe, Query, } from '@nestjs/common';

import { BookCategoryCode } from '../catalogs/enums/book-category-code.enum';
import { CategoriesService } from './categories.service';
import { CategoryBooksResponseDto } from './dto/category-books-response.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { FindCategoryBooksDto } from './dto/find-category-books.dto';

@Controller('categories')
export class CategoriesController {
    constructor(
        private readonly categoriesService: CategoriesService,
    ) { }

    // Taxonomía completa con la cantidad de obras de cada categoría.
    @Get()
    findAll(): Promise<CategoryResponseDto[]> {
        return this.categoriesService.findAll();
    }

    // Obras guardadas de una categoría, paginadas y ordenadas por título.
    @Get(':code/books')
    findBooks(
        @Param('code', new ParseEnumPipe(BookCategoryCode))
        code: BookCategoryCode,
        @Query() findCategoryBooksDto: FindCategoryBooksDto,
    ): Promise<CategoryBooksResponseDto> {
        return this.categoriesService.findBooks(code, findCategoryBooksDto);
    }
}
