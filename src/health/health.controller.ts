import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

interface HealthResponse {
    status: 'ok';
    service: string;
    timestamp: string;
}

// Rutas para comprobar que el despliegue está vivo. No consultan la base de
// datos ni servicios externos: responden aunque estos fallen, así que un error
// aquí indica que la función misma no arranca.
@Controller()
@SkipThrottle()
export class HealthController {
    // Antes la raíz respondía 404 y, al abrir la URL del despliegue en el
    // navegador, parecía que la app estaba caída.
    @Get()
    @Header('Cache-Control', 'no-store')
    root(): HealthResponse {
        return this.status();
    }

    @Get('health')
    @Header('Cache-Control', 'no-store')
    health(): HealthResponse {
        return this.status();
    }

    private status(): HealthResponse {
        return {
            status: 'ok',
            service: 'bibliolink-backend',
            timestamp: new Date().toISOString(),
        };
    }
}
