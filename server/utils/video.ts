import { spawn } from "child_process";

export function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    // ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 input.mp4
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath
    ]);

    let stdout = "";
    let stderr = "";

    ffprobe.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
        return;
      }
      const duration = parseFloat(stdout.trim());
      if (isNaN(duration)) {
        reject(new Error("Could not parse duration output"));
        return;
      }
      resolve(duration);
    });
  });
}
