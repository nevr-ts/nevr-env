/**
 * Secret Rotation Tracking
 * 
 * Track when secrets were last rotated and warn if they're stale.
 * Critical for security compliance (SOC2, PCI-DSS, etc.)
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export interface RotationRecord {
  /** Variable name */
  key: string;
  /** When this secret was last rotated */
  lastRotated: string;
  /** Who rotated it (optional) */
  rotatedBy?: string;
  /** Maximum age in days before warning */
  maxAgeDays: number;
  /** Notes about the rotation */
  notes?: string;
}

export interface RotationConfig {
  /** Path to rotation tracking file */
  trackingFile?: string;
  /** Default max age in days */
  defaultMaxAgeDays?: number;
  /** Variables to track (if empty, tracks all sensitive vars) */
  trackedKeys?: string[];
  /** Custom warning handler */
  onStaleSecret?: (record: RotationRecord, ageDays: number) => void;
}

export interface RotationStatus {
  /** Variable name */
  key: string;
  /** Last rotation date */
  lastRotated: string | null;
  /** Days since rotation */
  daysSinceRotation: number | null;
  /** Max allowed age */
  maxAgeDays: number;
  /** Whether it needs rotation */
  needsRotation: boolean;
  /** Status message */
  status: "fresh" | "warning" | "expired" | "unknown";
}

const DEFAULT_TRACKING_FILE = ".nevr-env.rotation.json";
const DEFAULT_MAX_AGE_DAYS = 90;

/**
 * Load rotation records from tracking file
 */
export function loadRotationRecords(
  trackingFile: string = DEFAULT_TRACKING_FILE
): Map<string, RotationRecord> {
  const records = new Map<string, RotationRecord>();
  
  if (!existsSync(trackingFile)) {
    return records;
  }
  
  try {
    const data = JSON.parse(readFileSync(trackingFile, "utf8"));
    if (data.records && Array.isArray(data.records)) {
      for (const record of data.records) {
        records.set(record.key, record);
      }
    }
  } catch {
    // File exists but is invalid, return empty
  }
  
  return records;
}

/**
 * Save rotation records to tracking file
 */
export function saveRotationRecords(
  records: Map<string, RotationRecord>,
  trackingFile: string = DEFAULT_TRACKING_FILE
): void {
  const data = {
    version: 1,
    updatedAt: new Date().toISOString(),
    records: Array.from(records.values()),
  };
  
  writeFileSync(trackingFile, JSON.stringify(data, null, 2));
}

/**
 * Record a secret rotation
 */
export function recordRotation(
  key: string,
  options: {
    trackingFile?: string;
    maxAgeDays?: number;
    rotatedBy?: string;
    notes?: string;
  } = {}
): RotationRecord {
  const {
    trackingFile = DEFAULT_TRACKING_FILE,
    maxAgeDays = DEFAULT_MAX_AGE_DAYS,
    rotatedBy,
    notes,
  } = options;
  
  const records = loadRotationRecords(trackingFile);
  
  const record: RotationRecord = {
    key,
    lastRotated: new Date().toISOString(),
    maxAgeDays,
    rotatedBy,
    notes,
  };
  
  records.set(key, record);
  saveRotationRecords(records, trackingFile);
  
  return record;
}

/**
 * Get rotation status for a key
 */
export function getRotationStatus(
  key: string,
  options: {
    trackingFile?: string;
    maxAgeDays?: number;
  } = {}
): RotationStatus {
  const {
    trackingFile = DEFAULT_TRACKING_FILE,
    maxAgeDays = DEFAULT_MAX_AGE_DAYS,
  } = options;
  
  const records = loadRotationRecords(trackingFile);
  const record = records.get(key);
  
  if (!record) {
    return {
      key,
      lastRotated: null,
      daysSinceRotation: null,
      maxAgeDays,
      needsRotation: true,
      status: "unknown",
    };
  }
  
  const lastRotated = new Date(record.lastRotated);
  const now = new Date();
  const daysSinceRotation = Math.floor(
    (now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  const effectiveMaxAge = record.maxAgeDays || maxAgeDays;
  const needsRotation = daysSinceRotation > effectiveMaxAge;
  
  let status: RotationStatus["status"];
  if (daysSinceRotation <= effectiveMaxAge * 0.5) {
    status = "fresh";
  } else if (daysSinceRotation <= effectiveMaxAge) {
    status = "warning";
  } else {
    status = "expired";
  }
  
  return {
    key,
    lastRotated: record.lastRotated,
    daysSinceRotation,
    maxAgeDays: effectiveMaxAge,
    needsRotation,
    status,
  };
}

/**
 * Check all tracked secrets and return their status
 */
export function checkRotationStatus(
  keys: string[],
  options: RotationConfig = {}
): RotationStatus[] {
  const {
    trackingFile = DEFAULT_TRACKING_FILE,
    defaultMaxAgeDays = DEFAULT_MAX_AGE_DAYS,
    onStaleSecret,
  } = options;
  
  const statuses: RotationStatus[] = [];
  
  for (const key of keys) {
    const status = getRotationStatus(key, {
      trackingFile,
      maxAgeDays: defaultMaxAgeDays,
    });
    
    statuses.push(status);
    
    // Call handler for stale secrets
    if (status.needsRotation && onStaleSecret) {
      const records = loadRotationRecords(trackingFile);
      const record = records.get(key);
      if (record && status.daysSinceRotation !== null) {
        onStaleSecret(record, status.daysSinceRotation);
      }
    }
  }
  
  return statuses;
}

/**
 * Create a rotation checker that integrates with createEnv
 * 
 * @example
 * ```ts
 * const rotationChecker = createRotationChecker({
 *   trackedKeys: ["DATABASE_URL", "API_SECRET"],
 *   defaultMaxAgeDays: 90,
 *   onStaleSecret: (record, age) => {
 *     console.warn(`⚠️ ${record.key} is ${age} days old (max: ${record.maxAgeDays})`);
 *   },
 * });
 * 
 * export const env = createEnv({
 *   server: { ... },
 *   onSuccess: rotationChecker,
 * });
 * ```
 */
export function createRotationChecker(config: RotationConfig = {}) {
  return (env: Record<string, unknown>) => {
    const keysToCheck = config.trackedKeys ?? Object.keys(env).filter(
      (key) =>
        key.toLowerCase().includes("secret") ||
        key.toLowerCase().includes("key") ||
        key.toLowerCase().includes("password") ||
        key.toLowerCase().includes("token")
    );
    
    const statuses = checkRotationStatus(keysToCheck, config);
    
    const stale = statuses.filter((s) => s.needsRotation);
    if (stale.length > 0) {
      console.warn("");
      console.warn("⚠️  Secret Rotation Warnings:");
      for (const s of stale) {
        if (s.daysSinceRotation !== null) {
          console.warn(
            `   • ${s.key}: ${s.daysSinceRotation} days old (max: ${s.maxAgeDays})`
          );
        } else {
          console.warn(`   • ${s.key}: No rotation record found`);
        }
      }
      console.warn("");
      console.warn("   Run `npx nevr-env rotate <key>` to record a rotation.");
      console.warn("");
    }
  };
}
