import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🐾</div>
          <h1 className="text-2xl font-bold text-purple-600 mb-2">Something went wrong</h1>
          <p className="text-gray-500 mb-6 text-sm">
            An unexpected error occurred. Please refresh the page — if the problem persists, contact support.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-purple-500 text-white px-6 py-2.5 rounded-full hover:bg-purple-600 font-medium text-sm"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }
}
