// main.ts
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { join } from 'path';
import { AppModule } from './app.module';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

import fastifyCompress from '@fastify/compress';
import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  dotenv.config();

  const fastifyAdapter = new FastifyAdapter({
    logger: false,
    trustProxy: true,
  });

  await fastifyAdapter.getInstance().register(fastifyCompress as any, {
    threshold: 1024,
    encodings: ['gzip', 'deflate'],
    customTypes: /^text\/|^application\/(?!.*\/(x-)?javascript)/,
    removeContentLengthHeader: false,
  });

  await fastifyAdapter.getInstance().register(fastifyHelmet as any, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", "http://localhost:3001"],
      },
    },
    crossOriginEmbedderPolicy: false,
    global: true,
  });

  await fastifyAdapter.getInstance().register(fastifyMultipart as any, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 1024 * 1024,
      fields: 20,
      fileSize: 5 * 1024 * 1024,
      files: 10,
      headerPairs: 2000,
    },
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
    {
      logger: ['error', 'warn', 'log'],
      cors: true, // Habilitar CORS para todas as rotas
    },
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // Configurar pasta pública para servir arquivos estáticos
  app.useStaticAssets({
    root: path.join(__dirname, '..', 'public'),
    prefix: '/public',
  });

  // Configuração do Swagger
  const config = new DocumentBuilder()
    .setTitle('Payment API')
    .setDescription('API Documentation for Payment System')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey(
      { type: 'apiKey', name: 'x-api-key-public', in: 'header' },
      'publicKey',
    )
    .addApiKey(
      { type: 'apiKey', name: 'x-api-key-secret', in: 'header' },
      'secretKey',
    )
    .addServer('http://localhost:3001', 'Local Development')
    .addServer('https://api.staging.example.com', 'Staging')
    .addServer('https://api.example.com', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Registra o Swagger com Fastify
  // SwaggerModule.setup('documentation', app, document, {
  //   swaggerOptions: {
  //     docExpansion: 'list',
  //     deepLinking: true,
  //   },
  // });
    // Configuração do endpoint para servir o JSON do Swagger
    app.getHttpAdapter().get('/api/public-docs-json', (req, res) => {
      // Adicionar cabeçalhos CORS específicos para esta rota
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
      res.send(document);
    });
  
    // Configuração do endpoint para servir o HTML com RapiDoc
    app.getHttpAdapter().get('/documentation', (req, res) => {
      const templatePath = path.join(__dirname, '..', 'public', 'templates', 'rapidoc.html');
      const html = fs.readFileSync(templatePath, 'utf8');
      // Adicionar cabeçalhos CORS específicos para esta rota
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
      res.type('text/html').send(html);
    });

  // await app.register(fastifySwagger as any, {
  //   swagger: document,
  //   prefix: '/documentation',
  // });

  // await app.register(fastifySwaggerUi as any, {
  //   routePrefix: '/documentation',
  //   uiConfig: {
  //     docExpansion: 'list',
  //     deepLinking: true,
  //   },
  //   staticCSP: true,
  //   transformStaticCSP: (header: any) => header,
  // });

  // Validation Pipe Global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Swagger documentation: ${await app.getUrl()}/documentation`);

  // Exporta JSON do Swagger para importar no Postman
  // const fs = require('fs');
  // fs.writeFileSync('./swagger.json', JSON.stringify(document, null, 2));
  // console.log('Swagger JSON exported to ./swagger.json');
}

bootstrap();
