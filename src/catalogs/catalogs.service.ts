import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CreateCatalogDto } from './dto/create-catalog.dto';
import { UpdateCatalogDto } from './dto/update-catalog.dto';

@Injectable()
export class CatalogsService {
  constructor(
    @InjectPinoLogger(CatalogsService.name)
    private readonly logger: PinoLogger,
  ) {}

  create(createCatalogDto: CreateCatalogDto) {
    this.logger.debug({ operation: 'create' }, 'Catalog scaffold method completed without persistence');
    return 'This action adds a new catalog';
  }

  findAll() {
    this.logger.debug({ operation: 'findAll' }, 'Catalog scaffold method completed without persistence');
    return `This action returns all catalogs`;
  }

  findOne(id: number) {
    this.logger.debug({ providerId: id, operation: 'findOne' }, 'Catalog scaffold method completed without persistence');
    return `This action returns a #${id} catalog`;
  }

  update(id: number, updateCatalogDto: UpdateCatalogDto) {
    this.logger.debug({ providerId: id, operation: 'update' }, 'Catalog scaffold method completed without persistence');
    return `This action updates a #${id} catalog`;
  }

  remove(id: number) {
    this.logger.debug({ providerId: id, operation: 'remove' }, 'Catalog scaffold method completed without persistence');
    return `This action removes a #${id} catalog`;
  }
}
