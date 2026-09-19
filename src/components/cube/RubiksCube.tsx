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
import {
  ContactShadows,
  Environment,
  Lightformer,
  OrbitControls,
} from "@react-three/drei";
import * as THREE from "three";
import { Axis, resolveDragRotation } from "./dragRotation";
import { BODY_COLOR, STICKER_COLORS } from "./cubeTheme";
import type { Move } from "@/lib/cube/moves";
import { moveForSliceTurn } from "@/lib/cube/bridge";

const CUBIE_SIZE = 0.98;
const CORNER_RADIUS = 0.12;
const STICKER_SIZE = 0.76;

/**
 * Стикер стоит чуть НАД поверхностью корпуса, а не под ней: полуразмер корпуса
 * равен CUBIE_SIZE / 2, и плоскость, опущенная внутрь, была бы просто закрыта
 * корпусом. Зазор в две тысячных снимает z-fighting. Визуальная «утопленность»
 * из спеки достигается другим: стикер меньше грани, и тёмный корпус его
 * обрамляет.
 */
const STICKER_OFFSET = CUBIE_SIZE / 2 + 0.002;

/**
 * Порядок совпадает с STICKER_COLORS: +X, -X, +Y, -Y, +Z, -Z.
 *
 * Тип выписан явно, а не выведен через `as const`. С `as const` у каждого
 * элемента rotation получал собственный литеральный тип, face внутри forEach
 * становился объединением шести типов, и spread такого объединения в
 * set(x, y, z) TypeScript не принимает.
 */
type StickerFace = {
  axis: "x" | "y" | "z";
  sign: 1 | -1;
  rotation: [number, number, number];
};

const STICKER_FACES: StickerFace[] = [
  { axis: "x", sign: 1, rotation: [0, Math.PI / 2, 0] },
  { axis: "x", sign: -1, rotation: [0, -Math.PI / 2, 0] },
  { axis: "y", sign: 1, rotation: [-Math.PI / 2, 0, 0] },
  { axis: "y", sign: -1, rotation: [Math.PI / 2, 0, 0] },
  { axis: "z", sign: 1, rotation: [0, 0, 0] },
  { axis: "z", sign: -1, rotation: [0, Math.PI, 0] },
];

const DRAG_THRESHOLD = 0.2;
const DEFAULT_DURATION = 300;

interface RubiksCubeProps {
  onRotateEnd?: () => void;
  /**
   * Ход, сделанный руками пользователя, — модель должна узнавать о том, чего
   * не запускала сама. Поэтому вызывается только из обработчика жеста, а не из
   * rotateSlice: программное проигрывание урока идёт мимо и о себе не
   * сообщает. Поворот среднего среза тоже молчит: у него нет записи в нотации
   * граней, которую понимает движок.
   */
  onMove?: (move: Move) => void;
}

export interface RubiksCubeRef {
  /** Rotates the slice at `index` (-1 | 0 | 1) around `axis`. Resolves when the animation ends. */
  rotateSlice: (axis: Axis, index: number, direction: number, duration?: number) => Promise<void>;
}

/**
 * Скруглённый кубик: рецепт RoundedBox из drei, воспроизведённый вручную.
 * Вручную — потому что drei отдаёт RoundedBoxGeometry как JSX-компонент, а
 * кубики здесь собираются императивно через new THREE.Mesh; брать же класс из
 * three-stdlib нельзя — она в дереве только транзитивно, в package.json её нет.
 */
function createRoundedCubieGeometry(size: number, radius: number): THREE.ExtrudeGeometry {
  const eps = 0.00001;
  const inner = radius - eps;
  const shape = new THREE.Shape();
  shape.absarc(eps, eps, eps, -Math.PI / 2, -Math.PI, true);
  shape.absarc(eps, size - inner * 2, eps, Math.PI, Math.PI / 2, true);
  shape.absarc(size - inner * 2, size - inner * 2, eps, Math.PI / 2, 0, true);
  shape.absarc(size - inner * 2, eps, eps, 0, -Math.PI / 2, true);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: size - radius * 2,
    bevelEnabled: true,
    bevelSegments: 6,
    steps: 1,
    bevelSize: inner,
    bevelThickness: radius,
    curveSegments: 4,
  });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

