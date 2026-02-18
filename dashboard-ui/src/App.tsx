import { useState } from 'react'
import Overview from './components/Overview'
import RepoDetail from './components/RepoDetail'
import RecentFindings from './components/RecentFindings'

export default function App() {
  const [view, setView] = useState<'overview' | 'recent'>('overview')
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">GuardRail</h1>
          <div className="flex gap-4">
            <button
              onClick={() => { setView('overview'); setSelectedRepo(null); }}
              className={`px-3 py-1 rounded text-sm ${view === 'overview' && !selectedRepo ? 'bg-blue-600' : 'text-gray-400 hover:text-white'}`}
            >
              Overview
            </button>
            <button
              onClick={() => setView('recent')}
              className={`px-3 py-1 rounded text-sm ${view === 'recent' ? 'bg-blue-600' : 'text-gray-400 hover:text-white'}`}
            >
              Recent Findings
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {selectedRepo ? (
          <RepoDetail repo={selectedRepo} onBack={() => setSelectedRepo(null)} />
        ) : view === 'overview' ? (
          <Overview onSelectRepo={setSelectedRepo} />
        ) : (
          <RecentFindings />
        )}
      </main>
    </div>
  )
}
