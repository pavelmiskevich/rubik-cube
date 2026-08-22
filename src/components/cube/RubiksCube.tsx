"use client";

import React, { useRef, useImperativeHandle, forwardRef, useEffect, useState } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// Colors for the cube faces: right, left, top, bottom, front, back
const COLORS = ["#B90000", "#FF5900", "#FFFFFF", "#FFD500", "#009B48", "#0045AD"];

const materials = COLORS.map(
  (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.1, metalness: 0.1 })
);
const innerMaterial = new THREE.MeshStandardMaterial({ color: "#222222", roughness: 1.0 });

function getCubieMaterials(x: number, y: number, z: number) {
  return [
    x === 1 ? materials[0] : innerMaterial,  // Right
    x === -1 ? materials[1] : innerMaterial, // Left
    y === 1 ? materials[2] : innerMaterial,  // Top
    y === -1 ? materials[3] : innerMaterial, // Bottom
    z === 1 ? materials[4] : innerMaterial,  // Front
    z === -1 ? materials[5] : innerMaterial, // Back
  ];
}

interface RubiksCubeProps {
  onRotateEnd?: () => void;
}

export interface RubiksCubeRef {
  rotateSlice: (axis: 'x' | 'y' | 'z', index: number, direction: number, duration?: number) => Promise<void>;
}

