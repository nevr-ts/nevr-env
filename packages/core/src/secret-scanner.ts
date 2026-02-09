/**
 * Secret Scanning Utilities
 * 
 * Detect and prevent accidental secret exposure in code, logs, and commits.
 * Use with pre-commit hooks or CI/CD pipelines.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

export interface SecretPattern {
  /** Pattern name */
  name: string;
  /** Regex pattern to match */
  pattern: RegExp;
  /** Severity level */
  severity: "critical" | "high" | "medium" | "low";
  /** Description of the secret type */
  description: string;
}

export interface SecretMatch {
  /** File path where secret was found */
  file: string;
  /** Line number */
  line: number;
  /** Column number */
  column: number;
  /** The pattern that matched */
  pattern: SecretPattern;
  /** Matched text (redacted) */
  match: string;
  /** Full line content (redacted) */
  lineContent: string;
}

export interface ScanResult {
  /** Whether any secrets were found */
  hasSecrets: boolean;
  /** Number of files scanned */
  filesScanned: number;
  /** All matches found */
  matches: SecretMatch[];
  /** Summary by severity */
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface ScanOptions {
  /** Directory to scan */
  directory?: string;
  /** File patterns to include (glob) */
  include?: string[];
  /** File patterns to exclude */
  exclude?: string[];
  /** Additional patterns to check */
  additionalPatterns?: SecretPattern[];
  /** Whether to redact matched values */
  redact?: boolean;
  /** Max file size to scan (bytes) */
  maxFileSize?: number;
}

/**
 * Built-in secret patterns
 */
export const DEFAULT_SECRET_PATTERNS: SecretPattern[] = [
  // API Keys
  {
    name: "AWS Access Key",
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: "critical",
    description: "AWS Access Key ID",
  },
  {
    name: "AWS Secret Key",
    pattern: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g,
    severity: "critical",
    description: "Potential AWS Secret Access Key",
  },
  {
    name: "Stripe Secret Key",
    pattern: /sk_(live|test)_[0-9a-zA-Z]{24,}/g,
    severity: "critical",
    description: "Stripe Secret API Key",
  },
  {
    name: "Stripe Publishable Key",
    pattern: /pk_(live|test)_[0-9a-zA-Z]{24,}/g,
    severity: "medium",
    description: "Stripe Publishable Key (less sensitive)",
  },
  {
    name: "OpenAI API Key",
    pattern: /sk-[a-zA-Z0-9]{20,}/g,
    severity: "critical",
    description: "OpenAI API Key",
  },
  {
    name: "GitHub Token",
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
    severity: "critical",
    description: "GitHub Personal Access Token",
  },
  {
    name: "GitHub OAuth",
    pattern: /gho_[A-Za-z0-9]{36}/g,
    severity: "critical",
    description: "GitHub OAuth Access Token",
  },
  {
    name: "Slack Token",
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/g,
    severity: "critical",
    description: "Slack API Token",
  },
  {
    name: "Discord Token",
    pattern: /[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27}/g,
    severity: "critical",
    description: "Discord Bot Token",
  },
  {
    name: "Twilio API Key",
    pattern: /SK[0-9a-fA-F]{32}/g,
    severity: "high",
    description: "Twilio API Key",
  },
  {
    name: "SendGrid API Key",
    pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
    severity: "critical",
    description: "SendGrid API Key",
  },
  {
    name: "Mailchimp API Key",
    pattern: /[a-f0-9]{32}-us[0-9]{1,2}/g,
    severity: "high",
    description: "Mailchimp API Key",
  },
  {
    name: "Private Key",
    pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    severity: "critical",
    description: "Private Key Header",
  },
  {
    name: "JWT Token",
    pattern: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/]*/g,
    severity: "high",
    description: "JSON Web Token",
  },
  // Database URLs
  {
    name: "Database URL with Password",
    pattern: /(postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]+@[^\s]+/gi,
    severity: "critical",
    description: "Database connection string with credentials",
  },
  // Generic patterns
  {
    name: "Generic API Key",
    pattern: /['"][a-zA-Z0-9_-]*(?:api[_-]?key|apikey|api[_-]?secret)['"]\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/gi,
    severity: "high",
    description: "Generic API key assignment",
  },
  {
    name: "Generic Secret",
    pattern: /['"][a-zA-Z0-9_-]*(?:secret|password|passwd|pwd)['"]\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    severity: "high",
    description: "Generic secret assignment",
  },
  // nevr-env specific
  {
    name: "nevr-env Vault Key",
    pattern: /nevr_[a-zA-Z0-9_-]{32,}/g,
    severity: "critical",
    description: "nevr-env vault encryption key",
  },
];

/**
 * Default files to exclude from scanning
 */
const DEFAULT_EXCLUDE = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "*.min.js",
  "*.bundle.js",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  ".env.example",
  ".env.template",
];

/**
 * Default file extensions to scan
 */
const DEFAULT_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yaml",
  ".yml",
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.test",
  ".md",
  ".txt",
  ".sh",
  ".bash",
  ".zsh",
];

/**
 * Redact a secret value for safe display
 */
function redactValue(value: string): string {
  if (value.length <= 8) {
    return "***";
  }
  return value.slice(0, 4) + "..." + value.slice(-4);
}

/**
 * Check if a file should be scanned
 */
