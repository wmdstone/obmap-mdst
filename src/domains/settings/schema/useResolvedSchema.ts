import { useMemo } from 'react';
import { resolveSchema } from '@/domains/settings/schema/resolve';
import { useSchemaStore } from '@/domains/settings/schema/useSchemaStore';
import type { ResolvedProperty } from '@/domains/settings/schema/types';

/** Effective (global -> note) property rules for a given note's frontmatter. */
export function useResolvedSchema(frontmatter?: Record<string, unknown>): ResolvedProperty[] {
  const schema = useSchemaStore((s) => s.schema);
  return useMemo(() => resolveSchema(schema, frontmatter), [schema, frontmatter]);
}
