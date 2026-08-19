'use client'

import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center space-y-3">
          <div style={{ fontSize: 40 }}>⚠</div>
          <h2 className="text-lg font-bold" style={{ color: '#1E1626' }}>Something went wrong</h2>
          <p className="text-sm" style={{ color: '#6B6373' }}>{this.state.message}</p>
          <button
            onClick={() => { this.setState({ hasError: false, message: '' }); window.location.reload() }}
            className="px-4 py-2 rounded-lg text-sm font-bold"
            style={{ background: '#5B2A86', color: '#fff' }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
