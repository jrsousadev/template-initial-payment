const podName = process.env.POD_NAME || 'unknown-0';
const podHash = podName.split('-').pop() || '0';
let snowflakeMid = '0';

try {
  const cleanHash = podHash.replace(/[^0-9a-fA-F]/g, '');

  if (cleanHash.length >= 3) {
    snowflakeMid = String(parseInt(cleanHash.substring(0, 3), 16) % 1024);
  } else if (cleanHash.length > 0) {
    snowflakeMid = String(parseInt(cleanHash.padEnd(3, '0'), 16) % 1024);
  } else {
    snowflakeMid = String(process.pid % 1024);
  }
} catch (e) {
  snowflakeMid = String(process.pid % 1024);
}
if (snowflakeMid === '0') {
  snowflakeMid = String(Math.floor(Math.random() * (1023 - 10 + 1)) + 10);
}
export { snowflakeMid };