/** Геометрии и материалы, созданные один раз на монтирование и освобождаемые с ним. */
function useCubeResources() {
  const resources = useMemo(() => {
    const body = createRoundedCubieGeometry(CUBIE_SIZE, CORNER_RADIUS);
    const sticker = new THREE.PlaneGeometry(STICKER_SIZE, STICKER_SIZE);
    const stickerMaterials = STICKER_COLORS.map(
      (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05 })
    );
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: BODY_COLOR,
      roughness: 0.65,
      metalness: 0.1,
    });
    return { body, sticker, stickerMaterials, bodyMaterial };
  }, []);

  useEffect(() => {
    return () => {
      resources.body.dispose();
      resources.sticker.dispose();
      resources.stickerMaterials.forEach((material) => material.dispose());
      resources.bodyMaterial.dispose();
    };
  }, [resources]);

  return resources;
}

const CubeCore = forwardRef<
  RubiksCubeRef,
  RubiksCubeProps & { setOrbitEnabled: (enabled: boolean) => void }
>(({ onRotateEnd, onMove, setOrbitEnabled }, ref) => {
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

  const { body, sticker, stickerMaterials, bodyMaterial } = useCubeResources();

  // Build the 27 cubies once the group exists.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    cubiesRef.current = [];
    group.clear();

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const cubie = new THREE.Mesh(body, bodyMaterial);
          cubie.position.set(x, y, z);
          cubie.userData = { logicalPosition: new THREE.Vector3(x, y, z) };

          // Корпус не ловит луч. У скруглённой геометрии нормали на фаске не
          // осевые, и округление дало бы неверную ось поворота. Интерактивны
          // только стикеры: у плоскости нормаль всегда осевая, поэтому контракт
          // resolveDragRotation сохраняется без единой правки.
          cubie.raycast = () => null;

          const coords = { x, y, z };
          STICKER_FACES.forEach((face, index) => {
            if (coords[face.axis] !== face.sign) return;
            const plane = new THREE.Mesh(sticker, stickerMaterials[index]);
            plane.rotation.set(...face.rotation);
            plane.position[face.axis] = face.sign * STICKER_OFFSET;
            cubie.add(plane);
          });

          cubiesRef.current.push(cubie);
          group.add(cubie);
        }
      }
    }

    return () => {
      group.clear();
      cubiesRef.current = [];
    };
  }, [body, bodyMaterial, sticker, stickerMaterials]);

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

    // Луч попадает только в стикер — корпус его не ловит. Кубик берём как
    // родителя стикера: дальше mesh нужен лишь для getWorldPosition(origin).
    const stickerMesh = event.object as THREE.Mesh;
    const cubie = (stickerMesh.parent ?? stickerMesh) as THREE.Mesh;

    dragStart.current = {
      point: event.point.clone(),
      normal:
        event.face?.normal?.clone().transformDirection(stickerMesh.matrixWorld).round() ??
        new THREE.Vector3(),
      mesh: cubie,
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

    // Сообщаем о ходе после того, как поворот доигран: до этого момента куб
    // ещё не в том состоянии, о котором мы рассказываем. null означает средний
    // срез — про него сказать нечего.
    const move = moveForSliceTurn(rotation);
    void rotateSlice(rotation.axis, rotation.index, rotation.direction).then(() => {
      if (move) onMove?.(move);
    });
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

const RubiksCube = forwardRef<RubiksCubeRef, RubiksCubeProps>(({ onRotateEnd, onMove }, ref) => {
  const [orbitEnabled, setOrbitEnabled] = useState(true);

  return (
    <div className="w-full h-full min-h-[400px] touch-none">
      <Canvas
        camera={{ position: [5, 5, 5], fov: 45 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1.2} />
        <CubeCore
          ref={ref}
          onRotateEnd={onRotateEnd}
          onMove={onMove}
          setOrbitEnabled={setOrbitEnabled}
        />
        {/*
          Окружение собирается из источников прямо здесь. Пресеты (preset="...")
          использовать нельзя: drei скачивает для них HDRI с raw.githack.com в
          рантайме — это внешняя зависимость, которой в спеке нет. С детьми и без
          preset/files загрузчик не вызывается вовсе.
        */}
        <Environment resolution={128}>
          <Lightformer form="rect" intensity={2} position={[0, 4, 2]} scale={6} />
          <Lightformer form="rect" intensity={1} position={[-4, 1, 2]} scale={4} />
        </Environment>
        <ContactShadows position={[0, -1.7, 0]} opacity={0.45} blur={2.4} far={4} />
        <OrbitControls enablePan={false} enableZoom enabled={orbitEnabled} />
      </Canvas>
    </div>
  );
});

RubiksCube.displayName = "RubiksCube";

export default RubiksCube;
