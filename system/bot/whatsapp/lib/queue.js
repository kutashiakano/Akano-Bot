const {EventEmitter: EventEmitter} = require("events");

class Queue extends EventEmitter {
  constructor() {
    super();
    this._queue = new Set;
  }
  add(item) {
    this._queue.add(item);
  }
  has(item) {
    return this._queue.has(item);
  }
  delete(item) {
    return this._queue.delete(item);
  }
  first() {
    return [ ...this._queue ][0];
  }
  isFirst(item) {
    return this.first() === item;
  }
  isEmpty() {
    return this._queue.size === 0;
  }
  unqueue(item) {
    const q = item || this.first();
    if (q) {
      this.delete(q);
      this.emit(q);
    }
  }
  async waitQueue(item, timeout = 6e4) {
    return new Promise((resolve, reject) => {
      if (!this.has(item)) return reject(new Error("not found in queue"));
      if (this.isFirst(item)) {
        setTimeout(() => {
          resolve();
        }, 5e3);
      } else {
        const timer = setTimeout(() => {
          this.delete(item);
          reject(new Error("queue timeout"));
        }, timeout);
        this.once(item, async () => {
          clearTimeout(timer);
          await new Promise(r => setTimeout(r, 5e3));
          resolve();
        });
      }
    });
  }
}

if (!global.msgqueue) global.msgqueue = new Queue;

if (!global.queue) global.queue = global.msgqueue;

module.exports = {
  Queue: Queue
};