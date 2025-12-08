import fs from "fs";
import path from "path";

/**
 * Vite plugin that increments the patch version in src/version.json
 * every time a production build is run.
 * Supports semantic versioning: major.minor.patch (e.g., "0.5.0" -> "0.5.1")
 */
export default function versionIncrement() {
  return {
    name: "version-increment",
    buildStart() {
      // Only increment during production builds
      if (process.env.NODE_ENV !== "production") {
        return;
      }

      const versionPath = path.resolve("src/version.json");

      try {
        const content = fs.readFileSync(versionPath, "utf-8");
        const versionData = JSON.parse(content);
        const currentVersion = versionData.build || "0.0.0";

        // Parse semantic version (major.minor.patch)
        const parts = String(currentVersion).split(".").map(Number);
        const major = parts[0] || 0;
        const minor = parts[1] || 0;
        const patch = (parts[2] || 0) + 1;

        const newVersion = `${major}.${minor}.${patch}`;
        versionData.build = newVersion;

        fs.writeFileSync(
          versionPath,
          JSON.stringify(versionData, null, 2) + "\n"
        );
        console.log(`\n📦 Build version incremented to: ${newVersion}\n`);
      } catch (err) {
        console.warn("Could not increment version:", err.message);
      }
    },
  };
}
