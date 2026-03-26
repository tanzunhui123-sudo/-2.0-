import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: Error | null}> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return <div style={{padding:40,color:'red',fontFamily:'monospace'}}>
        <h2>App Crash</h2>
        <pre style={{whiteSpace:'pre-wrap'}}>{this.state.error.message}{'\n'}{this.state.error.stack}</pre>
        <button onClick={() => { localStorage.clear(); location.reload(); }} style={{marginTop:20,padding:'10px 20px',cursor:'pointer'}}>
          Clear Storage & Reload
        </button>
      </div>;
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);