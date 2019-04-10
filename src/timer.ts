// tslint:disable:no-console

export type Format = 's' | 'm' | 'u' | 'n';

export type Task = (...args: any[]) => any;

export type Callback = (arg?: any) => any;

export class NanoTimer {
  private precision = 25000000;

  // Time reference variables
  private intervalT1: [number, number] = null;
  private timeOutT1: [number, number] = null;
  private intervalCount = 1;

  // Deferred reference indicator variables.
  // Indicate whether the timer used/will use the deferred call. ie - delay/interval > 25ms
  private deferredInterval = false;
  private deferredTimeout = false;

  // Deferred reference variables.
  // Used to clear the native js timeOut calls
  private deferredTimeoutRef: NodeJS.Timer | any = null;
  private deferredIntervalRef: NodeJS.Immediate | any = null;

  // Callback reference variables.
  // Used to be able to still successfully call callbacks when timeouts or intervals are cleared.
  private timeoutCallbackRef: Callback = null;
  private intervalCallbackRef: Callback = null;

  // Immediate reference variables.
  // Used to clear functions scheduled with setImmediate from running in the event timeout/interval is cleared.
  private timeoutImmediateRef: NodeJS.Timer | any = null;
  private intervalImmediateRef: NodeJS.Immediate | any = null;

  private intervalErrorChecked = false;
  // private intervalType = "";
  private intervalTime: number;

  private timeoutTriggered = false;
  private logging: boolean;

  constructor(precision?: number | string, log?: boolean) {
    const version = process.version;
    let major = version.split('.')[0];
    major = major.split('v')[1];
    const minor = version.split('.')[1];

    if ((+major === 0) && (+minor < 10)) {
      console.log('Error: Please update to the latest version of node! This library requires 0.10.x or later');
      process.exit(0);
    }

    this.logging = !!log;

    if (!precision) return;

    // tslint:disable-next-line:no-parameter-reassignment
    precision = (typeof precision === 'number') ? precision + 'm' : precision;
    const delayType = precision.substring(precision.length - 1);

    if (delayType === 's') {
      this.precision = +precision.slice(0, precision.length - 1) * 1000000000;
    } else if (delayType === 'm') {
      this.precision = +precision.slice(0, precision.length - 1) * 1000000;
    } else if (delayType === 'u') {
      this.precision = +precision.slice(0, precision.length - 1) * 1000;
    } else if (delayType === 'n') {
      this.precision = +precision.slice(0, precision.length - 1);
    } else {
      console.log('Error with argument: ' + precision + ': Incorrect precision format. Format is an integer' +
        ' followed by "s" for seconds, "m" for milli, "u" for micro, and "n" for nanoseconds. Ex. 2u');
      process.exit(1);
    }
  }

  public time(task: Task, format: Format, args?: any[], callback?: Callback): [number, number] | number | void {
    // Asynchronous task
    if (callback) {
      const t1 = process.hrtime();
      if (args) {
        args.push(() => {
          const time = process.hrtime(t1);
          if (format === 's') {
            callback(time[0] + time[1] / 1000000000);
          } else if (format === 'm') {
            callback(time[0] * 1000 + time[1] / 1000000);
          } else if (format === 'u') {
            callback(time[0] * 1000000 + time[1] / 1000);
          } else if (format === 'n') {
            callback(time[0] * 1000000000 + time[1]);
          } else {
            callback(time);
          }
        });
        task.apply(null, args);
      } else {
        task(() => {
          const time = process.hrtime(t1);
          if (format === 's') {
            callback(time[0] + time[1] / 1000000000);
          } else if (format === 'm') {
            callback(time[0] * 1000 + time[1] / 1000000);
          } else if (format === 'u') {
            callback(time[0] * 1000000 + time[1] / 1000);
          } else if (format === 'n') {
            callback(time[0] * 1000000000 + time[1]);
          } else {
            callback(time);
          }
        });
      }
      // Synchronous task
    } else {
      const t1 = process.hrtime();
      if (args) {
        task.apply(null, args);
      } else {
        task();
      }
      const t2 = process.hrtime(t1);
      if (format === 's') {
        return t2[0] + t2[1] / 1000000000;
      } else if (format === 'm') {
        return t2[0] * 1000 + t2[1] / 1000000;
      } else if (format === 'u') {
        return t2[0] * 1000000 + t2[1] / 1000;
      } else if (format === 'n') {
        return t2[0] * 1000000000 + t2[1];
      } else {
        return process.hrtime(t1);
      }
    }
  }

