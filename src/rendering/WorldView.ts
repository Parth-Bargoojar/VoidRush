/**
 * VOIDRUSH — the bridge from simulation state to Three.js objects.
 *
 * Two ideas keep this cheap:
 *
 *  1. Obstacle meshes are built from `getSolidVolumes`' own source data, the
 *     `parts` array. The rendered geometry and the collision geometry are the
 *     same list, so a solid that is visible but not collidable cannot exist.
 *
 *  2. Instance matrices are baked once, when a body appears, in the body's
 *     local space. Per frame only the body's own transform moves — one position
 *     and one rotation per obstacle rather than one matrix per box.
 */

import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { RENDER, WORLD } from '../config/GameConfig';
import { UNIT_BOX } from './Geometries';
import { MATERIALS } from './Materials';
import type { ResolvedPalette } from './Palettes';
import type { BaseObstacle, RenderBody } from '../obstacles/Obstacle';
import type { ObstacleTransform, PartRole } from '../types';
import type { TunnelSegment } from '../world/TunnelSegment';
import { BLOCKS_PER_SEGMENT } from '../world/TunnelGenerator';

const SCRATCH_MATRIX = new Matrix4();
const SCRATCH_POSITION = new Vector3();
const SCRATCH_SCALE = new Vector3();
const IDENTITY_QUATERNION = new Quaternion();
const SCRATCH_QUATERNION = new Quaternion();
const FORWARD_AXIS = new Vector3(0, 0, 1);
const SCRATCH_COLOR = new Color();
const SCRATCH_TRANSFORM: ObstacleTransform = { tx: 0, ty: 0, theta: 0 };
const SCRATCH_BODIES: RenderBody[] = [];

function roleColour(role: PartRole, palette: ResolvedPalette): number {
  switch (role) {
    case 'primary':
      return palette.obstaclePrimary;
    case 'secondary':
      return palette.obstacleSecondary;
    default:
      return palette.obstacleAccent;
  }
}

/* ------------------------------------------------------------------ *
 * Tunnel
 * ------------------------------------------------------------------ */

/** One pooled tunnel segment: a lit block mesh plus an unlit accent mesh. */
class SegmentView {
  readonly group = new Group();
  private readonly base: InstancedMesh;
  private readonly accent: InstancedMesh;
  private builtIndex = -1;

  constructor() {
    this.base = new InstancedMesh(UNIT_BOX, MATERIALS.tunnel, BLOCKS_PER_SEGMENT);
    this.accent = new InstancedMesh(UNIT_BOX, MATERIALS.tunnelAccent, BLOCKS_PER_SEGMENT);
    for (const mesh of [this.base, this.accent]) {
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.group.add(mesh);
    }
  }

  /** Rebuilds instance data. Only runs when a segment is recycled. */
  private build(segment: TunnelSegment, palette: ResolvedPalette): void {
    let baseCount = 0;
    let accentCount = 0;
    for (const block of segment.pattern) {
      const size = block.depth * 2;
      SCRATCH_POSITION.set(block.x, block.y, block.z);
      SCRATCH_SCALE.set(size, size, size);
      // [PRD 6] Rolled and chamfered sections turn their blocks about Z.
      const rotation =
        block.rot === 0
          ? IDENTITY_QUATERNION
          : SCRATCH_QUATERNION.setFromAxisAngle(FORWARD_AXIS, block.rot);
      SCRATCH_MATRIX.compose(SCRATCH_POSITION, rotation, SCRATCH_SCALE);
      if (block.accent) {
        this.accent.setMatrixAt(accentCount, SCRATCH_MATRIX);
        SCRATCH_COLOR.setHex(palette.tunnelAccent);
        this.accent.setColorAt(accentCount, SCRATCH_COLOR);
        accentCount += 1;
      } else {
        this.base.setMatrixAt(baseCount, SCRATCH_MATRIX);
        // Per-block variation so the walls read as masonry rather than a flat
        // plane. Capped at 1.0: a block must never render brighter than the
        // base tone the obstacle-contrast check is computed against.
        const shade = 0.6 + ((block.wall * 7 + baseCount) % 11) / 27.5;
        SCRATCH_COLOR.setHex(palette.tunnelBase).multiplyScalar(shade);
        this.base.setColorAt(baseCount, SCRATCH_COLOR);
        baseCount += 1;
      }
    }
    this.base.count = baseCount;
    this.accent.count = accentCount;
    this.base.instanceMatrix.needsUpdate = true;
    this.accent.instanceMatrix.needsUpdate = true;
    if (this.base.instanceColor) this.base.instanceColor.needsUpdate = true;
    if (this.accent.instanceColor) this.accent.instanceColor.needsUpdate = true;
  }

  sync(segment: TunnelSegment, distance: number, palette: ResolvedPalette, repaint: boolean): void {
    if (repaint || segment.index !== this.builtIndex) {
      this.build(segment, palette);
      this.builtIndex = segment.index;
    }
    this.group.position.z = segment.zAt(distance);
  }

  dispose(): void {
    this.base.dispose();
    this.accent.dispose();
  }
}

export class TunnelView {
  readonly group = new Group();
  private readonly views: SegmentView[] = [];

  constructor() {
    for (let i = 0; i < WORLD.SEGMENT_COUNT; i += 1) {
      const view = new SegmentView();
      this.views.push(view);
      this.group.add(view.group);
    }
  }

  sync(segments: readonly TunnelSegment[], distance: number, palette: ResolvedPalette, repaint: boolean): void {
    for (let i = 0; i < segments.length && i < this.views.length; i += 1) {
      this.views[i]!.sync(segments[i]!, distance, palette, repaint);
    }
  }

