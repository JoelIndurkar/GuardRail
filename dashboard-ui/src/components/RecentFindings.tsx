import { useEffect, useState } from 'react'

const API = 'http://localhost:3002'

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'text-red-400',
  HIGH: 'text-orange-400',
  MEDIUM: 'text-yellow-400',
  LOW: 'text-gray-400',
}

export default function RecentFindings() {
  const [findings, setFindings] = useState<any[]>([])

  useEffect(() => {
    fetch(`${API}/api/findings/recent`).then(r => r.json()).then(setFindings)
  }, [])

  return (
    <div>
      <h2 className="text-lg font-semibold mb-6">Recent Findings</h2>
      {findings.length === 0 ? (
        <p className="text-gray-500">No findings yet.</p>
      ) : (
        <div className="space-y-3">
          {findings.map(f => (
            <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <a href={`https://nvd.nist.gov/vuln/detail/${f.cve_id}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline font-medium">
                    {f.cve_id}
                  </a>
                  <span className="text-gray-500 text-sm ml-3">{f.repo_name} &mdash; {f.package_name}@{f.installed_version}</span>
                </div>
                <span className={`text-sm font-medium ${SEVERITY_COLORS[f.severity]}`}>{f.severity}</span>
              </div>
              <p className="text-gray-400 text-sm mt-2">{f.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
