interface FlagIconProps {
  className?: string;
}

export function CanadaFlag({ className = "h-5 w-5" }: FlagIconProps) {
  return (
    <svg viewBox="0 0 640 480" className={className} aria-label="Canada">
      <rect width="640" height="480" fill="#fff" />
      <rect width="160" height="480" fill="#d80621" />
      <rect x="480" width="160" height="480" fill="#d80621" />
      <polygon
        points="320,90 335,148 393,134 360,170 382,234 320,200 258,234 280,170 247,134 305,148"
        fill="#d80621"
      />
    </svg>
  );
}

export function FranceFlag({ className = "h-5 w-5" }: FlagIconProps) {
  return (
    <svg viewBox="0 0 640 480" className={className} aria-label="France">
      <rect width="640" height="480" fill="#fff" />
      <rect width="213.3" height="480" fill="#00267f" />
      <rect x="426.7" width="213.3" height="480" fill="#f31830" />
    </svg>
  );
}

export function UsaFlag({ className = "h-5 w-5" }: FlagIconProps) {
  return (
    <svg viewBox="0 0 640 480" className={className} aria-label="USA">
      <rect width="640" height="480" fill="#bd3d44" />
      <rect y="37" width="640" height="37" fill="#fff" />
      <rect y="111" width="640" height="37" fill="#fff" />
      <rect y="185" width="640" height="37" fill="#fff" />
      <rect y="259" width="640" height="37" fill="#fff" />
      <rect y="333" width="640" height="37" fill="#fff" />
      <rect y="407" width="640" height="37" fill="#fff" />
      <rect width="260" height="259" fill="#192f5d" />
      <g fill="#fff">
        {[...Array(9)].map((_, row) => (
          [...Array(row % 2 === 0 ? 6 : 5)].map((_, col) => (
            <circle
              key={`${row}-${col}`}
              cx={row % 2 === 0 ? 22 + col * 43 : 44 + col * 43}
              cy={14 + row * 28}
              r="8"
            />
          ))
        ))}
      </g>
    </svg>
  );
}
