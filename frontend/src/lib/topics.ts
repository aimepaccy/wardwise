import type { TeachingPoint } from '@/types'

export type TopicGroup = { topic: string | null; points: { point: TeachingPoint; number: number }[] }

// Teaching points under the topic they belong to, in the order written. Neighbours on the same topic
// share one heading; numbering runs on across the headings. A pack with one topic (or an older pack,
// written before points had topics) is one group with no heading, since a single heading says nothing.
export function groupByTopic(points: TeachingPoint[]): TopicGroup[] {
  const name = (point: TeachingPoint) => point.topic?.trim() || null
  const topics = new Set(points.map((point) => name(point)?.toLowerCase()))
  if (topics.size < 2) return [{ topic: null, points: points.map((point, index) => ({ point, number: index + 1 })) }]

  const groups: TopicGroup[] = []
  points.forEach((point, index) => {
    const topic = name(point)
    const last = groups.at(-1)
    if (last && last.topic?.toLowerCase() === topic?.toLowerCase()) last.points.push({ point, number: index + 1 })
    else groups.push({ topic, points: [{ point, number: index + 1 }] })
  })
  return groups
}
