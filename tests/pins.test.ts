import { expect, test } from 'claude-code/testing'

const PANE = { component: 'Pane', requestId: 'pins', props: { title: 'Pinned', isFocused: true, bodyColumns: 60, placement: 'dock' } as never } as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`pin, expand, collapse and remove a reply (${surface})`, async ($, on) => {
    const kept = new Map<string, unknown>()
    on('store.get', async (_$, e) => ({ value: kept.get(e.key) }))
    on('session.cwd', async () => ({ value: '/proj/a' }))
    on('store.set', async (_$, e) => {
      kept.set(e.key, e.value)
      return { value: undefined }
    })
    on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
    on('session.messages', async () => ({ value: [
      { role: 'user', text: 'first question', toolUses: [] },
      { role: 'assistant', text: 'old answer', toolUses: [] },
      { role: 'user', text: 'second question', toolUses: [] },
      { role: 'assistant', text: 'Checking the config first.', toolUses: [] },
      { role: 'user', text: '', toolUses: [], toolResults: [] },
      { role: 'assistant', text: '## Status line ready\nIt shows the bar.', toolUses: [] },
    ] }) as never)

    const ran = await $.command.run({ command: 'pin', args: '' } as never)
    expect(ran?.text).toContain('Status line ready')

    const ui = await $.ui.mount({ plugin: 'pins', surface, ...PANE })
    const toggle = await ui.find({ type: 'Button', text: /▶ Status line ready/ })
    expect(toggle).toBeDefined()
    expect(await ui.find({ type: 'Markdown' })).toBeUndefined()

    await ui.press({ key: toggle!.key! })
    const md = await ui.find({ type: 'Markdown' })
    expect(md?.text).toContain('It shows the bar.')
    expect(md?.text).not.toContain('old answer')
    expect(md?.text).not.toContain('Checking the config')

    await ui.press({ key: toggle!.key! })
    expect(await ui.find({ type: 'Markdown' })).toBeUndefined()

    const del = await ui.find({ type: 'Button', text: '✕' })
    await ui.press({ key: del!.key! })
    expect(await ui.find({ type: 'Text', text: /No pins yet/ })).toBeDefined()
    expect(kept.get('pins:/proj/a')).toEqual([])
  })
}

