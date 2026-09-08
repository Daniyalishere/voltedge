export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="relative inline-grid place-items-center rounded-xl"
        style={{
          width: size,
          height: size,
          background: "linear-gradient(135deg, #34e5a0, #059669)",
          boxShadow: "0 8px 22px -10px rgba(16,185,129,0.9)",
        }}
      >
        <svg
          width={size * 0.55}
          height={size * 0.55}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M13 2 4.5 13.2c-.4.5 0 1.3.7 1.3H10l-1 7.5 8.5-11.2c.4-.5 0-1.3-.7-1.3H12l1-7.5Z"
            fill="#04140d"
          />
        </svg>
      </span>
      <span className="text-[1.05rem] font-semibold tracking-tight text-mist-100">
        Volt<span className="text-volt-400">Edge</span>
      </span>
    </span>
  );
}
