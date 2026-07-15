export const COPILOT_DRAWER_EVENT = 'vital:open-copilot'

export type CopilotDrawerRequest = {
  prompt?: string
}

export function openCopilotDrawer(prompt = '') {
  window.dispatchEvent(new CustomEvent<CopilotDrawerRequest>(COPILOT_DRAWER_EVENT, {
    detail: { prompt: prompt.trim() },
  }))
}
