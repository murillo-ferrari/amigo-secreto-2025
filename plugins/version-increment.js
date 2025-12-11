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
      const isProd =
        typeof globalThis !== "undefined" &&
        globalThis.process &&
        globalThis.process.env &&
        globalThis.process.env.NODE_ENV === "production";
      if (!isProd) return;

      const versionPath = path.resolve("src/version.json");

      try {
        const content = fs.readFileSync(versionPath, "utf-8");
        const versionData = JSON.parse(content);
        const currentVersion = versionData.build || "0.0.0";

        // Parse semantic version (major.minor.patch)
        const parts = String(currentVersion)
          .split(".")
          .map((p) => {
            const n = Number(p);
            return Number.isFinite(n) ? n : 0;
          });
        const major = parts[0] || 0;
        const minor = parts[1] || 0;
        const patch = parts[2] || 0;

        // Increment patch and apply rollovers:
        // - Patch rolls to 0 and increments minor when it reaches 100
        // - Minor rolls to 0 and increments major when it reaches 10
        let newMajor = major;
        let newMinor = minor;
        let newPatch = patch + 1;

        if (newPatch >= 100) {
          newPatch = 0;
          newMinor = newMinor + 1;
        }

        if (newMinor >= 10) {
          newMinor = 0;
          newMajor = newMajor + 1;
        }

        const newVersion = `${newMajor}.${newMinor}.${newPatch}`;
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
