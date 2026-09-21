const PRIORITY = { critica: 0, alta: 1, normal: 2, baixa: 3 }

export function wouldCreateCycle(dependencies, predecessorId, successorId) {
  const from = Number(predecessorId)
  const to = Number(successorId)
  if (!from || !to || from === to) return true
  const adjacency = new Map()
  for (const dep of dependencies) {
    const a = Number(dep.predecessor_id)
    const b = Number(dep.successor_id)
    if (!adjacency.has(a)) adjacency.set(a, [])
    adjacency.get(a).push(b)
  }
  if (!adjacency.has(from)) adjacency.set(from, [])
  adjacency.get(from).push(to)
  const stack = [to]
  const seen = new Set()
  while (stack.length) {
    const current = stack.pop()
    if (current === from) return true
    if (seen.has(current)) continue
    seen.add(current)
    for (const next of adjacency.get(current) || []) stack.push(next)
  }
  return false
}

export function buildMotorState(tasks, dependencies, blockers, today = new Date()) {
  const byId = new Map(tasks.map(task => [Number(task.id), task]))
  const predecessors = new Map()
  for (const dep of dependencies) {
    const id = Number(dep.successor_id)
    if (!predecessors.has(id)) predecessors.set(id, [])
    const predecessor = byId.get(Number(dep.predecessor_id))
    if (predecessor) predecessors.get(id).push(predecessor)
  }
  const activeBlockers = new Map()
  for (const blocker of blockers.filter(item => item.status === 'active')) {
    const id = Number(blocker.activity_id)
    if (!activeBlockers.has(id)) activeBlockers.set(id, [])
    activeBlockers.get(id).push(blocker)
  }
  const now = new Date(today)
  now.setHours(0, 0, 0, 0)
  const activities = tasks.map(task => {
    const previous = predecessors.get(Number(task.id)) || []
    const waitingOn = previous.filter(item => item && item.status !== 'done')
    const ownBlockers = activeBlockers.get(Number(task.id)) || []
    const plannedEnd = task.planned_end ? new Date(`${String(task.planned_end).slice(0, 10)}T12:00:00`) : null
    const delayed = task.status !== 'done' && plannedEnd && plannedEnd < now
    return {
      ...task,
      readiness: ownBlockers.length ? 'blocked' : waitingOn.length ? 'waiting' : task.status === 'done' ? 'done' : 'ready',
      waiting_on: waitingOn.map(item => ({ id: item.id, title: item.title })),
      blockers: ownBlockers,
      delayed: Boolean(delayed),
    }
  })
  const nextActions = activities
    .filter(item => item.status === 'pending' && item.readiness === 'ready')
    .sort((a, b) => (PRIORITY[a.priority] ?? 2) - (PRIORITY[b.priority] ?? 2)
      || Number(!a.planned_start) - Number(!b.planned_start)
      || Number(a.task_order || 0) - Number(b.task_order || 0))
  return {
    activities,
    nextActions,
    summary: {
      total: activities.length,
      ready: activities.filter(item => item.readiness === 'ready' && item.status === 'pending').length,
      blocked: activities.filter(item => item.readiness === 'blocked').length,
      waiting: activities.filter(item => item.readiness === 'waiting').length,
      delayed: activities.filter(item => item.delayed).length,
      scheduled: activities.filter(item => item.planned_start && item.planned_end).length,
    },
  }
}

export function ganttWindow(tasks) {
  const dates = tasks.flatMap(task => [task.planned_start, task.planned_end]).filter(Boolean).map(value => new Date(`${String(value).slice(0, 10)}T12:00:00`)).filter(date => Number.isFinite(date.getTime()))
  if (!dates.length) return null
  const start = new Date(Math.min(...dates.map(date => date.getTime())))
  const end = new Date(Math.max(...dates.map(date => date.getTime())))
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), days }
}

export function criticalPath(tasks, dependencies) {
  const active = tasks.filter(task => task.status !== 'na')
  const ids = new Set(active.map(task => Number(task.id)))
  const duration = new Map(active.map(task => [Number(task.id), Math.max(1, Number(task.duration_days) || 1)]))
  const incoming = new Map(active.map(task => [Number(task.id), []]))
  const outgoing = new Map(active.map(task => [Number(task.id), []]))
  for (const dependency of dependencies) {
    const from = Number(dependency.predecessor_id), to = Number(dependency.successor_id)
    if (!ids.has(from) || !ids.has(to)) continue
    outgoing.get(from).push(to)
    incoming.get(to).push(from)
  }
  const indegree = new Map([...incoming].map(([id, rows]) => [id, rows.length]))
  const queue = active.map(task => Number(task.id)).filter(id => indegree.get(id) === 0)
  const order = []
  while (queue.length) {
    const id = queue.shift(); order.push(id)
    for (const next of outgoing.get(id)) { indegree.set(next, indegree.get(next) - 1); if (indegree.get(next) === 0) queue.push(next) }
  }
  if (order.length !== active.length) return { valid:false, totalDuration:0, criticalIds:[], activities:{}, reason:'cycle' }
  const earliestStart = new Map(), earliestFinish = new Map()
  for (const id of order) {
    const start = Math.max(0, ...incoming.get(id).map(previous => earliestFinish.get(previous) || 0))
    earliestStart.set(id,start); earliestFinish.set(id,start + duration.get(id))
  }
  const totalDuration = Math.max(0,...earliestFinish.values()), latestFinish = new Map(), latestStart = new Map()
  for (const id of [...order].reverse()) {
    const next = outgoing.get(id), finish = next.length ? Math.min(...next.map(successor => latestStart.get(successor))) : totalDuration
    latestFinish.set(id,finish); latestStart.set(id,finish-duration.get(id))
  }
  const activities = {}, criticalIds = []
  for (const id of order) {
    const totalFloat = latestStart.get(id)-earliestStart.get(id)
    activities[id] = {earliestStart:earliestStart.get(id),earliestFinish:earliestFinish.get(id),latestStart:latestStart.get(id),latestFinish:latestFinish.get(id),totalFloat,critical:totalFloat===0}
    if (totalFloat===0) criticalIds.push(id)
  }
  return {valid:true,totalDuration,criticalIds,activities,method:'precedence-duration',nonFsDependencies:dependencies.filter(item=>item.dependency_type&&item.dependency_type!=='FS').length}
}
