/**
 * Settings. Every control applies live and persists immediately; there is no
 * save button and no way to leave the game in an invalid state, because every
 * value is clamped on the way in and again on the way out of storage.
 *
 * Controls are split across three tabs so no tab needs much scrolling on a
 * phone. Every hit target is at least 44 px tall.
 */

import { ArrowLeft, Crosshair, Gamepad2, Monitor, RotateCcw, Smartphone, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CAMERA, MOVEMENT } from '../config/GameConfig';
import { TILT } from '../config/TiltConfig';
import {
  CONTROL_MODES,
  JOYSTICK_MODES,
  JOYSTICK_SIDES,
  JOYSTICK_SIZE_MAX,
  JOYSTICK_SIZE_MIN,
  QUALITY_LEVELS,
  TOUCH_CONTROL_MODES,
} from '../persistence/SettingsStorage';
import type { ControlInfo, Settings, TiltStatus } from '../types';
import { hapticsSupported } from './device';
import { Modal } from './Modal';

interface SettingsMenuProps {
  settings: Settings;
  /** True on a touchscreen, for device-specific hints. */
  touch: boolean;
  /** Which source steers and how tilt is doing. */
  control: ControlInfo;
  onChange: (patch: Partial<Settings>) => void;
  /** Asks for motion access (iOS) or retries a silent sensor. A user gesture. */
  onEnableTilt: () => void;
  onRecalibrate: () => void;
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
  formatOption?: (value: T) => string;
  onChange: (value: T) => void;
  onHover: () => void;
}

function Choice<T extends string>({
  label,
  hint,
  options,
  value,
  formatOption,
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
            {formatOption ? formatOption(option) : option}
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

/** Plain-language tilt status for the Controls tab. */
function tiltStatusText(status: TiltStatus, control: ControlInfo): string {
  switch (status) {
    case 'unsupported':
      return 'This browser does not report device motion.';
    case 'needs-permission':
      return 'Motion access is needed before tilt can steer.';
    case 'denied':
      return 'Motion access was denied. Allow it for this site in your browser settings, then try again.';
    case 'unavailable':
      return 'No motion sensor responded on this device.';
    case 'waiting':
      return 'Waiting for the motion sensor…';
    case 'lost':
      return 'Tilt signal lost. It resumes as soon as the sensor reports again.';
    case 'active':
      return control.calibrated
        ? 'Tilt is steering and calibrated.'
        : 'Tilt is ready. It calibrates before your next run.';
    default:
      return control.touchPrimary
        ? 'Tilt is off in this control mode.'
        : 'Auto uses tilt on phones and tablets.';
  }
}

const percent = (value: number): string => `${Math.round(value * 100)}%`;
const times = (value: number): string => `${value.toFixed(2)}×`;

export function SettingsMenu({
  settings,
  touch,
  control,
  onChange,
  onEnableTilt,
  onRecalibrate,
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
  const tiltSteering = control.active === 'tilt';
  const canEnableTilt =
    control.status === 'needs-permission' ||
    control.status === 'denied' ||
    control.status === 'unavailable';

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
              <Choice
                label="Control mode"
                hint={
                  settings.controlMode === 'auto'
                    ? (control.touchPrimary
                        ? 'Auto: touch joystick on mobile, keyboard on desktop.'
                        : 'Auto: keyboard on desktop, touch joystick on mobile.')
                    : settings.controlMode === 'tilt'
                      ? (settings.controlMode !== control.active
                          ? 'Tilt is not available here, so touch joystick steers instead.'
                          : 'Tilt: steer by tilting your device.')
                      : (control.touchPrimary
                          ? 'Joystick: steer with on-screen stick.'
                          : 'Keyboard: steer with W/A/S/D or arrow keys.')
                }
                options={CONTROL_MODES}
                value={settings.controlMode}
                formatOption={(mode) => {
                  if (mode === 'keyboard' && control.touchPrimary) return 'joystick';
                  return mode;
                }}
                onChange={(controlMode) => onChange({ controlMode })}
                onHover={onHover}
              />
            </Section>

            {settings.controlMode === 'tilt' ? (
              <Section title="Tilt">
                <div className="field">
                  <p className="tilt-status" data-status={control.status} role="status">
                    <Smartphone size={16} strokeWidth={2} aria-hidden="true" />
                    <span>{tiltStatusText(control.status, control)}</span>
                  </p>
                  <div className="tilt-actions">
                    {canEnableTilt && (
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={onEnableTilt}
                        onMouseEnter={onHover}
                      >
                        <Smartphone size={18} strokeWidth={2} aria-hidden="true" />
                        {control.status === 'unavailable' ? 'Retry tilt' : 'Enable tilt'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={onRecalibrate}
                      onMouseEnter={onHover}
                      disabled={!tiltSteering}
                    >
                      <Crosshair size={18} strokeWidth={2} aria-hidden="true" />
                      Recalibrate tilt
                    </button>
                  </div>
                </div>
                <Slider
                  label="Tilt sensitivity"
                  hint={`Full speed at about ${Math.round(TILT.MAX_TILT / settings.tiltSensitivity)}° of tilt.`}
                  value={settings.tiltSensitivity}
                  min={TILT.SENSITIVITY_MIN}
                  max={TILT.SENSITIVITY_MAX}
                  step={0.05}
                  format={times}
                  onChange={(tiltSensitivity) => onChange({ tiltSensitivity })}
                />
                <Slider
                  label="Tilt dead zone"
                  hint="Tilt this small is ignored, so a steady hand holds a steady line."
                  value={settings.tiltDeadZone}
                  min={TILT.DEAD_ZONE_MIN}
                  max={TILT.DEAD_ZONE_MAX}
                  step={0.5}
                  format={(v) => `${v.toFixed(1)}°`}
                  onChange={(tiltDeadZone) => onChange({ tiltDeadZone })}
                />
                <Switch
                  label="Invert horizontal"
                  checked={settings.tiltInvertX}
                  onChange={(tiltInvertX) => onChange({ tiltInvertX })}
                  onHover={onHover}
                />
                <Switch
                  label="Invert vertical"
                  hint="Off: tip the top edge away to climb. On: flight-stick style, tip away to dive."
                  checked={settings.tiltInvertY}
                  onChange={(tiltInvertY) => onChange({ tiltInvertY })}
                  onHover={onHover}
                />
              </Section>
            ) : (
              <>
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
                      settings.joystickMode === 'dynamic'
                        ? 'Appears under your thumb anywhere on its half of the screen, then holds still while you steer.'
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

                {!control.touchPrimary && (
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
                )}
              </>
            )}
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
