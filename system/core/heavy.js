const { Worker } = require("worker_threads");

function heavyExec(bin, args, cwd) {
  return new Promise((resolve, reject) => {
    const code = `
      const { parentPort, workerData } = require("worker_threads");
      const { spawn } = require("child_process");
      const proc = spawn(workerData.bin, workerData.args, {
        cwd: workerData.cwd,
        env: workerData.env,
        shell: false,
      });
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (d) => { stdout += d.toString(); });
      proc.stderr.on("data", (d) => { stderr += d.toString(); });
      proc.on("error", (e) =>
        parentPort.postMessage({ err: { message: e.message, code: e.code } }),
      );
      proc.on("close", (code) => parentPort.postMessage({ code, stdout, stderr }));
    `;
    const env = { ...process.env };
    if (process.platform === "linux" && env.HOME) {
      const localBin = require("path").join(env.HOME, ".local", "bin");
      env.PATH = `${localBin}:${env.PATH}`;
    }
    let worker;
    try {
      worker = new Worker(code, { eval: true, workerData: { bin, args, cwd, env } });
    } catch (e) {
      return reject(e);
    }
    let done = false;
    const finish = (fn, v) => {
      if (done) return;
      done = true;
      try {
        worker.terminate();
      } catch (e) {}
      fn(v);
    };
    const timer = setTimeout(
      () => finish(reject, new Error("heavyExec timeout (600s)")),
      600000,
    );
    try {
      timer.unref();
    } catch (e) {}
    worker.on("message", (msg) => {
      if (msg.err) {
        finish(reject, Object.assign(new Error(msg.err.message), { code: msg.err.code }));
      } else {
        finish(resolve, { code: msg.code, stdout: msg.stdout, stderr: msg.stderr });
      }
    });
    worker.on("error", (e) => finish(reject, e));
    worker.on("exit", (c) => {
      if (!done) finish(reject, new Error("Worker exited with code " + c));
    });
  });
}

module.exports = { heavyExec };