"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Axis, resolveDragRotation } from "./dragRotation";

// Sticker colours in BoxGeometry material order: right, left, top, bottom, front, back.
const COLORS = ["#B90000", "#FF5900", "#FFFFFF", "#FFD500", "#009B48", "#0045AD"];

const CUBIE_SIZE = 0.95;
const DRAG_THRESHOLD = 0.2;
const DEFAULT_DURATION = 300;

interface RubiksCubeProps {
  onRotateEnd?: () => void;
}

export interface RubiksCubeRef {
  /** Rotates the slice at `index` (-1 | 0 | 1) around `axis`. Resolves when the animation ends. */
  rotateSlice: (axis: Axis, index: number, direction: number, duration?: number) => Promise<void>;
}

/** Geometry and the seven materials, created once per mount and disposed with it. */
function useCubeResources() {
  const resources = useMemo(() => {
    const geometry = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);
    const stickers = COLORS.map(
      (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.1, metalness: 0.1 })
    );
    const inner = new THREE.MeshStandardMaterial({ color: "#222222", roughness: 1.0 });
    return { geometry, stickers, inner };
  }, []);

  useEffect(() => {
    return () => {
      resources.geometry.dispose();
      resources.stickers.forEach((material) => material.dispose());
      resources.inner.dispose();
    };
  }, [resources]);

  return resources;
}

const CubeCore = forwardRef<
  RubiksCubeRef,
  RubiksCubeProps & { setOrbitEnabled: (enabled: boolean) => void }
