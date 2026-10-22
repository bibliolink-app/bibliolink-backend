import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { HealthModule } from './../src/health/health.module.js';

// Rutas de salud: son las que se usan para comprobar un despliegue, así que
// se prueban sin base de datos ni servicios externos.
describe('Health (e2e)', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [HealthModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    it.each(['/', '/health'])('GET %s responde que el servicio está vivo', async (path) => {
        const response = await request(app.getHttpServer())
            .get(path)
            .expect(200)
            .expect('Cache-Control', 'no-store');

        expect(response.body).toMatchObject({
            status: 'ok',
            service: 'bibliolink-backend',
        });
        expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
    });

    afterEach(async () => {
        await app.close();
    });
});
