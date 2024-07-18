export class Progress {
  total: number;
  current: number;
  width: number;
  completed: string;
  uncompleted: string;

  constructor(total: number) {
    this.completed = '.';
    this.uncompleted = ' ';
    this.total = total;
    this.current = 0;
    this.width = 60;
  }
  update(current: number) {
    this.current = current;

    const dots = this.completed.repeat(
      ((this.current % this.total) / this.total) * this.width
    );
    const left =
      this.width - ((this.current % this.total) / this.total) * this.width;
    const empty = this.uncompleted.repeat(left);
    const ratio = Math.round((this.current / this.total) * 100);

    process.stdout.write(`\r[${dots}${empty}] ${ratio}%`);
  }
}
