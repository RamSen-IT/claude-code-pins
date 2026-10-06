export type Pin = { id: string; title: string; text: string; at: number }

declare module 'claude-code' {
  interface PluginState {
    pins: {
      pins: Pin[]
      expanded: string[]
      // A main-loop turn is running
      busy: boolean
      // /pin typed mid-turn: pin the answer when the turn completes (title, or '' for none)
      pending: string | null
      // The pin shown open in the band above the prompt
      barOpen: string | null
      // The band is turned off with /pins bar
      barHidden: boolean
      // The folder the session was started in: pins are kept per folder
      folder: string | null
    }
  }
}