function shouldScanFile(
  filePath: string,
  exclude: string[],
  maxFileSize: number
): boolean {
  // Check exclusions
  for (const pattern of exclude) {
    if (filePath.includes(pattern) || filePath.endsWith(pattern)) {
      return false;
    }
  }
  
  // Check file size
  try {
    const stats = statSync(filePath);
    if (stats.size > maxFileSize) {
      return false;
    }
  } catch {
    return false;
  }
  
  // Check extension
  const hasValidExtension = DEFAULT_EXTENSIONS.some((ext) =>
    filePath.endsWith(ext)
  );
  
  return hasValidExtension;
}

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dir: string, exclude: string[]): string[] {
  const files: string[] = [];
  
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      // Check if excluded
      if (exclude.some((e) => entry.name === e || fullPath.includes(e))) {
        continue;
      }
      
      if (entry.isDirectory()) {
        files.push(...getAllFiles(fullPath, exclude));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory not accessible
  }
  
  return files;
}

/**
 * Scan a single file for secrets
 */
function scanFile(
  filePath: string,
  patterns: SecretPattern[],
  redact: boolean
): SecretMatch[] {
  const matches: SecretMatch[] = [];
  
  try {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      
      for (const pattern of patterns) {
        // Reset regex lastIndex
        pattern.pattern.lastIndex = 0;
        
        let match;
        while ((match = pattern.pattern.exec(line)) !== null) {
          matches.push({
            file: filePath,
            line: lineNum + 1,
            column: match.index + 1,
            pattern,
            match: redact ? redactValue(match[0]) : match[0],
            lineContent: redact ? line.replace(match[0], redactValue(match[0])) : line,
          });
        }
      }
    }
  } catch {
    // File not readable
  }
  
  return matches;
}

/**
 * Scan a directory for secrets
 * 
 * @example
 * ```ts
 * import { scanForSecrets } from "nevr-env";
 * 
 * const result = scanForSecrets({
 *   directory: "./src",
 *   redact: true,
 * });
 * 
 * if (result.hasSecrets) {
 *   console.error("❌ Secrets found!");
 *   for (const match of result.matches) {
 *     console.error(`  ${match.file}:${match.line} - ${match.pattern.name}`);
 *   }
 *   process.exit(1);
 * }
 * ```
 */
export function scanForSecrets(options: ScanOptions = {}): ScanResult {
  const {
    directory = process.cwd(),
    exclude = DEFAULT_EXCLUDE,
    additionalPatterns = [],
    redact = true,
    maxFileSize = 1024 * 1024, // 1MB
  } = options;
  
  const patterns = [...DEFAULT_SECRET_PATTERNS, ...additionalPatterns];
  const allExclude = [...DEFAULT_EXCLUDE, ...exclude];
  
  // Get all files
  const files = getAllFiles(directory, allExclude).filter((f) =>
    shouldScanFile(f, allExclude, maxFileSize)
  );
  
  // Scan each file
  const allMatches: SecretMatch[] = [];
  
  for (const file of files) {
    const matches = scanFile(file, patterns, redact);
    allMatches.push(...matches);
  }
  
  // Calculate summary
  const summary = {
    critical: allMatches.filter((m) => m.pattern.severity === "critical").length,
    high: allMatches.filter((m) => m.pattern.severity === "high").length,
    medium: allMatches.filter((m) => m.pattern.severity === "medium").length,
    low: allMatches.filter((m) => m.pattern.severity === "low").length,
  };
  
  return {
    hasSecrets: allMatches.length > 0,
    filesScanned: files.length,
    matches: allMatches,
    summary,
  };
}

/**
 * Create a pre-commit hook script content
 */
export function generatePreCommitHook(): string {
  return `#!/bin/sh
# nevr-env secret scanner pre-commit hook
# Generated by nevr-env

echo "🔍 Scanning for secrets..."

# Run the secret scanner
npx nevr-env scan --staged

# Check exit code
if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Commit blocked: secrets detected!"
  echo "   Please remove the secrets before committing."
  echo ""
  exit 1
fi

echo "✅ No secrets found"
exit 0
`;
}

/**
 * Format scan results for CLI output
 */
export function formatScanResults(result: ScanResult, cwd?: string): string {
  const lines: string[] = [];
  
  if (!result.hasSecrets) {
    lines.push("✅ No secrets found");
    lines.push(`   Scanned ${result.filesScanned} files`);
    return lines.join("\n");
  }
  
  lines.push("❌ Secrets detected!");
  lines.push("");
  lines.push(`   Critical: ${result.summary.critical}`);
  lines.push(`   High:     ${result.summary.high}`);
  lines.push(`   Medium:   ${result.summary.medium}`);
  lines.push(`   Low:      ${result.summary.low}`);
  lines.push("");
  
  // Group by file
  const byFile = new Map<string, SecretMatch[]>();
  for (const match of result.matches) {
    const file = cwd ? relative(cwd, match.file) : match.file;
    if (!byFile.has(file)) {
      byFile.set(file, []);
    }
    byFile.get(file)!.push(match);
  }
  
  for (const [file, matches] of byFile) {
    lines.push(`📄 ${file}`);
    for (const match of matches) {
      const severity = match.pattern.severity.toUpperCase().padEnd(8);
      lines.push(`   L${match.line}:${match.column} [${severity}] ${match.pattern.name}`);
      lines.push(`         ${match.lineContent.trim().slice(0, 60)}...`);
    }
    lines.push("");
  }
  
  return lines.join("\n");
}