test('/pin clear 2 removes the second pin only', async ($, on) => {
  const kept = new Map<string, unknown>()
  on('store.get', async (_$, e) => ({ value: kept.get(e.key) }))
    on('session.cwd', async () => ({ value: '/proj/a' }))
  on('store.set', async (_$, e) => {
    kept.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  let reply = ''
  on('session.messages', async () => ({ value: [{ role: 'assistant', text: reply, toolUses: [] }] }) as never)

  for (const title of ['one', 'two', 'three']) {
    reply = `reply ${title}`
    await $.command.run({ command: 'pin', args: title } as never)
  }
  const ran = await $.command.run({ command: 'pin', args: 'clear 2' } as never)
  expect(ran?.text).toContain('Removed #2: two')
  expect((kept.get('pins:/proj/a') as { title: string }[]).map(p => p.title)).toEqual(['one', 'three'])

  const none = await $.command.run({ command: 'pin', args: 'clear 7' } as never)
  expect(none?.text).toContain('No pin #7')
  const bare = await $.command.run({ command: 'pin', args: 'clear' } as never)
  expect(bare?.text).toContain('Which one?')
  expect((kept.get('pins:/proj/a') as unknown[]).length).toBe(2)
})

test('/pins toggles the pane', async ($, on) => {
  let open = false
  on('store.get', async () => ({ value: undefined }))
  on('session.cwd', async () => ({ value: '/proj/a' }))
  on('ui.panes', async () => ({ value: open ? [{ id: 'pins', title: 'Pinned', isShown: true, isFocused: true }] : [] }) as never)
  on('ui.open', async () => {
    open = true
    return { value: { isPlaced: true } } as never
  })
  on('ui.close', async () => {
    open = false
    return { value: undefined }
  })

  expect((await $.command.run({ command: 'pins', args: '' } as never))?.text).toContain('opened')
  expect(open).toBe(true)
  expect((await $.command.run({ command: 'pins', args: '' } as never))?.text).toContain('hidden')
  expect(open).toBe(false)
})

test('/pin typed while Claude writes pins the answer when the turn completes', async ($, on) => {
  const kept = new Map<string, unknown>()
  const toasts: string[] = []
  on('store.get', async (_$, e) => ({ value: kept.get(e.key) }))
    on('session.cwd', async () => ({ value: '/proj/a' }))
  on('store.set', async (_$, e) => {
    kept.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: unknown }).text ?? e))
    return { value: undefined } as never
  })
  on('session.messages', async () => ({ value: [{ role: 'assistant', text: 'half-written progress note', toolUses: [] }] }) as never)
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_$, e) => ({ text: e.answer }))

  await $.turn.start({ text: 'hi', turnId: 't1' } as never)
  const ran = await $.command.run({ command: 'pin', args: 'my title' } as never)
  expect(ran?.text).toContain('still writing')
  expect(kept.get('pins:/proj/a')).toBeUndefined()

  await $.turn.complete({ answer: '## Final\nThe full answer.', durationMs: 5, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  const saved = kept.get('pins:/proj/a') as { title: string; text: string }[]
  expect(saved.map(p => p.title)).toEqual(['my title'])
  expect(saved[0]?.text).toContain('The full answer.')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the band above the prompt opens a pin in place (${surface})`, async ($, on) => {
    const kept = new Map<string, unknown>()
    on('store.get', async (_$, e) => ({ value: kept.get(e.key) }))
    on('session.cwd', async () => ({ value: '/proj/a' }))
    on('store.set', async (_$, e) => {
      kept.set(e.key, e.value)
      return { value: undefined }
    })
    on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
    on('session.messages', async () => ({ value: [{ role: 'assistant', text: 'Band body text', toolUses: [] }] }) as never)

    await $.command.run({ command: 'pin', args: 'Band pin' } as never)
    const again = await $.command.run({ command: 'pin', args: '' } as never)
    expect(again?.text).toContain('Already pinned as #1')
    const renamed = await $.command.run({ command: 'pin', args: 'Better title' } as never)
    expect(renamed?.text).toContain('Renamed #1: Better title')
    expect((kept.get('pins:/proj/a') as unknown[]).length).toBe(1)

    const BAND = { component: 'AbovePrompt', requestId: 'band', props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 80 } as never } as const
    const ui = await $.ui.mount({ plugin: 'pins', surface, ...BAND })
    const button = await ui.find({ type: 'Button', text: /Better title/ })
    expect(button).toBeDefined()
    expect(await ui.find({ type: 'Markdown' })).toBeUndefined()
    await ui.press({ key: button!.key! })
    expect((await ui.find({ type: 'Markdown' }))?.text).toContain('Band body text')
    await ui.press({ key: button!.key! })
    expect(await ui.find({ type: 'Markdown' })).toBeUndefined()

    expect((await $.command.run({ command: 'pins', args: 'bar' } as never))?.text).toContain('hidden')
    expect(kept.get('barHidden')).toBe(true)
  })
}

test('pins are kept per folder; the old shared list moves to the first folder', async ($, on) => {
  const kept = new Map<string, unknown>([['pins', [{ id: 'old', title: 'old pin', text: 'old text', at: 1 }]]])
  on('store.get', async (_$, e) => ({ value: kept.get(e.key) }))
  on('store.set', async (_$, e) => {
    kept.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', async (_$, e) => {
    kept.delete(e.key)
    return { value: undefined } as never
  })
  on('command.register', async () => ({ value: undefined }) as never)
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('session.messages', async () => ({ value: [{ role: 'assistant', text: 'new reply', toolUses: [] }] }) as never)

  await $.session.start({ cwd: '/proj/a', surface: 'terminal', isInteractive: true } as never)
  expect(kept.has('pins')).toBe(false)
  expect((kept.get('pins:/proj/a') as { title: string }[]).map(p => p.title)).toEqual(['old pin'])

  const ran = await $.command.run({ command: 'pin', args: 'fresh' } as never)
  expect(ran?.text).toContain('Pinned #2: fresh')
  expect((kept.get('pins:/proj/a') as unknown[]).length).toBe(2)
  expect(kept.has('pins:/proj/b')).toBe(false)
})
