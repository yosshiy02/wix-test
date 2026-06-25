const { execFile } = require("child_process");

function runCommand(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      {
        env: options.env || process.env,
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 20,
      },
      (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          return reject(error);
        }

        resolve({ stdout, stderr });
      }
    );
  });
}

module.exports = {
  runCommand,
};
