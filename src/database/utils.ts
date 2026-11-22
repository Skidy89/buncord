function sanitizeValue(v: unknown): unknown {
  const type = typeof v;
  if (type === "number") return Math.max(0, Math.floor(v as number));
  if (type === "object" && Array.isArray(v)) return JSON.stringify(v);
  return v;
}

export function sanitizeObject<T extends object>(data: T): T {
  const keys = Object.keys(data);
  const len = keys.length;
  const sanitized = {} as T;
  for (let i = 0; i < len; i++) {
    const key = keys[i];
    sanitized[key as keyof T] = sanitizeValue(
      (data as Record<string, unknown>)[key!],
    ) as T[keyof T];
  }
  return sanitized;
}

export const placeholdersSetData = <T extends object>(
  data: Partial<T>,
):
  | {
      columns: string;
      placeholders: string;
      updates: string;
      values: unknown[];
      keys: string[];
    }
  | undefined => {
  const keys = Object.keys(data);
  const len = keys.length;
  if (len === 0) return;

  const placeholderArr: string[] = new Array(len);
  const updateArr: string[] = new Array(len);
  const values: unknown[] = new Array(len);

  for (let i = 0; i < len; i++) {
    const k = keys[i];
    placeholderArr[i] = "?";
    updateArr[i] = `${k} = excluded.${k}`;
    values[i] = (data as Record<string, unknown>)[k!];
  }

  return {
    columns: keys.join(", "),
    placeholders: placeholderArr.join(", "),
    updates: updateArr.join(", "),
    values,
    keys,
  };
};