  public setInterval(task: Task, interval: number | string, args?: any[], callback?: Callback) {
    // tslint:disable-next-line:no-parameter-reassignment
    interval = (typeof interval === 'number') ? interval + 'm' : interval;
    if (!this.intervalErrorChecked) {
      // Task error handling
      if (!task) {
        console.log('A task function must be specified to setInterval');
        process.exit(1);
      } else {
        if (typeof (task) !== 'function') {
          console.log('Task argument to setInterval must be a function reference');
          process.exit(1);
        }
      }

      // Interval error handling
      if (!interval) {
        console.log('An interval argument must be specified');
        process.exit(1);
      } else {
        if (typeof (interval) !== 'string') {
          console.log('Interval argument to setInterval must be a string specified as an integer'
            + ' followed by \'s\' for seconds, \'m\' for milli, \'u\' for micro, and \'n\' for nanoseconds. Ex. 2u');
          process.exit(1);
        }
      }

      // This ref is used if deferred timeout is cleared, so the callback can still be accessed
      if (callback) {
        if (typeof (callback) !== 'function') {
          console.log('Callback argument to setInterval must be a function reference');
          process.exit(1);
        } else {
          this.intervalCallbackRef = callback;
        }
      }

      const intervalType = interval[interval.length - 1];

      if (intervalType === 's') {
        this.intervalTime = +interval.slice(0, interval.length - 1) * 1000000000;
      } else if (intervalType === 'm') {
        this.intervalTime = +interval.slice(0, interval.length - 1) * 1000000;
      } else if (intervalType === 'u') {
        this.intervalTime = +interval.slice(0, interval.length - 1) * 1000;
      } else if (intervalType === 'n') {
        this.intervalTime = +interval.slice(0, interval.length - 1);
      } else {
        console.log('Error with argument: ' + interval + ': Incorrect interval format. Format is an integer '
          + 'followed by "s" for seconds, "m" for milli, "u" for micro, and "n" for nanoseconds. Ex. 2u');
        process.exit(1);
      }

      this.intervalErrorChecked = true;
    }

    // Avoid dereferencing inside of function objects later
    // Must be performed on every execution
    // tslint:disable-next-line:no-this-assignment
    const thisTimer = this;

    if (this.intervalTime > 0) {

      // Check and set constant t1 value.
      if (this.intervalT1 == null) {
        this.intervalT1 = process.hrtime();
      }

      // Check for overflow.  Every 8,000,000 seconds (92.6 days), this will overflow
      // and the reference time T1 will be re-acquired.  This is the only case in which error will
      // propagate.
      if (this.intervalTime * this.intervalCount > 8000000000000000) {
        this.intervalT1 = process.hrtime();
        this.intervalCount = 1;
      }

      // Get comparison time
      const difArray = process.hrtime(this.intervalT1);
      const difTime = (difArray[0] * 1000000000) + difArray[1];

      // If updated time < expected time, continue
      // Otherwise, run task and update counter
      if (difTime < (this.intervalTime * this.intervalCount)) {

        // Can potentially defer to less accurate setTimeout if intervaltime > 25ms
        if (this.intervalTime > this.precision) {
          if (this.deferredInterval === false) {
            this.deferredInterval = true;
            const msDelay = (this.intervalTime - this.precision) / 1000000.0;
            this.deferredIntervalRef = setTimeout(() => { thisTimer.setInterval(task, interval, args, callback); }, msDelay);
          } else {
            this.deferredIntervalRef = null;
            this.intervalImmediateRef = setImmediate(() => { thisTimer.setInterval(task, interval, args, callback); });
          }
        } else {
          this.intervalImmediateRef = setImmediate(() => { thisTimer.setInterval(task, interval, args, callback); });
        }
      } else {

        this.intervalImmediateRef = null;

        if (this.logging) {
          console.log('nanotimer log: ' + 'cycle time at - ' + difTime);
        }

        if (args) {
          task.apply(null, args);
        } else {
          task();
        }

        // Check if the intervalT1 is still not NULL. If it is, that means the task cleared the interval so it should not run again.
        if (this.intervalT1) {
          this.intervalCount++;
          this.deferredInterval = false;
          this.intervalImmediateRef = setImmediate(() => { thisTimer.setInterval(task, interval, args, callback); });
        }
      }

      // If interval = 0, run as fast as possible.
    } else {

      // Check and set constant t1 value.
      if (this.intervalT1 == null) {
        this.intervalT1 = process.hrtime();
      }

      if (args) {
        task.apply(null, args);
      } else {
        task();
      }

      // This needs to be re-checked here incase calling task turned this off
      if (this.intervalT1) {
        this.intervalImmediateRef = setImmediate(() => { thisTimer.setInterval(task, interval, args, callback); });
      }
    }
  }

