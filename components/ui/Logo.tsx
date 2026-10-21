interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className }: LogoProps) {
  const spokes = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="32" cy="32" r="30" fill="#1f4e9c" stroke="#f5a03a" strokeWidth="3" />
      <circle cx="32" cy="32" r="19" fill="none" stroke="#ffffff" strokeWidth="2" />
      {spokes.map((deg) => (
        <line
          key={deg}
          x1="32"
          y1="14"
          x2="32"
          y2="22"
          stroke="#ffffff"
          strokeWidth="1.4"
          transform={`rotate(${deg} 32 32)`}
        />
      ))}
      <circle cx="32" cy="32" r="3.5" fill="#f5a03a" />
    </svg>
  );
}

export default Logo;
