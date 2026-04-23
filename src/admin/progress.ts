export class Progress {
  total: number;
  current: number;
  width: number;
  completed: string;
  uncompleted: string;
  lastLogIndex: number;
  logInterval: number;
  isCI: boolean;

  constructor(total: number) {
    this.completed = '.';
    this.uncompleted = ' ';
    this.total = total;
    this.current = 0;
    this.width = 60;
    this.lastLogIndex = 0;
    this.logInterval = Math.max(1, Math.floor(total / 100));
    this.isCI = !!process.env.CI;
  }

  update(current: number) {
    this.current = current;

    if (this.isCI && current - this.lastLogIndex < this.logInterval && current !== this.total) {
      return;
    }

    this.lastLogIndex = current;

    const dots = this.completed.repeat(
      ((this.current % this.total) / this.total) * this.width
    );
    const left =
      this.width - ((this.current % this.total) / this.total) * this.width;
    const empty = this.uncompleted.repeat(left);
    const ratio = Math.round((this.current / this.total) * 100);

    if (this.isCI) {
      console.log(`[${dots}${empty}] ${ratio}%`);
    } else {
      process.stdout.write(`\r[${dots}${empty}] ${ratio}%`);
    }
  }
}
