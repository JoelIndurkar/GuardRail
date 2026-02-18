import { useEffect, useState } from 'react'

const API = 'http://localhost:3002'

interface Repo {
  name: string
  url: string
  last_scanned: string
  total_critical: number
  total_high: number
  total_medium: number
  total_low: number
}

export default function Overview({ onSelectRepo }: { onSelectRepo: (name: string) => void }) {
  const [repos, setRepos] = useState<Repo[]>([])
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    fetch(`${API}/api/repos`).then(r => r.json()).then(setRepos)
    fetch(`${API}/api/stats`).then(r => r.json()).then(setStats)
  }, [])

  return (
    <div>
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Repos Monitored', value: stats.totals.total_repos, color: 'text-white' },
            { label: 'Critical', value: stats.totals.critical ?? 0, color: 'text-red-400' },
            { label: 'High', value: stats.totals.high ?? 0, color: 'text-orange-400' },
            { label: 'Medium', value: stats.totals.medium ?? 0, color: 'text-yellow-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-gray-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-semibold mb-4">Monitored Repositories</h2>
      <div className="grid gap-4">
        {repos.map(repo => (
          <div
            key={repo.name}
            onClick={() => onSelectRepo(repo.name)}
            className="bg-gray-900 border border-gray-800 rounded-lg p-5 cursor-pointer hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">{repo.name}</h3>
                <p className="text-gray-500 text-sm mt-1">
                  Last scanned: {repo.last_scanned ? new Date(repo.last_scanned).toLocaleString() : 'Never'}
                </p>
              </div>
              <div className="flex gap-3 text-sm">
                <span className="text-red-400">{repo.total_critical} critical</span>
                <span className="text-orange-400">{repo.total_high} high</span>
                <span className="text-yellow-400">{repo.total_medium} medium</span>
                <span className="text-gray-400">{repo.total_low} low</span>
              </div>
            </div>
          </div>
        ))}
        {repos.length === 0 && (
          <p className="text-gray-500">No repositories scanned yet.</p>
        )}
      </div>
    </div>
  )
}
