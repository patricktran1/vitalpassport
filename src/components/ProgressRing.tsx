export function ProgressRing({ value, size = 92 }: { value: number; size?: number }) {
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 92 92" role="img" aria-label={`${value}% ready`}>
        <circle className="ring-bg" cx="46" cy="46" r={radius} />
        <circle className="ring-value" cx="46" cy="46" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div><strong>{value}%</strong><span>ready</span></div>
    </div>
  )
}
