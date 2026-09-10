export type Axis = "x" | "y" | "z";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SliceRotation {
  axis: Axis;
  /** Slice coordinate along `axis`: -1, 0 or 1. */
  index: number;
  /** +1 or -1, following the right-hand rule about `axis`. */
  direction: number;
}

const AXES: readonly Axis[] = ["x", "y", "z"];

/** A normal is only usable if it clearly points along one coordinate axis. */
function dominantAxis(v: Vec3): Axis | null {
  let best: Axis | null = null;
  let bestMagnitude = 0;

  for (const axis of AXES) {
    const magnitude = Math.abs(v[axis]);
    if (magnitude > bestMagnitude) {
      bestMagnitude = magnitude;
      best = axis;
    }
  }

  return bestMagnitude > 0.5 ? best : null;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function unitAlong(axis: Axis, sign: number): Vec3 {
  return { x: axis === "x" ? sign : 0, y: axis === "y" ? sign : 0, z: axis === "z" ? sign : 0 };
}

/**
 * Which slice a drag across a cube face should turn, and which way.
 *
 * `dragVector` is measured in world space between two points on the cube, so it
 * generally has a component along the face normal — the pointer ray can land on
 * a different cubie, or on a neighbouring face, part-way through a gesture. That
 * component says nothing about the gesture and is projected out first; letting
 * it through is what made drags rotate a slice chosen by the camera angle
 * rather than by the drag.
 *
 * The rule itself needs no per-face table. For a face normal `n` and an in-plane
 * drag direction `u`, the rotation axis is `n x u`: a point at the face centre
 * moving under that rotation has velocity `(n x u) x n = u`, i.e. it travels
 * exactly the way the pointer did.
 *
 * Returns null when the gesture is too small or too ambiguous to act on.
 */
export function resolveDragRotation(
  faceNormal: Vec3,
  dragVector: Vec3,
  cubieCenter: Vec3,
  minDragLength = 0
): SliceRotation | null {
  const normalAxis = dominantAxis(faceNormal);
  if (!normalAxis) return null;

  const normalSign = Math.sign(faceNormal[normalAxis]);
  const normal = unitAlong(normalAxis, normalSign);

  // Drop everything along the normal: only motion across the face is a gesture.
  const inPlane: Vec3 = {
    x: normalAxis === "x" ? 0 : dragVector.x,
    y: normalAxis === "y" ? 0 : dragVector.y,
    z: normalAxis === "z" ? 0 : dragVector.z,
  };

  const inPlaneLength = Math.hypot(inPlane.x, inPlane.y, inPlane.z);
  if (inPlaneLength < minDragLength || inPlaneLength === 0) return null;

  const dragAxis = dominantAxis({
    x: inPlane.x / inPlaneLength,
    y: inPlane.y / inPlaneLength,
    z: inPlane.z / inPlaneLength,
  });
  if (!dragAxis || dragAxis === normalAxis) return null;

  const dragSign = Math.sign(inPlane[dragAxis]);
  if (dragSign === 0) return null;

  const rotation = cross(normal, unitAlong(dragAxis, dragSign));
  const axis = dominantAxis(rotation);
  if (!axis) return null;

  return {
    axis,
    index: Math.round(cubieCenter[axis]),
    direction: Math.sign(rotation[axis]),
  };
}
