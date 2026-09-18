import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectPinoLogger(FavoritesService.name)
    private readonly logger: PinoLogger,
  ) {}

  create(createFavoriteDto: CreateFavoriteDto) {
    this.logger.debug({ operation: 'create' }, 'Favorite scaffold method completed without persistence');
    return 'This action adds a new favorite';
  }

  findAll() {
    this.logger.debug({ operation: 'findAll' }, 'Favorite scaffold method completed without persistence');
    return `This action returns all favorites`;
  }

  findOne(id: number) {
    this.logger.debug({ favoriteId: id, operation: 'findOne' }, 'Favorite scaffold method completed without persistence');
    return `This action returns a #${id} favorite`;
  }

  update(id: number, updateFavoriteDto: UpdateFavoriteDto) {
    this.logger.debug({ favoriteId: id, operation: 'update' }, 'Favorite scaffold method completed without persistence');
    return `This action updates a #${id} favorite`;
  }

  remove(id: number) {
    this.logger.debug({ favoriteId: id, operation: 'remove' }, 'Favorite scaffold method completed without persistence');
    return `This action removes a #${id} favorite`;
  }
}