  public setTimeout(task: Task, delay: number | string, args?: any[], callback?: Callback) {
    // tslint:disable-next-line:no-parameter-reassignment
    delay = (typeof delay === 'number') ? delay + 'm' : delay;
    // Task error handling
    if (!task) {
      console.log('A task function must be specified to setTimeout');
      process.exit(1);
    } else {
      if (typeof (task) !== 'function') {
        console.log('Task argument to setTimeout must be a function reference');
        process.exit(1);
      }
    }

    // Delay error handling
    if (!delay) {
      console.log('A delay argument must be specified');
      process.exit(1);
    } else {
      if (typeof (delay) !== 'string') {
        console.log('Delay argument to setTimeout must be a string specified as an integer' +
          ' followed by \'s\' for seconds, \'m\' for milli, \'u\' for micro, and \'n\' for nanoseconds. Ex. 2u');
        process.exit(1);
      }
    }

    // This ref is used if deferred timeout is cleared, so the callback can still be accessed
    if (callback) {
      if (typeof (callback) !== 'function') {
        console.log('Callback argument to setTimeout must be a function reference');
        process.exit(1);
      } else {
        this.timeoutCallbackRef = callback;
      }
    }

    // Avoid dereferencing
    // tslint:disable-next-line:no-this-assignment
    const thisTimer = this;

    if (this.timeoutTriggered) {
      this.timeoutTriggered = false;
    }

    const delayType = delay[delay.length - 1];
    let delayTime;

    if (delayType === 's') {
      delayTime = +delay.slice(0, delay.length - 1) * 1000000000;
    } else if (delayType === 'm') {
      delayTime = +delay.slice(0, delay.length - 1) * 1000000;
    } else if (delayType === 'u') {
      delayTime = +delay.slice(0, delay.length - 1) * 1000;
    } else if (delayType === 'n') {
      delayTime = +delay.slice(0, delay.length - 1);
    } else {
      console.log('Error with argument: ' + delay + ': Incorrect delay format. Format is an integer' +
        ' followed by "s" for seconds, "m" for milli, "u" for micro, and "n" for nanoseconds. Ex. 2u');
      process.exit(1);
    }

    // Set marker
    if (this.timeOutT1 == null) {
      this.timeOutT1 = process.hrtime();
    }

    const difArray = process.hrtime(this.timeOutT1);
    const difTime = (difArray[0] * 1000000000) + difArray[1];

    if (difTime < delayTime) {
      // Can potentially defer to less accurate setTimeout if delayTime > 25ms
      if (delayTime > this.precision) {
        if (this.deferredTimeout === false) {
          this.deferredTimeout = true;
          const msDelay = (delayTime - this.precision) / 1000000.0;
          this.deferredTimeoutRef = setTimeout(() => { thisTimer.setTimeout(task, delay, args, callback); }, msDelay);
        } else {
          this.deferredTimeoutRef = null;
          this.timeoutImmediateRef = setImmediate(() => { thisTimer.setTimeout(task, delay, args, callback); });
        }
      } else {
        this.timeoutImmediateRef = setImmediate(() => { thisTimer.setTimeout(task, delay, args, callback); });
      }
    } else {
      this.timeoutTriggered = true;
      this.timeoutImmediateRef = null;
      this.timeOutT1 = null;
      this.deferredTimeout = false;

      if (this.logging === true) {
        console.log('nanotimer log: ' + 'actual wait - ' + difTime);
      }

      if (args) {
        task.apply(null, args);
      } else {
        task();
      }

      if (callback) {
        const data = { waitTime: difTime };
        callback(data);
      }
    }
  }

  public clearInterval() {
    if (this.deferredIntervalRef) {
      clearTimeout(this.deferredIntervalRef);
      this.deferredInterval = false;
    }
    if (this.intervalImmediateRef) {
      clearImmediate(this.intervalImmediateRef);
    }

    this.intervalT1 = null;
    this.intervalCount = 1;
    this.intervalErrorChecked = false;

    if (this.intervalCallbackRef) {
      this.intervalCallbackRef();
    }
  }

  public clearTimeout() {
    // Only do something if this is not being called as a result
    // of the timeout triggering
    if (this.timeoutTriggered === false) {
      let difTime;
      if (this.deferredTimeoutRef) {
        clearTimeout(this.deferredTimeoutRef);
        if (this.timeOutT1) {
          const difArray = process.hrtime(this.timeOutT1);
          difTime = (difArray[0] * 1000000000) + difArray[1];
        }
        this.deferredTimeout = false;
      }
      if (this.timeoutImmediateRef) {
        clearImmediate(this.timeoutImmediateRef);
      }
      this.timeOutT1 = null;
      if (this.timeoutCallbackRef) {
        const data = { waitTime: difTime };
        this.timeoutCallbackRef(data);
      }
    }
  }

  public hasTimeout() {
    return this.timeOutT1 != null;
  }

  public hasInterval() {
    return this.intervalT1 != null;
  }

  public clear() {
    this.hasTimeout() && this.clearTimeout();
    this.hasInterval() && this.clearInterval();
  }

  public static setTimeout(task: Task, delay: number | string, args?: any[], callback?: Callback) {
    const nt = new NanoTimer();
    nt.setTimeout(task, delay, args, callback);
    return nt;
  }

  // TODO: Calc drift on task exec, send as last arg
  public static setInterval(task: Task, interval: number | string, args?: any[], callback?: Callback) {
    const nt = new NanoTimer();
    nt.setInterval(task, interval, args, callback);
    return nt;
  }
}
