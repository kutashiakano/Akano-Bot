const {Worker: Worker} = require("worker_threads");

let _activeWorkers = 0;

const MAX_WORKERS = 3;

const _queue = [];

function _dequeue() {
  if (_queue.length === 0) return;
  if (_activeWorkers >= MAX_WORKERS) return;
  const next = _queue.shift();
  _activeWorkers++;
  _runWorker(next.bin, next.args, next.cwd, next.resolve, next.reject);
}

function _runWorker(bin, args, cwd, resolve, reject) {
  const code = `\n      const { parentPort, workerData } = require("worker_threads");\n      const { spawn } = require("child_process");\n      const proc = spawn(workerData.bin, workerData.args, {\n        cwd: workerData.cwd,\n        env: workerData.env,\n        shell: false,\n      });\n      let stdout = "";\n      let stderr = "";\n      proc.stdout.on("data", (d) => { stdout += d.toString(); });\n      proc.stderr.on("data", (d) => { stderr += d.toString(); });\n      proc.on("error", (e) =>\n        parentPort.postMessage({ err: { message: e.message, code: e.code } }),\n      );\n      proc.on("close", (code) => parentPort.postMessage({ code, stdout, stderr }));\n    `;
  const env = {
    ...process.env
  };
  if (process.platform === "linux" && env.HOME) {
    const localBin = require("path").join(env.HOME, ".local", "bin");
    env.PATH = `${localBin}:${env.PATH}`;
  }
  let worker;
  try {
    worker = new Worker(code, {
      eval: true,
      workerData: {
        bin: bin,
        args: args,
        cwd: cwd,
        env: env
      }
    });
  } catch (e) {
    _activeWorkers--;
    _dequeue();
    return reject(e);
  }
  let done = false;
  const finish = (fn, v) => {
    if (done) return;
    done = true;
    try {
      worker.terminate();
    } catch (e) {}
    _activeWorkers--;
    _dequeue();
    fn(v);
  };
  const timer = setTimeout(() => finish(reject, new Error("heavyExec timeout (600s)")), 6e5);
  try {
    timer.unref();
  } catch (e) {}
  worker.on("message", msg => {
    clearTimeout(timer);
    if (msg.err) {
      finish(reject, Object.assign(new Error(msg.err.message), {
        code: msg.err.code
      }));
    } else {
      finish(resolve, {
        code: msg.code,
        stdout: msg.stdout,
        stderr: msg.stderr
      });
    }
  });
  worker.on("error", e => {
    clearTimeout(timer);
    finish(reject, e);
  });
  worker.on("exit", c => {
    if (!done) {
      clearTimeout(timer);
      finish(reject, new Error("Worker exited with code " + c));
    }
  });
}

function heavyExec(bin, args, cwd) {
  return new Promise((resolve, reject) => {
    if (_activeWorkers < MAX_WORKERS) {
      _activeWorkers++;
      _runWorker(bin, args, cwd, resolve, reject);
    } else {
      _queue.push({
        bin: bin,
        args: args,
        cwd: cwd,
        resolve: resolve,
        reject: reject
      });
    }
  });
}

function heavyExecInline(bin, args, cwd) {
  const {spawn: spawn} = require("child_process");
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env
    };
    if (process.platform === "linux" && env.HOME) {
      const localBin = require("path").join(env.HOME, ".local", "bin");
      env.PATH = `${localBin}:${env.PATH}`;
    }
    const proc = spawn(bin, args, {
      cwd: cwd,
      env: env,
      shell: false
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", d => {
      stdout += d.toString();
    });
    proc.stderr.on("data", d => {
      stderr += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", code => {
      if (code === 0) resolve({
        code: code,
        stdout: stdout,
        stderr: stderr
      }); else {
        const err = new Error(stderr || `Process exited with code ${code}`);
        err.code = code;
        reject(err);
      }
    });
  });
}

async function execWithFallback(bin, args, cwd) {
  try {
    return await heavyExec(bin, args, cwd);
  } catch (e) {
    if (e && /worker|worker_threads|ERR_WORKER/i.test(String(e.message))) {
      return heavyExecInline(bin, args, cwd);
    }
    throw e;
  }
}

module.exports = {
  heavyExec: heavyExec,
  heavyExecInline: heavyExecInline,
  execWithFallback: execWithFallback
};