/**
 * Credits. Original work; no third-party intellectual property is referenced.
 */

import {
  ArrowLeft,
  AudioLines,
  Box,
  Code2,
  Cpu,
  Layers,
  Shapes,
  Sparkles,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Modal } from './Modal';

interface CreditsProps {
  onBack: () => void;
  onHover: () => void;
}

interface Credit {
  role: string;
  name: string;
  Icon: LucideIcon;
}

const CREDITS: readonly Credit[] = [
  { role: 'Created by', name: 'Parth Bargoojar', Icon: User },
  { role: 'Rendering', name: 'Three.js / WebGL', Icon: Box },
  { role: 'Interface', name: 'React', Icon: Layers },
  { role: 'Language', name: 'TypeScript', Icon: Code2 },
  { role: 'Build', name: 'Vite', Icon: Cpu },
  { role: 'Icons', name: 'Lucide', Icon: Sparkles },
  { role: 'Audio', name: 'Web Audio API, synthesised', Icon: AudioLines },
  { role: 'Geometry & palettes', name: 'Procedural, seeded', Icon: Shapes },
];

export function Credits({ onBack, onHover }: CreditsProps): JSX.Element {
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    backRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <Modal
      title="Credits"
      eyebrow="VOIDRUSH v1.0"
      backdrop="menu"
      size="md"
      onClose={onBack}
      closeLabel="Close credits"
      footer={
        <button
          ref={backRef}
          type="button"
          className="button button--primary button--block"
          onClick={onBack}
          onMouseEnter={onHover}
        >
          <ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />
          Back
        </button>
      }
    >
      <p className="body-text">
        VOIDRUSH is an original browser game. Every shape, colour and sound in it is generated in
        code at runtime — there are no downloaded textures, models, fonts or audio files, and the
        whole game runs offline from static files.
      </p>

      <ul className="credits-list">
        {CREDITS.map(({ role, name, Icon }) => (
          <li key={role} className="credit">
            <span className="credit__icon">
              <Icon size={18} strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="credit__text">
              <span className="credit__role">{role}</span>
              <strong className="credit__name">{name}</strong>
            </span>
          </li>
        ))}
      </ul>

      <p className="tip">
        Add <code>?seed=</code> to the address to replay an exact run.
      </p>
    </Modal>
  );
}
