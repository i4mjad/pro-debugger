import { readFile, access, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export interface StackInfo {
  language: string;
  framework: string | null;
  packageManager: string | null;
  configFile: string | null;
  configDir: string;
  testCommand: string | null;
}

interface ConfigDetector {
  file: string | ((dir: string) => Promise<string | null>);
  language: string;
  packageManager: string;
  detectFramework: (configPath: string) => Promise<string | null>;
  detectTestCommand: (configPath: string) => Promise<string | null>;
}

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".rb": "ruby",
  ".php": "php",
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".cs": "csharp",
  ".fs": "fsharp",
  ".dart": "dart",
  ".swift": "swift",
  ".lua": "lua",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".ex": "elixir",
  ".exs": "elixir",
  ".erl": "erlang",
  ".scala": "scala",
  ".clj": "clojure",
  ".zig": "zig",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".c": "c",
  ".h": "c",
  ".hpp": "cpp",
  ".vue": "vue",
  ".svelte": "svelte",
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJsonSafe(path: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function readTextSafe(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

async function findCsproj(dir: string): Promise<string | null> {
  try {
    const files = await readdir(dir);
    const csproj = files.find((f) => f.endsWith(".csproj") || f.endsWith(".sln"));
    return csproj ? join(dir, csproj) : null;
  } catch {
    return null;
  }
}

function detectNodeFramework(deps: Record<string, unknown>): string | null {
  const frameworks: [string, string][] = [
    ["next", "Next.js"],
    ["nuxt", "Nuxt"],
    ["@angular/core", "Angular"],
    ["svelte", "SvelteKit"],
    ["@sveltejs/kit", "SvelteKit"],
    ["vue", "Vue"],
    ["react", "React"],
    ["express", "Express"],
    ["fastify", "Fastify"],
    ["@nestjs/core", "NestJS"],
    ["hono", "Hono"],
    ["koa", "Koa"],
    ["@remix-run/node", "Remix"],
    ["gatsby", "Gatsby"],
    ["astro", "Astro"],
    ["electron", "Electron"],
    ["react-native", "React Native"],
    ["expo", "Expo"],
  ];
  for (const [pkg, name] of frameworks) {
    if (pkg in deps) return name;
  }
  return null;
}

async function detectNodeTestCommand(configPath: string): Promise<string | null> {
  const pkg = await readJsonSafe(configPath);
  if (!pkg) return null;
  const scripts = pkg.scripts as Record<string, string> | undefined;
  if (!scripts) return null;
  if (scripts.test && scripts.test !== 'echo "Error: no test specified" && exit 1') {
    return "npm test";
  }
  return null;
}

async function detectPythonFramework(configPath: string): Promise<string | null> {
  const content = await readTextSafe(configPath);
  if (!content) return null;
  const frameworks: [string, string][] = [
    ["django", "Django"],
    ["fastapi", "FastAPI"],
    ["flask", "Flask"],
    ["starlette", "Starlette"],
    ["tornado", "Tornado"],
    ["aiohttp", "aiohttp"],
    ["sanic", "Sanic"],
    ["pyramid", "Pyramid"],
    ["streamlit", "Streamlit"],
  ];
  for (const [pkg, name] of frameworks) {
    if (content.includes(pkg)) return name;
  }
  return null;
}

async function detectGoFramework(configPath: string): Promise<string | null> {
  const content = await readTextSafe(configPath);
  if (!content) return null;
  const frameworks: [string, string][] = [
    ["github.com/gin-gonic/gin", "Gin"],
    ["github.com/labstack/echo", "Echo"],
    ["github.com/gofiber/fiber", "Fiber"],
    ["github.com/gorilla/mux", "Gorilla Mux"],
    ["github.com/go-chi/chi", "Chi"],
    ["github.com/beego/beego", "Beego"],
  ];
  for (const [pkg, name] of frameworks) {
    if (content.includes(pkg)) return name;
  }
  return null;
}

async function detectRubyFramework(configPath: string): Promise<string | null> {
  const content = await readTextSafe(configPath);
  if (!content) return null;
  if (content.includes("rails")) return "Rails";
  if (content.includes("sinatra")) return "Sinatra";
  if (content.includes("hanami")) return "Hanami";
  return null;
}

async function detectPhpFramework(configPath: string): Promise<string | null> {
  const pkg = await readJsonSafe(configPath);
  if (!pkg) return null;
  const require = (pkg.require ?? {}) as Record<string, unknown>;
  if ("laravel/framework" in require) return "Laravel";
  if ("symfony/framework-bundle" in require) return "Symfony";
  if ("slim/slim" in require) return "Slim";
  return null;
}

async function detectJavaFramework(configPath: string): Promise<string | null> {
  const content = await readTextSafe(configPath);
  if (!content) return null;
  if (content.includes("spring-boot") || content.includes("org.springframework")) return "Spring Boot";
  if (content.includes("quarkus")) return "Quarkus";
  if (content.includes("micronaut")) return "Micronaut";
  return null;
}

async function detectDartFramework(configPath: string): Promise<string | null> {
  const content = await readTextSafe(configPath);
  if (!content) return null;
  if (content.includes("flutter")) return "Flutter";
  return null;
}

async function detectRustFramework(configPath: string): Promise<string | null> {
  const content = await readTextSafe(configPath);
  if (!content) return null;
  if (content.includes("actix-web")) return "Actix Web";
  if (content.includes("axum")) return "Axum";
  if (content.includes("rocket")) return "Rocket";
  if (content.includes("warp")) return "Warp";
  if (content.includes("tauri")) return "Tauri";
  return null;
}

async function detectDotnetFramework(configPath: string): Promise<string | null> {
  const content = await readTextSafe(configPath);
  if (!content) return null;
  if (content.includes("Microsoft.AspNetCore")) return "ASP.NET Core";
  if (content.includes("Blazor")) return "Blazor";
  if (content.includes("Microsoft.Maui")) return "MAUI";
  return null;
}

const CONFIG_DETECTORS: ConfigDetector[] = [
  {
    file: "package.json",
    language: "javascript",
    packageManager: "npm",
    async detectFramework(configPath) {
      const pkg = await readJsonSafe(configPath);
      if (!pkg) return null;
      const deps = {
        ...(pkg.dependencies as Record<string, unknown> ?? {}),
        ...(pkg.devDependencies as Record<string, unknown> ?? {}),
      };
      // Refine language if TypeScript is a dep
      // (caller will override language based on this)
      return detectNodeFramework(deps);
    },
    detectTestCommand: detectNodeTestCommand,
  },
  {
    file: "pyproject.toml",
    language: "python",
    packageManager: "pip",
    detectFramework: detectPythonFramework,
    async detectTestCommand() { return "pytest"; },
  },
  {
    file: "requirements.txt",
    language: "python",
    packageManager: "pip",
    detectFramework: detectPythonFramework,
    async detectTestCommand() { return "pytest"; },
  },
  {
    file: "setup.py",
    language: "python",
    packageManager: "pip",
    detectFramework: detectPythonFramework,
    async detectTestCommand() { return "pytest"; },
  },
  {
    file: "go.mod",
    language: "go",
    packageManager: "go modules",
    detectFramework: detectGoFramework,
    async detectTestCommand() { return "go test ./..."; },
  },
  {
    file: "Cargo.toml",
    language: "rust",
    packageManager: "cargo",
    detectFramework: detectRustFramework,
    async detectTestCommand() { return "cargo test"; },
  },
  {
    file: "Gemfile",
    language: "ruby",
    packageManager: "bundler",
    detectFramework: detectRubyFramework,
    async detectTestCommand(configPath) {
      const content = await readTextSafe(configPath);
      if (content?.includes("rspec")) return "bundle exec rspec";
      return "bundle exec rake test";
    },
  },
  {
    file: "pubspec.yaml",
    language: "dart",
    packageManager: "pub",
    detectFramework: detectDartFramework,
    async detectTestCommand(configPath) {
      const framework = await detectDartFramework(configPath);
      return framework === "Flutter" ? "flutter test" : "dart test";
    },
  },
  {
    file: "pom.xml",
    language: "java",
    packageManager: "maven",
    detectFramework: detectJavaFramework,
    async detectTestCommand() { return "mvn test"; },
  },
  {
    file: "build.gradle",
    language: "java",
    packageManager: "gradle",
    detectFramework: detectJavaFramework,
    async detectTestCommand() { return "gradle test"; },
  },
  {
    file: "build.gradle.kts",
    language: "kotlin",
    packageManager: "gradle",
    detectFramework: detectJavaFramework,
    async detectTestCommand() { return "gradle test"; },
  },
  {
    file: "composer.json",
    language: "php",
    packageManager: "composer",
    detectFramework: detectPhpFramework,
    async detectTestCommand() { return "vendor/bin/phpunit"; },
  },
  {
    file: findCsproj,
    language: "csharp",
    packageManager: "nuget",
    detectFramework: detectDotnetFramework,
    async detectTestCommand() { return "dotnet test"; },
  },
  {
    file: "mix.exs",
    language: "elixir",
    packageManager: "mix",
    async detectFramework(configPath) {
      const content = await readTextSafe(configPath);
      if (content?.includes("phoenix")) return "Phoenix";
      return null;
    },
    async detectTestCommand() { return "mix test"; },
  },
];

/**
 * Walk up from a target path to find the nearest config file
 * that identifies the project's language and framework.
 * Stops at the filesystem root.
 */
export async function detectStack(targetPath: string): Promise<StackInfo> {
  const resolvedPath = resolve(targetPath);

  // Determine the file extension for fallback detection
  const ext = resolvedPath.includes(".")
    ? "." + resolvedPath.split(".").pop()!.toLowerCase()
    : null;

  let dir = resolvedPath;
  // If the target is a file, start from its parent directory
  try {
    const stat = await import("node:fs/promises").then((fs) => fs.stat(resolvedPath));
    if (stat.isFile()) {
      dir = dirname(resolvedPath);
    }
  } catch {
    // Path doesn't exist, treat as directory
    dir = resolvedPath;
  }

  // Walk up the directory tree
  const root = resolve("/");
  while (true) {
    for (const detector of CONFIG_DETECTORS) {
      let configPath: string | null;

      if (typeof detector.file === "function") {
        configPath = await detector.file(dir);
      } else {
        configPath = join(dir, detector.file);
        if (!(await fileExists(configPath))) {
          configPath = null;
        }
      }

      if (configPath) {
        const framework = await detector.detectFramework(configPath);
        const testCommand = await detector.detectTestCommand(configPath);

        // For Node.js, refine language if TypeScript is present
        let language = detector.language;
        if (language === "javascript" && configPath.endsWith("package.json")) {
          const pkg = await readJsonSafe(configPath);
          if (pkg) {
            const allDeps = {
              ...(pkg.dependencies as Record<string, unknown> ?? {}),
              ...(pkg.devDependencies as Record<string, unknown> ?? {}),
            };
            if ("typescript" in allDeps) {
              language = "typescript";
            }
          }
        }

        return {
          language,
          framework,
          packageManager: detector.packageManager,
          configFile: configPath,
          configDir: dir,
          testCommand,
        };
      }
    }

    const parent = dirname(dir);
    if (parent === dir || dir === root) break;
    dir = parent;
  }

  // Fallback: detect language from file extension
  const fallbackLang = ext ? EXTENSION_LANGUAGE_MAP[ext] ?? "unknown" : "unknown";
  return {
    language: fallbackLang,
    framework: null,
    packageManager: null,
    configFile: null,
    configDir: dirname(resolvedPath),
    testCommand: null,
  };
}
