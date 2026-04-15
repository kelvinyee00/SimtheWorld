import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ImmersiveCanvasProps {
  onInitialize?: (scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => void;
  onUpdate?: (scene: THREE.Scene, camera: THREE.PerspectiveCamera, clock: THREE.Clock) => void;
}

export const ImmersiveCanvas: React.FC<ImmersiveCanvasProps> = ({ onInitialize, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

  useEffect(() => {
    if (!containerRef.current) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    sceneRef.current = scene;

    // --- Camera Setup ---
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // --- Renderer Setup ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Enable WebXR
    renderer.xr.enabled = true;
    
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- Basic Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    // --- Spatial Reference ---
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    scene.add(gridHelper);

    // --- Resize Handler ---
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // --- Initialization Callback ---
    if (onInitialize) {
      onInitialize(scene, camera, renderer);
    }

    // --- Animation Loop ---
    const animate = () => {
      if (onUpdate && sceneRef.current && cameraRef.current) {
        onUpdate(sceneRef.current, cameraRef.current, clockRef.current);
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    renderer.setAnimationLoop(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.setAnimationLoop(null);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      // Dispose resources
      renderer.dispose();
      scene.clear();
    };
  }, [onInitialize, onUpdate]);

  return (
    <div 
      ref={containerRef} 
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }} 
    />
  );
};
