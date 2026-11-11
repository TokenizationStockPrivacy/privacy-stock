import { useId } from 'react';

/**
 * Faceted, monochrome apple drawn as SVG. It is an original shape, not Apple Inc.'s logo.
 * Three facets (dark left, light right, bright highlight) give it the same sculpted look as the hero object.
 */
export function AppleMark({
  className,
  animated = false,
  label,
}: {
  className?: string;
  animated?: boolean;
  /** When set, the mark is announced to screen readers. Otherwise it is decorative. */
  label?: string;
}) {
  const clipId = useId();
  const body =
    'M100 62 C84 46 46 44 26 70 C6 96 8 140 22 170 C36 202 62 222 84 214 C92 211 108 211 116 214 C138 222 164 202 178 170 C192 140 194 96 174 70 C154 44 116 46 100 62 Z';

  return (
    <svg
      viewBox="0 0 200 230"
      className={`${className ?? ''} ${animated ? 'apple-float' : ''}`.trim()}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={body} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <path d={body} className="apple-base" />
        <polygon points="0,0 100,62 98,230 0,230" className="apple-facet-dark" />
        <polygon points="100,62 200,0 200,230 98,230" className="apple-facet-light" />
        <polygon points="100,62 116,126 98,230 84,150" className="apple-facet-mid" />
        <ellipse cx="62" cy="96" rx="18" ry="9" transform="rotate(-28 62 96)" className="apple-highlight" />
      </g>
      <path d="M100 62 C99 48 101 34 108 22" className="apple-stem" />
      <path d="M106 40 C116 18 140 12 158 16 C152 38 130 50 106 40 Z" className="apple-leaf" />
    </svg>
  );
}
