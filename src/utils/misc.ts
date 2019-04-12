export function mem() {
  const usg = process.memoryUsage();
  return `rss: ${mb(usg.rss)}, heap: ${mb(usg.heapUsed)}`;
}

export function mb(size: number) {
  const kb = size / 1024;
  if (kb < 1025) return kb.toFixed(0) + ' KB';
  return (kb / 1024).toFixed(3) + ' MB';
}
