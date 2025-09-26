import { snowflakeMid } from './snowflake-mid.util';

export class UniqueIDGenerator {
  static generate(): string {
    const timestamp = Date.now();
    const nanoTime = Number(process.hrtime.bigint() % 1000000n);
    const machineId = snowflakeMid;
    const random = Math.floor(Math.random() * 10000);

    return `${timestamp}${machineId.toString().padStart(3, '0')}${nanoTime.toString().padStart(6, '0')}${random.toString().padStart(4, '0')}`;
  }
}
