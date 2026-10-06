import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Pin } from '../types'

const PANE = 'pins'
// Pins were kept under one key for every folder before; moved to the first folder that loads them
const LEGACY_KEY = 'pins'
const BAR_KEY = 'barHidden'
const pins = atom({ plugin: 'pins', key: 'pins' } as const, [] as Pin[])
const expanded = atom({ plugin: 'pins', key: 'expanded' } as const, [] as string[])
const busy = atom({ plugin: 'pins', key: 'busy' } as const, false)
const pending = atom({ plugin: 'pins', key: 'pending' } as const, null as string | null)
const barOpen = atom({ plugin: 'pins', key: 'barOpen' } as const, null as string | null)
const barHidden = atom({ plugin: 'pins', key: 'barHidden' } as const, false)
const folder = atom({ plugin: 'pins', key: 'folder' } as const, null as string | null)

async function paneTitle($: EngineInterface): Promise<string> {
  return `Pinned · ${folderName((await read($, folder)) ?? (await $.session.cwd()))}`
}

async function storeKey($: EngineInterface): Promise<string> {
  return `pins:${(await read($, folder)) ?? (await $.session.cwd())}`
}

function folderName(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path
}

// Text of the model's last reply: its final text message, without the progress notes before it
async function lastReply($: EngineInterface): Promise<string> {
  const messages = await $.session.messages()
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m?.role === 'assistant' && m.text.trim()) return m.text.trim()
  }
  return ''
}

