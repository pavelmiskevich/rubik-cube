import { resolveDragRotation, Vec3 } from "./dragRotation";

const X: Vec3 = { x: 1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };
// `+ 0` normalises -0, which Object.is (and so toEqual) treats as distinct from 0.
const neg = (v: Vec3): Vec3 => ({ x: -v.x + 0, y: -v.y + 0, z: -v.z + 0 });
const scale = (v: Vec3, k: number): Vec3 => ({ x: v.x * k, y: v.y * k, z: v.z * k });

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };

/**
 * A rotation of `direction` about `axis` moves the point at the centre of the
 * grabbed face. That velocity must point the way the pointer was dragged —
 * this is the property the whole gesture rests on, so the tests check it
 * directly instead of restating a table of expected axes.
 *
 * Velocity of point p under rotation about unit axis a is a x p.
 */
function faceCentreVelocity(axis: "x" | "y" | "z", direction: number, faceNormal: Vec3): Vec3 {
  const a: Vec3 = {
    x: axis === "x" ? direction : 0,
    y: axis === "y" ? direction : 0,
    z: axis === "z" ? direction : 0,
  };
  // `+ 0` normalises -0, which Object.is (and so toEqual) treats as distinct.
  return {
    x: a.y * faceNormal.z - a.z * faceNormal.y + 0,
    y: a.z * faceNormal.x - a.x * faceNormal.z + 0,
    z: a.x * faceNormal.y - a.y * faceNormal.x + 0,
  };
}

describe("resolveDragRotation", () => {
  const faces: Array<[string, Vec3]> = [
    ["right (+X)", X],
    ["left (-X)", neg(X)],
    ["top (+Y)", Y],
    ["bottom (-Y)", neg(Y)],
    ["front (+Z)", Z],
    ["back (-Z)", neg(Z)],
  ];

  describe.each(faces)("on the %s face", (_label, normal) => {
    // The two axes lying in this face.
    const inPlaneDirections = [X, neg(X), Y, neg(Y), Z, neg(Z)].filter(
      (d) => Math.abs(d.x * normal.x + d.y * normal.y + d.z * normal.z) < 0.5
    );

    it.each(inPlaneDirections.map((d) => [JSON.stringify(d), d] as const))(
      "turns the grabbed slice the way the pointer moved, for drag %s",
      (_name, drag) => {
        const result = resolveDragRotation(normal, scale(drag, 0.4), ORIGIN);
        expect(result).not.toBeNull();

        const velocity = faceCentreVelocity(result!.axis, result!.direction, normal);
        expect(velocity).toEqual(drag);
      }
    );
  });

  it("picks the slice containing the grabbed cubie", () => {
    // Front face, dragging up turns the x-slice the cubie sits in.
    expect(resolveDragRotation(Z, scale(Y, 0.4), { x: -1, y: 1, z: 1 })).toMatchObject({
      axis: "x",
      index: -1,
    });
    expect(resolveDragRotation(Z, scale(Y, 0.4), { x: 1, y: -1, z: 1 })).toMatchObject({
      axis: "x",
      index: 1,
    });
  });

  it("reverses when the drag reverses", () => {
    const up = resolveDragRotation(Z, scale(Y, 0.4), ORIGIN)!;
    const down = resolveDragRotation(Z, scale(neg(Y), 0.4), ORIGIN)!;

    expect(down.axis).toBe(up.axis);
    expect(down.index).toBe(up.index);
    expect(down.direction).toBe(-up.direction);
  });

  it("ignores motion along the face normal", () => {
    // Regression: the pointer ray hits cubies behind the grabbed one, so the
    // measured drag gained a large component straight into the cube. It used to
    // dominate the comparison and pick the slice by camera angle. Here a small
    // upward drag is buried under 3 units of inward motion and must still win.
    const buried: Vec3 = { x: 0, y: 0.05, z: -3 };
    const clean: Vec3 = { x: 0, y: 0.05, z: 0 };

    expect(resolveDragRotation(Z, buried, ORIGIN)).toEqual(resolveDragRotation(Z, clean, ORIGIN));
  });

  it("reproduces the logged failure as the correct turn", () => {
    // Captured from the browser: grab at (0.595, -0.347, 1.475) on the front
    // face, pointer moved 5px up. The genuine sample was (0.001, 0.053, 0); the
    // rotation actually taken came from a deeper hit, (-0.628, -0.178, -0.527).
    const grabbedCubie: Vec3 = { x: 1, y: 0, z: 1 };

    expect(resolveDragRotation(Z, { x: 0.001, y: 0.053, z: 0 }, grabbedCubie)).toEqual({
      axis: "x",
      index: 1,
      direction: -1,
    });
  });

  it("returns null for a gesture that is not usable", () => {
    expect(resolveDragRotation(Z, { x: 0, y: 0, z: 0 }, ORIGIN)).toBeNull();
    // Purely inward: no motion across the face at all.
    expect(resolveDragRotation(Z, { x: 0, y: 0, z: -2 }, ORIGIN)).toBeNull();
    // Normal that does not point along an axis.
    expect(resolveDragRotation({ x: 0.4, y: 0.4, z: 0.4 }, scale(Y, 0.4), ORIGIN)).toBeNull();
    // Below the caller's minimum drag length.
    expect(resolveDragRotation(Z, scale(Y, 0.05), ORIGIN, 0.2)).toBeNull();
  });
});
