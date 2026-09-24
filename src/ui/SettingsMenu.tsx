/**
 * Settings. Every control applies live and persists immediately; there is no
 * save button and no way to leave the game in an invalid state, because every
 * value is clamped on the way in and again on the way out of storage.
 *
 * Controls are split across three tabs so no tab needs much scrolling on a
 * phone. Every hit target is at least 44 px tall.
 */

import { ArrowLeft, Gamepad2, Monitor, RotateCcw, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CAMERA, MOVEMENT } from '../config/GameConfig';
import {
  JOYSTICK_MODES,
  JOYSTICK_SIDES,
  JOYSTICK_SIZE_MAX,
  JOYSTICK_SIZE_MIN,
  QUALITY_LEVELS,
  TOUCH_CONTROL_MODES,
} from '../persistence/SettingsStorage';
import type { Settings } from '../types';
import { hapticsSupported } from './device';
import { Modal } from './Modal';

interface SettingsMenuProps {
  settings: Settings;
  /** True on a touchscreen, for device-specific hints. */
  touch: boolean;
  onChange: (patch: Partial<Settings>) => void;
  onReset: () => void;
  onBack: () => void;
  onHover: () => void;
}

type Tab = 'display' | 'controls' | 'audio';

const TABS: readonly { id: Tab; label: string; Icon: typeof Monitor }[] = [
  { id: 'display', label: 'Display', Icon: Monitor },
  { id: 'controls', label: 'Controls', Icon: Gamepad2 },
  { id: 'audio', label: 'Audio', Icon: Volume2 },
];

/** The last tab viewed, so reopening Settings mid-session lands where you were. */
let rememberedTab: Tab | null = null;

interface SliderProps {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}

function Slider({ label, hint, value, min, max, step, format, onChange }: SliderProps): JSX.Element {
  const id = `setting-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const fill = ((value - min) / (max - min)) * 100;
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
        style={{ '--fill': `${fill}%` } as CSSProperties}
        aria-valuetext={format(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}

interface ChoiceProps<T extends string> {
  label: string;
  hint?: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  onHover: () => void;
}

function Choice<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
  onHover,
}: ChoiceProps<T>): JSX.Element {
  const labelId = `choice-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="field">
      <div className="field__header">
        <span className="field__label" id={labelId}>
          {label}
        </span>
      </div>
      <div className="segmented" role="group" aria-labelledby={labelId}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className="segmented__option"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            onMouseEnter={onHover}
          >
            {option}
          </button>
        ))}
      </div>
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}

interface SwitchProps {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  onHover: () => void;
}

function Switch({ label, hint, checked, disabled, onChange, onHover }: SwitchProps): JSX.Element {
  return (
    <div className="field">
      <button
        type="button"
        role="switch"
        className="toggle"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        onMouseEnter={onHover}
      >
        <span className="field__label">{label}</span>
        <span className="switch" aria-hidden="true">
          <span className="switch__thumb" />
        </span>
      </button>
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="settings-section">
      <h3 className="section-title">{title}</h3>
      {children}
    </section>
  );
}

const percent = (value: number): string => `${Math.round(value * 100)}%`;
const times = (value: number): string => `${value.toFixed(2)}×`;

