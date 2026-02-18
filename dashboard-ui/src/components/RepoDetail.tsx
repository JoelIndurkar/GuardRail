import { useEffect, useState } from 'react'

import { API } from '../config'

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'text-red-400 bg-red-400/10',
  HIGH: 'text-orange-400 bg-orange-400/10',
  MEDIUM: 'text-yellow-400 bg-yellow-400/10',
  LOW: 'text-gray-400 bg-gray-400/10',
}

export default function RepoDetail({ repo, onBack }: { repo: string, onBack: () => void }) {
  const [findings, setFindings] = useState<any[]>([])

  useEffect(() => {
    fetch(`${API}/api/repos/${repo}/findings`).then(r => r.json()).then(setFindings)
  }, [repo])

  return (
    <div>
      <button onClick={onBack} className="text-gray-400 hover:text-white text-sm mb-6">
        &larr; Back to overview
      </button>
      <h2 className="text-xl font-semibold mb-6">{repo}</h2>
      {findings.length === 0 ? (
        <p className="text-gray-500">No vulnerabilities found in latest scan.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="text-left py-3 pr-4">CVE ID</th>
                <th className="text-left py-3 pr-4">Package</th>
                <th className="text-left py-3 pr-4">Installed</th>
                <th className="text-left py-3 pr-4">Fixed</th>
                <th className="text-left py-3 pr-4">Severity</th>
                <th className="text-left py-3">CVSS</th>
              </tr>
            </thead>
            <tbody>
              {findings.map(f => (
                <tr key={f.id} className="border-b border-gray-800/50 hover:bg-gray-900">
                  <td className="py-3 pr-4">
                    <a href={`https://nvd.nist.gov/vuln/detail/${f.cve_id}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                      {f.cve_id}
                    </a>
                  </td>
                  <td className="py-3 pr-4 text-gray-300">{f.package_name}</td>
                  <td className="py-3 pr-4 text-gray-400">{f.installed_version}</td>
                  <td className="py-3 pr-4 text-gray-400">{f.fixed_version}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_COLORS[f.severity] ?? ''}`}>
                      {f.severity}
                    </span>
                  </td>
                  <td className="py-3 text-gray-400">{f.cvss_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