  get drawCalls(): number {
    return this.views.length * 2;
  }

  dispose(): void {
    for (const view of this.views) view.dispose();
  }
}

/* ------------------------------------------------------------------ *
 * Obstacles
 * ------------------------------------------------------------------ */

/** One rigidly-moving obstacle body: spinning parts and static parts. */
class BodyView {
  readonly spin: InstancedMesh;
  readonly still: InstancedMesh;
  inUse = false;

  constructor(parent: Object3D) {
    this.spin = new InstancedMesh(UNIT_BOX, MATERIALS.obstacle, RENDER.OBSTACLE_INSTANCE_CAPACITY);
    this.still = new InstancedMesh(UNIT_BOX, MATERIALS.obstacle, RENDER.OBSTACLE_INSTANCE_CAPACITY);
    for (const mesh of [this.spin, this.still]) {
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.visible = false;
      parent.add(mesh);
    }
  }

  /** Bakes the body's boxes into local instance matrices. Runs once per spawn. */
  build(source: BaseObstacle, palette: ResolvedPalette): void {
    let spinCount = 0;
    let stillCount = 0;
    for (const part of source.parts) {
      SCRATCH_POSITION.set(part.ox, part.oy, part.oz);
      SCRATCH_SCALE.set(part.hx * 2, part.hy * 2, part.hz * 2);
      SCRATCH_MATRIX.compose(SCRATCH_POSITION, IDENTITY_QUATERNION, SCRATCH_SCALE);
      SCRATCH_COLOR.setHex(roleColour(part.role, palette));

      const mesh = part.spins ? this.spin : this.still;
      const index = part.spins ? spinCount : stillCount;
      if (index >= RENDER.OBSTACLE_INSTANCE_CAPACITY) continue;
      mesh.setMatrixAt(index, SCRATCH_MATRIX);
      mesh.setColorAt(index, SCRATCH_COLOR);
      if (part.spins) spinCount += 1;
      else stillCount += 1;
    }

    this.spin.count = spinCount;
    this.still.count = stillCount;
    this.spin.visible = spinCount > 0;
    this.still.visible = stillCount > 0;
    this.spin.instanceMatrix.needsUpdate = true;
    this.still.instanceMatrix.needsUpdate = true;
    if (this.spin.instanceColor) this.spin.instanceColor.needsUpdate = true;
    if (this.still.instanceColor) this.still.instanceColor.needsUpdate = true;
  }

  /** Per-frame update: one position and one rotation, whatever the box count. */
  place(source: BaseObstacle, z: number, time: number): void {
    const transform = source.transformAt(time, SCRATCH_TRANSFORM);
    this.spin.position.set(transform.tx, transform.ty, z);
    this.spin.rotation.z = transform.theta;
    this.still.position.set(transform.tx, transform.ty, z);
  }

  release(): void {
    this.inUse = false;
    this.spin.visible = false;
    this.still.visible = false;
    this.spin.count = 0;
    this.still.count = 0;
  }

  dispose(): void {
    this.spin.dispose();
    this.still.dispose();
  }
}

export class ObstacleView {
  readonly group = new Group();
  private readonly pool: BodyView[] = [];
  /** Bodies currently assigned to a live obstacle, keyed by obstacle id. */
  private readonly assigned = new Map<number, BodyView[]>();
  private activeDrawCalls = 0;

  /**
   * Reconciles the live obstacle list with the mesh pool, then places every
   * body. Bodies are built only when an obstacle id first appears.
   */
  sync(
    active: readonly BaseObstacle[],
    distance: number,
    time: number,
    palette: ResolvedPalette,
    repaint: boolean,
  ): void {
    // Retire bodies whose obstacle has been recycled.
    for (const [id, bodies] of this.assigned) {
      if (!active.some((obstacle) => obstacle.id === id)) {
        for (const body of bodies) body.release();
        this.assigned.delete(id);
      }
    }

    this.activeDrawCalls = 0;
    for (const obstacle of active) {
      const count = obstacle.renderBodies(SCRATCH_BODIES);
      let bodies = this.assigned.get(obstacle.id);
      const isNew = bodies === undefined || bodies.length !== count;

      if (isNew) {
        if (bodies) for (const body of bodies) body.release();
        bodies = [];
        for (let i = 0; i < count; i += 1) bodies.push(this.acquire());
        this.assigned.set(obstacle.id, bodies);
      }

      for (let i = 0; i < count; i += 1) {
        const slot = SCRATCH_BODIES[i]!;
        const body = bodies![i]!;
        if (isNew || repaint) body.build(slot.source, palette);
        body.place(slot.source, distance - obstacle.zeroDistance + slot.zOffset, time);
        if (body.spin.visible) this.activeDrawCalls += 1;
        if (body.still.visible) this.activeDrawCalls += 1;
      }
    }
  }

  /** Drops every assignment, for a restart or a return to the menu. */
  clear(): void {
    for (const bodies of this.assigned.values()) {
      for (const body of bodies) body.release();
    }
    this.assigned.clear();
    this.activeDrawCalls = 0;
  }

  private acquire(): BodyView {
    for (const body of this.pool) {
      if (!body.inUse) {
        body.inUse = true;
        return body;
      }
    }
    const body = new BodyView(this.group);
    body.inUse = true;
    this.pool.push(body);
    return body;
  }

  get drawCalls(): number {
    return this.activeDrawCalls;
  }

  get bodyCount(): number {
    return this.pool.length;
  }

  dispose(): void {
    for (const body of this.pool) body.dispose();
  }
}