export function SettingsMenu({
  settings,
  touch,
  onChange,
  onReset,
  onBack,
  onHover,
}: SettingsMenuProps): JSX.Element {
  const backRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<Tab>(() => rememberedTab ?? 'display');

  useEffect(() => {
    backRef.current?.focus({ preventScroll: true });
  }, []);

  const selectTab = (next: Tab): void => {
    rememberedTab = next;
    setTab(next);
  };

  const canVibrate = hapticsSupported();

  return (
    <Modal
      title="Settings"
      eyebrow="Applied instantly"
      backdrop="menu"
      size="lg"
      onClose={onBack}
      closeLabel="Close settings"
      className="modal--settings"
      footer={
        <div className="modal__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={onReset}
            onMouseEnter={onHover}
          >
            <RotateCcw size={18} strokeWidth={2} aria-hidden="true" />
            Defaults
          </button>
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
        </div>
      }
    >
      <div className="tabs" role="tablist" aria-label="Settings sections">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            className="tabs__tab"
            onClick={() => selectTab(id)}
            onMouseEnter={onHover}
          >
            <Icon size={18} strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div
        className="tab-panel"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        key={tab}
      >
        {tab === 'display' && (
          <>
            <Section title="Graphics">
              <Choice
                label="Quality"
                hint={touch ? 'Low or Medium keeps phones cool and smooth.' : undefined}
                options={QUALITY_LEVELS}
                value={settings.quality}
                onChange={(quality) => onChange({ quality })}
                onHover={onHover}
              />
              <Switch
                label="Bloom"
                checked={settings.bloom}
                onChange={(bloom) => onChange({ bloom })}
                onHover={onHover}
              />
              <Slider
                label="Bloom intensity"
                value={settings.bloomIntensity}
                min={0}
                max={2}
                step={0.05}
                format={times}
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
            </Section>
            <Section title="Camera">
              <Slider
                label="Field of view"
                value={settings.fov}
                min={CAMERA.FOV_MIN}
                max={CAMERA.FOV_MAX}
                step={1}
                format={(v) => `${Math.round(v)}°`}
                onChange={(fov) => onChange({ fov })}
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
                hint="How strongly colour and effects build as the run speeds up."
                value={settings.visualIntensity}
                min={0}
                max={1}
                step={0.05}
                format={percent}
                onChange={(visualIntensity) => onChange({ visualIntensity })}
              />
            </Section>
          </>
        )}

        {tab === 'controls' && (
          <>
            <Section title="Steering">
              <Slider
                label="Movement sensitivity"
                value={settings.movementSensitivity}
                min={MOVEMENT.SENSITIVITY_MIN}
                max={MOVEMENT.SENSITIVITY_MAX}
                step={0.05}
                format={times}
                onChange={(movementSensitivity) => onChange({ movementSensitivity })}
              />
            </Section>

            <Section title="Touch joystick">
              <Choice
                label="On-screen joystick"
                hint="Auto shows it whenever you play with a touchscreen."
                options={TOUCH_CONTROL_MODES}
                value={settings.touchControls}
                onChange={(touchControls) => onChange({ touchControls })}
                onHover={onHover}
              />
              <Choice
                label="Style"
                hint={
                  settings.joystickMode === 'floating'
                    ? 'Appears under your thumb wherever you touch, and follows it.'
                    : 'Stays in the corner; start your drag on the stick.'
                }
                options={JOYSTICK_MODES}
                value={settings.joystickMode}
                onChange={(joystickMode) => onChange({ joystickMode })}
                onHover={onHover}
              />
              <Choice
                label="Hand"
                options={JOYSTICK_SIDES}
                value={settings.joystickSide}
                onChange={(joystickSide) => onChange({ joystickSide })}
                onHover={onHover}
              />
              <Slider
                label="Joystick size"
                value={settings.joystickSize}
                min={JOYSTICK_SIZE_MIN}
                max={JOYSTICK_SIZE_MAX}
                step={0.05}
                format={percent}
                onChange={(joystickSize) => onChange({ joystickSize })}
              />
              <Switch
                label="Vibration"
                hint={canVibrate ? 'Pulses on near misses and impacts.' : 'Not supported on this device.'}
                checked={settings.haptics && canVibrate}
                disabled={!canVibrate}
                onChange={(haptics) => onChange({ haptics })}
                onHover={onHover}
              />
            </Section>

            <Section title="Keyboard">
              <ul className="keymap">
                <li>
                  <span className="keymap__keys">
                    <kbd>W</kbd>
                    <kbd>A</kbd>
                    <kbd>S</kbd>
                    <kbd>D</kbd>
                    <span className="keymap__or">or</span>
                    <kbd>↑</kbd>
                    <kbd>←</kbd>
                    <kbd>↓</kbd>
                    <kbd>→</kbd>
                  </span>
                  <span>Steer</span>
                </li>
                <li>
                  <span className="keymap__keys">
                    <kbd>Esc</kbd>
                  </span>
                  <span>Pause · back</span>
                </li>
              </ul>
            </Section>
          </>
        )}

        {tab === 'audio' && (
          <Section title="Volume">
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
        )}
      </div>
    </Modal>
  );
}
