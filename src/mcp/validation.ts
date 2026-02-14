/**
 * Input validation helpers for MCP tool arguments.
 * Lightweight alternative to Zod -- keeps zero extra dependencies.
 */

type Args = Record<string, unknown>;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function requireString(args: Args, key: string): string {
  const val = args[key];
  if (typeof val !== 'string' || val.length === 0) {
    throw new ValidationError(`"${key}" is required and must be a non-empty string`);
  }
  return val;
}

export function optionalString(args: Args, key: string): string | undefined {
  const val = args[key];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'string') {
    throw new ValidationError(`"${key}" must be a string`);
  }
  return val;
}

export function requireNumber(args: Args, key: string): number {
  const val = args[key];
  if (typeof val === 'string') {
    const parsed = Number(val);
    if (!Number.isFinite(parsed)) throw new ValidationError(`"${key}" must be a valid number`);
    return parsed;
  }
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    throw new ValidationError(`"${key}" is required and must be a number`);
  }
  return val;
}

export function optionalNumber(args: Args, key: string): number | undefined {
  const val = args[key];
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'string') {
    const parsed = Number(val);
    if (!Number.isFinite(parsed)) throw new ValidationError(`"${key}" must be a valid number`);
    return parsed;
  }
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    throw new ValidationError(`"${key}" must be a number`);
  }
  return val;
}

export function requirePositiveInt(args: Args, key: string): number {
  const val = requireNumber(args, key);
  if (!Number.isInteger(val) || val <= 0) {
    throw new ValidationError(`"${key}" must be a positive integer`);
  }
  return val;
}

export function optionalBoolean(args: Args, key: string): boolean | undefined {
  const val = args[key];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'boolean') {
    throw new ValidationError(`"${key}" must be a boolean`);
  }
  return val;
}

export function requireArray<T>(args: Args, key: string): T[] {
  const val = args[key];
  if (!Array.isArray(val)) {
    throw new ValidationError(`"${key}" is required and must be an array`);
  }
  return val as T[];
}

export function optionalArray<T>(args: Args, key: string): T[] | undefined {
  const val = args[key];
  if (val === undefined || val === null) return undefined;
  if (!Array.isArray(val)) {
    throw new ValidationError(`"${key}" must be an array`);
  }
  return val as T[];
}

export function requireObject(args: Args, key: string): Record<string, unknown> {
  const val = args[key];
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    throw new ValidationError(`"${key}" is required and must be an object`);
  }
  return val as Record<string, unknown>;
}

export function optionalObject(args: Args, key: string): Record<string, unknown> | undefined {
  const val = args[key];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'object' || Array.isArray(val)) {
    throw new ValidationError(`"${key}" must be an object`);
  }
  return val as Record<string, unknown>;
}