function titleOf(text: string): string {
  const lines = text.split('\n')
  const line = lines.find(l => /^#{1,6}\s/.test(l)) ?? lines.find(l => l.trim()) ?? ''
  const plain = line.replace(/[#*`>_]/g, '').trim()
  return plain.length > 60 ? `${plain.slice(0, 59)}…` : plain
}

function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function timeOf(at: number): string {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function save($: EngineInterface, list: Pin[]) {
  await $.store.set(await storeKey($), list)
}

async function addPin($: EngineInterface, text: string, title: string): Promise<string> {
  const current = await read($, pins)
  const same = current.findIndex(p => p.text === text)
  if (same !== -1) {
    if (!title) return `Already pinned as #${same + 1}: ${current[same]?.title}`
    const list = await update($, pins, l => l.map((p, i) => (i === same ? { ...p, title } : p)))
    await save($, list)
    return `Renamed #${same + 1}: ${title}`
  }
  const pin: Pin = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title: title || titleOf(text),
    text,
    at: Date.now(),
  }
  const list = await update($, pins, l => [...l, pin])
  await save($, list)
  await $.ui.open({ id: PANE, title: await paneTitle($) })
  return `Pinned #${list.length}: ${pin.title}`
}

// `clear 2 3` removes pins by their number in the pane; `clear` alone removes them all
async function clear($: EngineInterface, args: string): Promise<string> {
  const numbers = (args.match(/\d+/g) ?? []).map(Number)
  const list = await read($, pins)
  if (numbers.length === 0) {
    await update($, pins, () => [])
    await update($, expanded, () => [])
    await save($, [])
    return 'All pins removed.'
  }
  const gone = list.filter((_, i) => numbers.includes(i + 1))
  const missing = numbers.filter(n => n < 1 || n > list.length)
  const ids = gone.map(p => p.id)
  const next = await update($, pins, l => l.filter(p => !ids.includes(p.id)))
  await update($, expanded, open => open.filter(id => !ids.includes(id)))
  await save($, next)
  const lines = gone.map(p => `Removed #${list.indexOf(p) + 1}: ${p.title}`)
  if (missing.length) lines.push(`No pin #${missing.join(', #')} (there are ${list.length})`)
  return lines.join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // Kept across hot reloads, so a later change of the session's cwd doesn't move the pins
    if ((await read($, folder)) === null) await update($, folder, () => e.cwd)
    const key = await storeKey($)
    let stored = (await $.store.get(key)) as Pin[] | undefined
    const legacy = (await $.store.get(LEGACY_KEY)) as Pin[] | undefined
    if (stored === undefined && legacy) {
      stored = legacy
      await $.store.set(key, legacy)
      await $.store.delete(LEGACY_KEY)
    }
    await update($, pins, () => stored ?? [])
    if ((await $.store.get(BAR_KEY)) === true) await update($, barHidden, () => true)
    await $.command.register({
      name: 'pin',
      description: "Pin Claude's last reply (optional: a title; /pin clear 2 removes pin #2)",
      immediate: true,
    })
    await $.command.register({
      name: 'pins',
      description: 'Show/hide pinned replies (/pins clear [N], /pins bar toggles the band above the prompt)',
      immediate: true,
    })

    return next(e)
  })

  on('command.run', { command: 'pin' }, async ($, e) => {
    const args = e.args.trim()
    if (/^clear\b/.test(args)) {
      if (!/\d/.test(args)) return { text: 'Which one? /pin clear 2 removes pin #2, /pins clear removes all.' }
      return { text: await clear($, args) }
    }
    if (await read($, busy)) {
      await update($, pending, () => args)
      return { text: 'Claude is still writing: the reply will be pinned when it finishes.' }
    }
    const text = await lastReply($)
    if (!text) return { text: 'Nothing to pin: no reply from Claude yet.' }

    return { text: await addPin($, text, args) }
  })

  on('command.run', { command: 'pins' }, async ($, e) => {
    if (/^clear\b/.test(e.args.trim())) return { text: await clear($, e.args) }
    if (e.args.trim() === 'bar') {
      const hidden = await update($, barHidden, h => !h)
      await $.store.set(BAR_KEY, hidden)
      return { text: hidden ? 'Pins band hidden (/pins bar shows it again).' : 'Pins band shown above the prompt.' }
    }
    if ((await $.ui.panes()).some(pane => pane.id === PANE)) {
      await $.ui.close({ id: PANE })
      return { text: 'Pinned replies hidden.' }
    }
    await $.ui.open({ id: PANE, title: await paneTitle($), focus: true, closeOnEscape: true })

    return { text: 'Pinned replies opened.' }
  })

  on('turn.start', async ($, e, next) => {
    await update($, busy, () => true)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined) return done
    await update($, busy, () => false)
    const title = await read($, pending)
    if (title !== null) {
      await update($, pending, () => null)
      const text = e.answer.trim()
      if (!e.isAborted && text) $.ui.toast(await addPin($, text, title))
    }
    return done
  })

  // A band above the prompt, always there: one hotkey per pin opens it right in the band
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, pins)
    if (e.props.hasSurvey || list.length === 0 || (await read($, barHidden))) return next(e)

    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const openId = await read($, barOpen)
    const room = Math.max(12, e.props.bodyColumns - 20)

    return (
      <Box flexDirection="column">
        {list.slice(0, 9).map((pin, i) => (
          <Box flexDirection="column">
            <Box flexDirection="row">
              <Button
                key={`bar-${pin.id}`}
                plain
                hotkey={String(i + 1)}
                dimColor={pin.id !== openId}
                label={`${pin.id === openId ? '▼' : '▶'} ${cut(pin.title, room)}`}
                onPress={() => update($, barOpen, id => (id === pin.id ? null : pin.id))}
              />
              <Text dimColor>  {timeOf(pin.at)}</Text>
            </Box>
            {pin.id === openId && (
              <Box paddingLeft={5} marginBottom={1}>
                <Markdown key={`bar-md-${pin.id}`} text={pin.text} />
              </Box>
            )}
          </Box>
        ))}
        {list.length > 9 && <Text dimColor>   +{list.length - 9} more in /pins</Text>}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const list = await read($, pins)
    const open = await read($, expanded)

    const toggle = (id: string) =>
      update($, expanded, ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]))
    const remove = async (id: string) => {
      const next = await update($, pins, l => l.filter(p => p.id !== id))
      await update($, expanded, ids => ids.filter(x => x !== id))
      await save($, next)
    }

    if (list.length === 0) {
      return (
        <Box flexDirection="column">
          <Text dimColor>No pins yet. Type /pin after a reply.</Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Text dimColor>1–9 expand/collapse · Tab/arrows + Enter · Esc close · ctrl+x tab to focus</Text>
        {list.map((pin, i) => {
          const isOpen = open.includes(pin.id)
          return (
            <Box flexDirection="column" marginBottom={1}>
              <Box flexDirection="row">
                <Text bold color="inverseText" backgroundColor="claude">{` ${i + 1} `}</Text>
                <Text> </Text>
                <Button
                  key={`toggle-${pin.id}`}
                  hotkey={i < 9 ? String(i + 1) : undefined}
                  label={`${isOpen ? '▼' : '▶'} ${pin.title}`}
                  onPress={() => toggle(pin.id)}
                />
                <Text dimColor> {timeOf(pin.at)} </Text>
                <Button key={`del-${pin.id}`} plain dimColor label="✕" onPress={() => remove(pin.id)} />
              </Box>
              {isOpen && (
                <Box paddingLeft={2}>
                  <Markdown key={`md-${pin.id}`} text={pin.text} />
                </Box>
              )}
            </Box>
          )
        })}
      </Box>
    )
  })
}
