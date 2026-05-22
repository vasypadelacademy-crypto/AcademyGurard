import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface SpeedometerProps {
  value: number; // 0 to 100
  size?: number;
  label?: string;
}

export const Speedometer: React.FC<SpeedometerProps> = ({ value, size = 100, label }) => {
  // We want a semi-circle gauge.
  // Increase size by requested amounts (1.38 * 1.15 = 1.59)
  const actualSize = size * 1.59;

  const boundedValue = Math.min(100, Math.max(0, value));

  const data = [
    { name: 'value', value: boundedValue },
    { name: 'remaining', value: 100 - boundedValue },
  ];

  const getColor = (val: number) => {
    if (val >= 80) return '#10b981'; // emerald-500
    if (val >= 50) return '#3b82f6'; // blue-500
    return '#ef4444'; // red-500
  };

  const activeColor = getColor(value);
  
  // Rotation for the needle: 
  // 0% value = -90deg (pointing left)
  // 50% value = 0deg (pointing up)
  // 100% value = 90deg (pointing right)
  const needleRotation = (boundedValue / 100) * 180 - 90;

  return (
    <div className="flex flex-col items-center justify-end relative" style={{ width: actualSize, height: actualSize / 2 }}>
      <div className="relative w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius="70%"
              outerRadius="100%"
              paddingAngle={0}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={activeColor} />
              <Cell fill="rgba(30, 41, 59, 0.4)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        
        {/* Needle */}
        <div 
          className="absolute left-1/2" 
          style={{ 
            top: '100%', 
            width: '3px', 
            height: '80%', 
            backgroundColor: '#f8fafc',
            transformOrigin: 'bottom center',
            transform: `translate(-50%, -100%) rotate(${needleRotation}deg)`,
            borderRadius: '2px',
            boxShadow: '0 0 4px rgba(0,0,0,0.5)',
            zIndex: 10
          }}
        >
          {/* Needle Center Pin */}
          <div className="absolute top-full left-1/2 w-4 h-4 rounded-full" style={{ backgroundColor: '#0f172a', transform: 'translate(-50%, -50%)', border: `2.5px solid ${activeColor}` }} />
        </div>
      </div>
    </div>
  );
};