>(({ onRotateEnd, setOrbitEnabled }, ref) => {
  const groupRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group>(null);
  const cubiesRef = useRef<THREE.Mesh[]>([]);

  const animating = useRef(false);
  const animQueue = useRef<Array<() => void>>([]);
  const rafRef = useRef<number | null>(null);
  const mounted = useRef(true);

  const dragStart = useRef<{
    point: THREE.Vector3;
    normal: THREE.Vector3;
    mesh: THREE.Mesh;
  } | null>(null);

  const { geometry, stickers, inner } = useCubeResources();

  const materialsFor = useCallback(
    (x: number, y: number, z: number) => [
      x === 1 ? stickers[0] : inner, // right
      x === -1 ? stickers[1] : inner, // left
      y === 1 ? stickers[2] : inner, // top
      y === -1 ? stickers[3] : inner, // bottom
      z === 1 ? stickers[4] : inner, // front
      z === -1 ? stickers[5] : inner, // back
    ],
    [stickers, inner]
  );

  // Build the 27 cubies once the group exists.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    cubiesRef.current = [];
    group.clear();

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const mesh = new THREE.Mesh(geometry, materialsFor(x, y, z));
          mesh.position.set(x, y, z);
          mesh.userData = { logicalPosition: new THREE.Vector3(x, y, z) };
          cubiesRef.current.push(mesh);
          group.add(mesh);
        }
      }
    }

    return () => {
      group.clear();
      cubiesRef.current = [];
    };
  }, [geometry, materialsFor]);

  // Any in-flight animation and every queued rotation must settle on unmount,
  // otherwise their callers await a promise that can never resolve.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      animating.current = false;
      const pending = animQueue.current;
      animQueue.current = [];
      pending.forEach((settle) => settle());
    };
  }, []);

  const runNext = useCallback(() => {
    const next = animQueue.current.shift();
    next?.();
  }, []);

  const rotateSlice = useCallback(
    (axis: Axis, index: number, direction: number, duration = DEFAULT_DURATION): Promise<void> =>
      new Promise((resolve) => {
        // Math.sign() returns 0 for a perfectly axis-aligned drag; animating a
        // zero-degree turn would still re-snap every cubie for no visible change.
        if (direction === 0) {
          resolve();
          return;
        }

        const task = () => {
          const group = groupRef.current;
          const pivot = pivotRef.current;
          if (!group || !pivot || !mounted.current) {
            resolve();
            runNext();
            return;
          }

          animating.current = true;
          pivot.rotation.set(0, 0, 0);
          pivot.updateMatrixWorld();

          const activeCubies: THREE.Mesh[] = [];
          cubiesRef.current.forEach((cubie) => {
            const worldPos = new THREE.Vector3();
            cubie.getWorldPosition(worldPos);
            if (Math.round(worldPos[axis]) === index) {
              activeCubies.push(cubie);
              pivot.attach(cubie);
            }
          });

          const targetRotation = (direction * Math.PI) / 2;
          const startTime = performance.now();

          const animate = () => {
            const progress = Math.min((performance.now() - startTime) / duration, 1);
            // easeInOutQuad
            const ease =
              progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

            pivot.rotation[axis] = targetRotation * ease;

            if (progress < 1) {
              rafRef.current = requestAnimationFrame(animate);
              return;
            }

            rafRef.current = null;
            pivot.rotation[axis] = targetRotation;
            pivot.updateMatrixWorld();

            activeCubies.forEach((cubie) => {
              group.attach(cubie);
              const worldPos = new THREE.Vector3();
              cubie.getWorldPosition(worldPos);
              cubie.userData.logicalPosition.set(
                Math.round(worldPos.x),
                Math.round(worldPos.y),
                Math.round(worldPos.z)
              );
            });

            pivot.rotation.set(0, 0, 0);
            animating.current = false;
            onRotateEnd?.();
            resolve();
            runNext();
          };

          rafRef.current = requestAnimationFrame(animate);
        };

        if (animating.current) {
          animQueue.current.push(task);
        } else {
          task();
        }
      }),
    [onRotateEnd, runNext]
  );

  useImperativeHandle(ref, () => ({ rotateSlice }), [rotateSlice]);

  /** One slice turn per press: stop tracking, but keep the camera pinned. */
  const endSliceGesture = useCallback(() => {
    dragStart.current = null;
  }, []);

  /**
   * Release. OrbitControls armed its own rotate on the same pointerdown, before
   * `enabled` could go false, and it stays armed until the button comes up — so
   * handing control back any earlier than this let the camera swing away in the
   * middle of a turn.
   */
  const endPointerSession = useCallback(() => {
    dragStart.current = null;
    setOrbitEnabled(true);
  }, [setOrbitEnabled]);

  // The session ends when the button is released, wherever that happens — the
  // pointer may well be off the canvas by then. It must NOT end when the
  // pointer crosses from one cubie to the next: react-three-fiber raises
  // pointerout for that too, which used to kill any drag long enough to leave
  // the cubie it started on.
  useEffect(() => {
    const stop = () => endPointerSession();
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [endPointerSession]);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (animating.current) return;

    setOrbitEnabled(false);
    dragStart.current = {
      point: event.point.clone(),
      normal:
        event.face?.normal?.clone().transformDirection(event.object.matrixWorld).round() ??
        new THREE.Vector3(),
      mesh: event.object as THREE.Mesh,
    };
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!dragStart.current || animating.current) return;

    // The ray crosses several cubies, and react-three-fiber dispatches this
    // handler once per intersection, nearest first. Only the nearest one is on
    // the surface the user grabbed; the rest report points deep inside the cube.
    // Without this, a move below the threshold returned and let the next, deeper
    // dispatch decide the turn from a vector pointing along the camera ray.
    event.stopPropagation();

    // Track the pointer against the plane of the grabbed face rather than the
    // point it happens to hit. Once a drag slides past a corner onto the next
    // face, every further hit point moves across that other face, so the
    // gesture stopped accumulating and quietly died near a face edge.
    const { point: start, normal } = dragStart.current;
    const facePlane = new THREE.Plane(normal, -normal.dot(start));
    const onPlane = event.ray.intersectPlane(facePlane, new THREE.Vector3());
    if (!onPlane) return;

    const dragVector = onPlane.sub(start);

    const origin = new THREE.Vector3();
    dragStart.current.mesh.getWorldPosition(origin);

    const rotation = resolveDragRotation(
      normal,
      dragVector,
      origin,
      DRAG_THRESHOLD
    );
    if (!rotation) return;

    void rotateSlice(rotation.axis, rotation.index, rotation.direction);
    endSliceGesture();
  };

  return (
    <>
      <group
        ref={groupRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      />
      <group ref={pivotRef} />
    </>
  );
});

CubeCore.displayName = "CubeCore";

const RubiksCube = forwardRef<RubiksCubeRef, RubiksCubeProps>(({ onRotateEnd }, ref) => {
  const [orbitEnabled, setOrbitEnabled] = useState(true);

  return (
    <div className="w-full h-full min-h-[400px] touch-none">
      <Canvas camera={{ position: [5, 5, 5], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 10, 10]} intensity={1.5} />
        <CubeCore ref={ref} onRotateEnd={onRotateEnd} setOrbitEnabled={setOrbitEnabled} />
        <OrbitControls enablePan={false} enableZoom enabled={orbitEnabled} />
      </Canvas>
    </div>
  );
});

RubiksCube.displayName = "RubiksCube";

export default RubiksCube;
