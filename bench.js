const { performance } = require('perf_hooks');

const count = 10000;
const dates = Array.from({ length: count }, () => new Date());

const start1 = performance.now();
for (let i = 0; i < count; i++) {
  dates[i].toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
const end1 = performance.now();

const formatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
const start2 = performance.now();
for (let i = 0; i < count; i++) {
  formatter.format(dates[i]);
}
const end2 = performance.now();

console.log(`Original: ${end1 - start1} ms`);
console.log(`Optimized: ${end2 - start2} ms`);
