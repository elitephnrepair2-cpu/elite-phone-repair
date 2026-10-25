import React from 'react';

export class ScreenBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}> {
  declare props:{children:React.ReactNode};
  state={failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  render() {
    if (this.state.failed) return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
      <p>This screen could not load. Refresh the CRM to try again.</p>
      <button className="mt-3 rounded-lg bg-slate-900 px-4 py-2 font-bold text-white" onClick={()=>window.location.reload()}>Refresh CRM</button>
    </div>;
    return this.props.children;
  }
}
