import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { WebXRStatusOverlay } from './WebXRStatusOverlay';

interface ImmersiveCanvasProps {
  onInitialize?: (scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => void;
  onUpdate?: (scene: THREE.Scene, camera: THREE.PerspectiveCamera, clock: THREE.Clock) => void;
  simulationTime?: number;
}

export interface ImmersiveCanvasHandle {
  enterAR: () => void;
  enterVR: () => void;
}

export const ImmersiveCanvas = forwardRef<ImmersiveCanvasHandle, ImmersiveCanvasProps>(({ 
  onInitialize, 
  onUpdate,
  simulationTime = 0
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  
  const [isInXR, setIsInXR] = useState(false);
  const [xrMode, setXrMode] = useState<'vr' | 'ar' | null>(null);
  const vrButtonRef = useRef<HTMLElement | null>(null);
  const arButtonRef = useRef<HTMLElement | null>(null);

  useImperativeHandle(ref, () => ({
    enterAR: () => {
      if (arButtonRef.current) arButtonRef.current.click();
    },
    enterVR: () => {
      if (vrButtonRef.current) vrButtonRef.current.click();
    }
  }));

  useEffect(() => {
    const currentContainer = containerRef.current;
    if (!currentContainer) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    sceneRef.current = scene;

    // --- Camera Setup ---
    const camera = new THREE.PerspectiveCamera(
      75,
      currentContainer.clientWidth / currentContainer.clientHeight,
      0.1,
      1000
    );
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // --- Renderer Setup ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentContainer.clientWidth, currentContainer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Enable WebXR
    renderer.xr.enabled = true;
    
    currentContainer.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // XR Session Event Listeners
    const onSessionStart = () => {
      setIsInXR(true);
    };
    const onSessionEnd = () => {
      setIsInXR(false);
      setXrMode(null);
    };

    renderer.xr.addEventListener('sessionstart', onSessionStart);
    renderer.xr.addEventListener('sessionend', onSessionEnd);

    // --- WebXR Support Check & Buttons ---
    if ('xr' in navigator) {
      const xr = (navigator as any).xr;
      
      // VR Support
      xr.isSessionSupported('immersive-vr').then((supported: boolean) => {
        if (supported && containerRef.current && rendererRef.current) {
          const vrButton = VRButton.createButton(rendererRef.current);
          vrButton.style.position = 'absolute';
          vrButton.style.bottom = '20px';
          vrButton.style.left = 'calc(50% - 100px)';
          vrButton.style.transform = 'translateX(-50%)';
          vrButton.addEventListener('click', () => setXrMode('vr'));
          containerRef.current.appendChild(vrButton);
          vrButtonRef.current = vrButton;
        }
      });

      // AR Support
      xr.isSessionSupported('immersive-ar').then((supported: boolean) => {
        if (supported && containerRef.current && rendererRef.current) {
          const arButton = ARButton.createButton(rendererRef.current);
          arButton.style.position = 'absolute';
          arButton.style.bottom = '20px';
          arButton.style.left = 'calc(50% + 100px)';
          arButton.style.transform = 'translateX(-50%)';
          arButton.addEventListener('click', () => setXrMode('ar'));
          containerRef.current.appendChild(arButton);
          arButtonRef.current = arButton;
        }
      });
    }

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
      
      if (rendererRef.current) {
        rendererRef.current.setAnimationLoop(null);
        rendererRef.current.xr.removeEventListener('sessionstart', onSessionStart);
        rendererRef.current.xr.removeEventListener('sessionend', onSessionEnd);
        
        if (currentContainer && rendererRef.current.domElement && currentContainer.contains(rendererRef.current.domElement)) {
          currentContainer.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
      }

      if (currentContainer) {
        const buttons = currentContainer.querySelectorAll('button');
        buttons.forEach(b => b.remove());
      }
      
      if (sceneRef.current) {
        sceneRef.current.clear();
      }
    };
  }, [onInitialize, onUpdate]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative overflow-hidden"
    >
      <WebXRStatusOverlay 
        isVisible={isInXR} 
        simulationTime={simulationTime} 
        status={xrMode === 'ar' ? 'Augmented Reality' : 'Virtual Reality'}
      />
    </div>
  );
});

ImmersiveCanvas.displayName = 'ImmersiveCanvas';
