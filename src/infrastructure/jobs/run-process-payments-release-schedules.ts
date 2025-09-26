import { UniqueIDGenerator } from 'src/common/utils/generate-unique-id.util';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

// Configurações de processamento em lote
const BATCH_SIZE = 1000; // Processa 1000 registros por vez
const QUERY_BATCH_SIZE = 5000; // Busca 5000 registros por vez do DB
const INSERT_BATCH_SIZE = 500; // Insere 500 registros por vez no queue

async function runJob(): Promise<void> {
  const startTime = new Date();
  const startExec = Date.now();
  console.log(
    `[${startTime.toISOString()}] Iniciando Create Ledger Checkpoints...`,
  );

  const prisma = new PrismaService();

  let totalProcessed = 0;
  let totalCreated = 0;
  let lastId: string | undefined = undefined;

  try {
    // Loop principal - processa em páginas usando cursor-based pagination
    while (true) {
      // Busca um lote de schedules usando cursor pagination para melhor performance
      const schedules = await prisma.payment_release_schedule.findMany({
        where: {
          scheduled_date: {
            lte: new Date(),
          },
          status: 'SCHEDULED',
          ...(lastId && {
            id: {
              gt: lastId, // Cursor pagination - busca IDs maiores que o último processado
            },
          }),
        },
        select: {
          id: true,
          provider_name: true,
          company_id: true,
        },
        take: QUERY_BATCH_SIZE,
        orderBy: {
          id: 'asc', // Importante para cursor pagination funcionar
        },
      });

      // Se não há mais registros, encerra o loop
      if (schedules.length === 0) {
        break;
      }

      console.log(
        `[${new Date().toISOString()}] Processando lote de ${schedules.length} schedules...`,
      );

      // Processa os schedules em sublotes menores
      for (let i = 0; i < schedules.length; i += BATCH_SIZE) {
        const batch = schedules.slice(
          i,
          Math.min(i + BATCH_SIZE, schedules.length),
        );
        const queueData: Prisma.queueCreateManyInput[] = [];

        // Prepara os dados do queue para este sublote
        for (const schedule of batch) {
          const queueTaskId = UniqueIDGenerator.generate();
          queueData.push({
            id: queueTaskId,
            payload: {
              paymentReleaseScheduleId: schedule.id,
            },
            type: 'SCHEDULED',
            company_id: schedule.company_id,
            description: schedule.provider_name,
          });
        }

        // Insere em sublotes ainda menores para evitar queries muito grandes
        for (let j = 0; j < queueData.length; j += INSERT_BATCH_SIZE) {
          const insertBatch = queueData.slice(
            j,
            Math.min(j + INSERT_BATCH_SIZE, queueData.length),
          );

          if (insertBatch.length > 0) {
            try {
              await prisma.queue.createMany({
                data: insertBatch,
                skipDuplicates: true,
              });
              totalCreated += insertBatch.length;
            } catch (insertError) {
              console.error(
                `[${new Date().toISOString()}] Erro ao inserir sublote de ${insertBatch.length} registros:`,
                insertError,
              );
              // Continua processando outros lotes mesmo se um falhar
            }
          }
        }

        totalProcessed += batch.length;

        // Log de progresso a cada lote processado
        if (totalProcessed % 5000 === 0) {
          console.log(
            `[${new Date().toISOString()}] Progresso: ${totalProcessed} schedules processados, ${totalCreated} queue items criados...`,
          );
        }
      }

      // Atualiza o cursor para a próxima página
      lastId = schedules[schedules.length - 1].id;

      // Pequeno delay entre páginas grandes para dar respiro ao DB (opcional)
      if (schedules.length === QUERY_BATCH_SIZE) {
        await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms de delay
      }
    }

    const endTime = new Date();
    const timeExec = Date.now() - startExec;

    console.log(`[${endTime.toISOString()}] Checkpoints criados com sucesso:`);
    console.log(`  - Total de schedules processados: ${totalProcessed}`);
    console.log(`  - Total de queue items criados: ${totalCreated}`);
    console.log(
      `  - Tempo de execução: ${timeExec}ms (${(timeExec / 1000).toFixed(2)}s)`,
    );
    console.log(
      `  - Média: ${totalProcessed > 0 ? (timeExec / totalProcessed).toFixed(2) : 0}ms por schedule`,
    );

    process.exit(0);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Erro ao criar checkpoints:`,
      error,
    );
    console.error(`  - Processados até o erro: ${totalProcessed}`);
    console.error(`  - Criados até o erro: ${totalCreated}`);
    // Exit with error
    process.exit(1);
  } finally {
    try {
      await prisma.$disconnect();
      console.log(
        `[${new Date().toISOString()}] Prisma disconnected successfully`,
      );
    } catch (disconnectError) {
      console.error(
        `[${new Date().toISOString()}] Error disconnecting Prisma:`,
        disconnectError,
      );
    }
  }
}

// Handle process termination gracefully
process.on('SIGTERM', () => {
  console.log(
    `[${new Date().toISOString()}] SIGTERM received, shutting down gracefully...`,
  );
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(
    `[${new Date().toISOString()}] SIGINT received, shutting down gracefully...`,
  );
  process.exit(0);
});

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error(
    `[${new Date().toISOString()}] Unhandled Rejection at:`,
    promise,
    'reason:',
    reason,
  );
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(
    `[${new Date().toISOString()}] Uncaught Exception thrown:`,
    error,
  );
  process.exit(1);
});

// Run the job immediately when the script starts
console.log(
  `[${new Date().toISOString()}] Starting checkpoint creation job...`,
);
runJob().catch((error) => {
  console.error(`[${new Date().toISOString()}] Fatal error in runJob:`, error);
  process.exit(1);
});
