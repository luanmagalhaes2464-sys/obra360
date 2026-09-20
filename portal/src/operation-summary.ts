export type ActionItem = {
  id: number; title: string; status: string; priority: string;
  required: boolean; client_action: boolean; stage_key: string;
  discipline: string; role?: string; detail?: string;
}

/** Ordering of recorded pending items, not dependency readiness or technical approval. */
export function pendingActions<T extends ActionItem>(tasks: T[], clientOnly = false): T[] {
  const rank: Record<string, number> = { critica: 0, alta: 1, normal: 2, baixa: 3 }
  return tasks.filter(t => t.status === 'pending' && (!clientOnly || t.client_action))
    .sort((a, b) => (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2)
      || Number(b.required) - Number(a.required) || a.id - b.id)
}

export function checklistProgress(tasks: { status: string }[]) {
  const applicable = tasks.filter(t => t.status !== 'na').length
  const done = tasks.filter(t => t.status === 'done').length
  return { applicable, done, percent: applicable ? Math.round(done / applicable * 100) : 0 }
}
