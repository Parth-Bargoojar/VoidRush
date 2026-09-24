/**
 * Settings. Every control applies live and persists immediately; there is no
 * save button and no way to leave the game in an invalid state, because every
 * value is clamped on the way in and again on the way out of storage.
 */

import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { CAMERA, MOVEMENT } from '../config/GameConfig';
import { QUALITY_LEVELS } from '../persistence/SettingsStorage';
import type { QualityLevel, Settings } from '../types';

interface SettingsMenuProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onReset: () => void;
  onBack: () => void;
  onHover: () => void;
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, format, onChange }: SliderProps): JSX.Element {
  const id = `setting-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="field">
      <div className="field__header">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        <span className="field__value">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <>
      <h3 className="section-title">{title}</h3>
      {children}
    </>
  );
}

const percent = (value: number): string => `${Math.round(value * 100)}%`;

export function SettingsMenu({
  settings,
  onChange,
  onReset,
  onBack,
  onHover,
}: SettingsMenuProps): JSX.Element {
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  return (
    <div className="screen screen--menu" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="panel panel--wide">
        <h2 className="heading">Settings</h2>

        <Section title="Graphics">
          <div className="field">
            <div className="field__header">
              <span className="field__label" id="quality-label">
                Quality
              </span>
            </div>
            <div className="segmented" role="group" aria-labelledby="quality-label">
              {QUALITY_LEVELS.map((level: QualityLevel) => (
                <button
                  key={level}
                  type="button"
                  className="segmented__option"
                  aria-pressed={settings.quality === level}
                  onClick={() => onChange({ quality: level })}
                  onMouseEnter={onHover}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <button
              type="button"
              className="toggle"
              aria-pressed={settings.bloom}
              onClick={() => onChange({ bloom: !settings.bloom })}
              onMouseEnter={onHover}
            >
              <span className="field__label">Bloom</span>
              <span className="toggle__state">{settings.bloom ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <Slider
            label="Bloom intensity"
            value={settings.bloomIntensity}
            min={0}
            max={2}
            step={0.05}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={(bloomIntensity) => onChange({ bloomIntensity })}
          />
          <Slider
            label="Effects intensity"
            value={settings.effectsIntensity}
            min={0}
            max={1}
            step={0.05}
            format={percent}
            onChange={(effectsIntensity) => onChange({ effectsIntensity })}
          />
          <Slider
            label="Field of view"
            value={settings.fov}
            min={CAMERA.FOV_MIN}
            max={CAMERA.FOV_MAX}
            step={1}
            format={(v) => `${Math.round(v)}°`}
            onChange={(fov) => onChange({ fov })}
          />
        </Section>

        <Section title="Gameplay">
          <Slider
            label="Movement sensitivity"
            value={settings.movementSensitivity}
            min={MOVEMENT.SENSITIVITY_MIN}
            max={MOVEMENT.SENSITIVITY_MAX}
            step={0.05}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={(movementSensitivity) => onChange({ movementSensitivity })}
          />
          <Slider
            label="Camera shake"
            value={settings.cameraShake}
            min={0}
            max={1}
            step={0.05}
            format={percent}
            onChange={(cameraShake) => onChange({ cameraShake })}
          />
          <Slider
            label="Visual intensity"
            value={settings.visualIntensity}
            min={0}
            max={1}
            step={0.05}
            format={percent}
            onChange={(visualIntensity) => onChange({ visualIntensity })}
          />
        </Section>

        <Section title="Audio">
          <Slider
            label="Master volume"
            value={settings.masterVolume}
            min={0}
            max={1}
            step={0.05}
            format={percent}
            onChange={(masterVolume) => onChange({ masterVolume })}
          />
          <Slider
            label="Music"
            value={settings.musicVolume}
            min={0}
            max={1}
            step={0.05}
            format={percent}
            onChange={(musicVolume) => onChange({ musicVolume })}
          />
          <Slider
            label="Sound effects"
            value={settings.sfxVolume}
            min={0}
            max={1}
            step={0.05}
            format={percent}
            onChange={(sfxVolume) => onChange({ sfxVolume })}
          />
        </Section>

        <div className="button-row" style={{ marginTop: 'var(--space-6)' }}>
          <button
            ref={backRef}
            type="button"
            className="button button--primary"
            onClick={onBack}
            onMouseEnter={onHover}
          >
            <ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />
            Back
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={onReset}
            onMouseEnter={onHover}
          >
            <RotateCcw size={20} strokeWidth={2} aria-hidden="true" />
            Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