const CubeCore = forwardRef<RubiksCubeRef, RubiksCubeProps & { setOrbitEnabled: (v: boolean) => void }>((props, ref) => {
  const groupRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group>(null);
  const cubiesRef = useRef<THREE.Mesh[]>([]);
  
  const animating = useRef(false);
  const animQueue = useRef<Array<() => Promise<void>>>([]);

  // Drag state
  const dragStart = useRef<{
    point: THREE.Vector3;
    normal: THREE.Vector3;
    mesh: THREE.Mesh;
  } | null>(null);

  // Initialize cubies
  useEffect(() => {
    if (!groupRef.current) return;
    
    cubiesRef.current = [];
    groupRef.current.clear();
    
    // Geometry with slightly rounded edges would be nice, but standard BoxGeometry is cheaper
    const geometry = new THREE.BoxGeometry(0.95, 0.95, 0.95);
    
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const mats = getCubieMaterials(x, y, z);
          const mesh = new THREE.Mesh(geometry, mats);
          mesh.position.set(x, y, z);
          
          mesh.userData = { 
            logicalPosition: new THREE.Vector3(x, y, z) 
          };
          
          cubiesRef.current.push(mesh);
          groupRef.current.add(mesh);
        }
      }
    }
  }, []);

  const rotateSlice = (axis: 'x' | 'y' | 'z', index: number, direction: number, duration = 300): Promise<void> => {
    return new Promise((resolve) => {
      const task = async () => {
        if (!groupRef.current || !pivotRef.current) {
          resolve();
          return;
        }
        animating.current = true;

        const pivot = pivotRef.current;
        pivot.rotation.set(0, 0, 0);
        pivot.updateMatrixWorld();

        const activeCubies: THREE.Mesh[] = [];
        
        cubiesRef.current.forEach((cubie) => {
          const worldPos = new THREE.Vector3();
          cubie.getWorldPosition(worldPos);
          const pos = Math.round(worldPos[axis]);
          
          if (pos === index) {
            activeCubies.push(cubie);
            pivot.attach(cubie);
          }
        });

        const startRotation = 0;
        const targetRotation = direction * Math.PI / 2;
        const startTime = performance.now();

        const animate = () => {
          const now = performance.now();
          const progress = Math.min((now - startTime) / duration, 1.0);
          const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
          
          pivot.rotation[axis] = startRotation + (targetRotation - startRotation) * ease;
          
          if (progress < 1.0) {
            requestAnimationFrame(animate);
          } else {
            pivot.rotation[axis] = targetRotation;
            pivot.updateMatrixWorld();
            
            activeCubies.forEach((cubie) => {
              groupRef.current!.attach(cubie);
              const wp = new THREE.Vector3();
              cubie.getWorldPosition(wp);
              cubie.userData.logicalPosition.set(
                Math.round(wp.x),
                Math.round(wp.y),
                Math.round(wp.z)
              );
            });
            
            pivot.rotation.set(0, 0, 0);
            
            animating.current = false;
            props.onRotateEnd?.();
            resolve();
            
            if (animQueue.current.length > 0) {
              const next = animQueue.current.shift();
              next?.();
            }
          }
        };
        
        requestAnimationFrame(animate);
      };

      if (animating.current) {
        animQueue.current.push(task);
      } else {
        task();
      }
    });
  };

  useImperativeHandle(ref, () => ({
    rotateSlice,
  }));

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (animating.current) return;
    
    props.setOrbitEnabled(false);
    dragStart.current = {
      point: e.point.clone(),
      normal: e.face?.normal?.clone().transformDirection(e.object.matrixWorld).round() || new THREE.Vector3(),
      mesh: e.object as THREE.Mesh,
    };
  };

  const handlePointerUp = () => {
    props.setOrbitEnabled(true);
    dragStart.current = null;
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragStart.current || animating.current) return;

    const dragVec = new THREE.Vector3().subVectors(e.point, dragStart.current.point);
    if (dragVec.length() < 0.2) return; // Threshold for swipe

    const normal = dragStart.current.normal;
    const wp = new THREE.Vector3();
    dragStart.current.mesh.getWorldPosition(wp);

    let axis: 'x' | 'y' | 'z' = 'x';
    let direction = 1;
    let index = 0;

    // Determine the dominant swipe direction and construct rotation
    const absX = Math.abs(dragVec.x);
    const absY = Math.abs(dragVec.y);
    const absZ = Math.abs(dragVec.z);

    if (Math.abs(normal.x) > 0.5) {
      // Clicked on Right/Left face
      if (absY > absZ) {
        axis = 'z';
        direction = Math.sign(dragVec.y) * Math.sign(normal.x);
        index = Math.round(wp.z);
      } else {
        axis = 'y';
        direction = -Math.sign(dragVec.z) * Math.sign(normal.x);
        index = Math.round(wp.y);
      }
    } else if (Math.abs(normal.y) > 0.5) {
      // Clicked on Top/Bottom face
      if (absX > absZ) {
        axis = 'z';
        direction = -Math.sign(dragVec.x) * Math.sign(normal.y);
        index = Math.round(wp.z);
      } else {
        axis = 'x';
        direction = Math.sign(dragVec.z) * Math.sign(normal.y);
        index = Math.round(wp.x);
      }
    } else if (Math.abs(normal.z) > 0.5) {
      // Clicked on Front/Back face
      if (absX > absY) {
        axis = 'y';
        direction = Math.sign(dragVec.x) * Math.sign(normal.z);
        index = Math.round(wp.y);
      } else {
        axis = 'x';
        direction = -Math.sign(dragVec.y) * Math.sign(normal.z);
        index = Math.round(wp.x);
      }
    }

    // Initiate rotation and cancel drag
    rotateSlice(axis, index, direction);
    props.setOrbitEnabled(true);
    dragStart.current = null;
  };

  return (
    <>
      <group 
        ref={groupRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOut={handlePointerUp}
        onPointerMove={handlePointerMove}
      />
      <group ref={pivotRef} />
    </>
  );
});

CubeCore.displayName = 'CubeCore';

export default function RubiksCube({ onRotateEnd }: RubiksCubeProps) {
  const cubeRef = useRef<RubiksCubeRef>(null);
  const [orbitEnabled, setOrbitEnabled] = useState(true);

  return (
    <div className="w-full h-full min-h-[400px] touch-none">
      <Canvas camera={{ position: [5, 5, 5], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 10, 10]} intensity={1.5} />
        <CubeCore ref={cubeRef} onRotateEnd={onRotateEnd} setOrbitEnabled={setOrbitEnabled} />
        <OrbitControls enablePan={false} enableZoom={true} enabled={orbitEnabled} />
      </Canvas>
    </div>
  );
}
