import React from 'react';

interface WebXRStatusOverlayProps {
  isVisible: boolean;
  simulationTime: number;
  status?: string;
}

export const WebXRStatusOverlay: React.FC<WebXRStatusOverlayProps> = ({ 
  isVisible, 
  simulationTime, 
  status = "Active" 
}) => {
  if (!isVisible) return null;

  return (
    <div 
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        color: 'white',
        padding: '12px 16px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        pointerEvents: 'none',
        zIndex: 1000,
        border: '1px solid rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        XR Simulation Status
      </div>
      <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
        {status}
      </div>
      <div style={{ fontSize: '12px' }}>
        Time: <span style={{ color: '#4f46e5' }}>{simulationTime.toFixed(3)}s</span>
      </div>
    </div>
  );
};
