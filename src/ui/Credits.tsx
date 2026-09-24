/**
 * Credits. Original work; no third-party intellectual property is referenced.
 */

import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface CreditsProps {
  onBack: () => void;
  onHover: () => void;
}

export function Credits({ onBack, onHover }: CreditsProps): JSX.Element {
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  return (
    <div className="screen screen--menu" role="dialog" aria-modal="true" aria-label="Credits">
      <div className="panel panel--wide">
        <h2 className="heading">Credits</h2>

        <p className="body-text">
          VOIDRUSH is an original browser game. Every shape, colour and sound in it is generated in
          code at runtime — there are no downloaded textures, models, fonts or audio files, and the
          whole game runs offline from static files.
        </p>

        <ul className="credits-list">
          <li>
            <span>Rendering</span>
            <strong>Three.js / WebGL</strong>
          </li>
          <li>
            <span>Interface</span>
            <strong>React</strong>
          </li>
          <li>
            <span>Language</span>
            <strong>TypeScript</strong>
          </li>
          <li>
            <span>Build</span>
            <strong>Vite</strong>
          </li>
          <li>
            <span>Icons</span>
            <strong>Lucide</strong>
          </li>
          <li>
            <span>Audio</span>
            <strong>Web Audio API, synthesised</strong>
          </li>
          <li>
            <span>Geometry &amp; palettes</span>
            <strong>Procedural, seeded</strong>
          </li>
        </ul>

        <p className="caption" style={{ marginBottom: 'var(--space-6)' }}>
          Add <strong>?seed=</strong> to the address to replay an exact run.
        </p>

        <button
          ref={backRef}
          type="button"
          className="button button--primary"
          style={{ width: '100%' }}
          onClick={onBack}
          onMouseEnter={onHover}
        >
          <ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />
          Back
        </button>
      </div>
    </div>
  );
}
