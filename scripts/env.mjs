// Shell/Vercel settings take precedence over ignored local files.
export function loadLocalEnv() {
  for (const file of [".env.local"]) {
    try {
      process.loadEnvFile(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}
