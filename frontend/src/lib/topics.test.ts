import { describe, expect, it } from 'vitest'
import { groupByTopic } from '@/lib/topics'
import type { TeachingPoint } from '@/types'

const point = (text: string, topic?: string): TeachingPoint => ({ text, topic, quote: '', grounded: true })

describe('grouping teaching points by topic', () => {
  it('puts neighbours on the same topic under one heading, numbering straight through', () => {
    const groups = groupByTopic([point('a', 'Asthma'), point('b', 'asthma'), point('c', 'Malaria'), point('d', 'Asthma')])
    expect(groups.map((group) => [group.topic, group.points.map((p) => p.number)])).toEqual([
      ['Asthma', [1, 2]],
      ['Malaria', [3]],
      ['Asthma', [4]],
    ])
  })

  it('shows no heading when there is only one topic, or none (older packs)', () => {
    expect(groupByTopic([point('a', 'Asthma'), point('b', 'Asthma')])).toHaveLength(1)
    expect(groupByTopic([point('a', 'Asthma')])[0].topic).toBeNull()
    expect(groupByTopic([point('a'), point('b')])[0].topic).toBeNull()
  })
})
