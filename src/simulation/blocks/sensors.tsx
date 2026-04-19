"use client";

import { memo } from "react";

export const SensorPermissionRequest = memo(function SensorPermissionRequest({ 
  onGrant 
}: { 
  onGrant: () => void 
}) {
  return (
    <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-800">
      <p className="font-bold mb-1 uppercase">Permission Required</p>
      <button 
        onClick={onGrant}
        className="w-full py-1 bg-amber-600 text-white rounded font-bold uppercase hover:bg-amber-700"
      >
        Enable Sensors
      </button>
    </div>
  );
});
