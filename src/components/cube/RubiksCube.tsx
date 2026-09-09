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

// Sticker colours in BoxGeometry material order: right, left, top, bottom, front, back.
const COLORS = ["#B90000", "#FF5900", "#FFFFFF", "#FFD500", "#009B48", "#0045AD"];

const CUBIE_SIZE = 0.95;
const DRAG_THRESHOLD = 0.2;
const DEFAULT_DURATION = 300;

type Axis = "x" | "y" | "z";

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

  const endDrag = useCallback(() => {
    setOrbitEnabled(true);
    dragStart.current = null;
  }, [setOrbitEnabled]);

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

    const dragVec = new THREE.Vector3().subVectors(event.point, dragStart.current.point);
    if (dragVec.length() < DRAG_THRESHOLD) return;

    const { normal, mesh } = dragStart.current;
    const origin = new THREE.Vector3();
    mesh.getWorldPosition(origin);

    const absX = Math.abs(dragVec.x);
    const absY = Math.abs(dragVec.y);
    const absZ = Math.abs(dragVec.z);

    let axis: Axis = "x";
    let direction = 0;
    let index = 0;

    if (Math.abs(normal.x) > 0.5) {
      // Left/right face: a vertical drag turns a z-slice, a depth drag a y-slice.
      if (absY > absZ) {
        axis = "z";
        direction = Math.sign(dragVec.y) * Math.sign(normal.x);
        index = Math.round(origin.z);
      } else {
        axis = "y";
        direction = -Math.sign(dragVec.z) * Math.sign(normal.x);
        index = Math.round(origin.y);
      }
    } else if (Math.abs(normal.y) > 0.5) {
      // Top/bottom face.
      if (absX > absZ) {
        axis = "z";
        direction = -Math.sign(dragVec.x) * Math.sign(normal.y);
        index = Math.round(origin.z);
      } else {
        axis = "x";
        direction = Math.sign(dragVec.z) * Math.sign(normal.y);
        index = Math.round(origin.x);
      }
    } else if (Math.abs(normal.z) > 0.5) {
      // Front/back face.
      if (absX > absY) {
        axis = "y";
        direction = Math.sign(dragVec.x) * Math.sign(normal.z);
        index = Math.round(origin.y);
      } else {
        axis = "x";
        direction = -Math.sign(dragVec.y) * Math.sign(normal.z);
        index = Math.round(origin.x);
      }
    }

    void rotateSlice(axis, index, direction);
    endDrag();
  };

  return (
    <>
      <group
        ref={groupRef}
        onPointerDown={handlePointerDown}
        onPointerUp={endDrag}
        onPointerOut={endDrag}
        onPointerCancel={endDrag}
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
