import React from 'react'

type State = { hasError: boolean; message?: string }

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('UI boundary caught error', { error, info })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="m-6 rounded-2xl border border-rose-500/20 bg-rose-950/20 p-6 text-rose-100">
          <h2 className="mb-2 text-xl font-semibold">Se produjo un error de interfaz</h2>
          <p className="text-sm opacity-90">{this.state.message ?? 'Error no controlado'}</p>
        </div>
      )
    }

    return this.props.children
  }
}
