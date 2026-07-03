import React from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

interface ConfidenceGaugeProps {
  score: number;
  band: string;
}

export const ConfidenceGauge: React.FC<ConfidenceGaugeProps> = ({ score, band }) => {
  const percentage = Math.round(score * 100);
  
  // Data for rendering semi-circular gauge (gauge goes from 0 to 180 degrees)
  const data = [
    { value: percentage },
    { value: 100 - percentage }
  ];

  // Determine color matching band
  const getColor = () => {
    if (band === 'High Confidence') return '#a855f7'; // purple
    if (band === 'Moderate Confidence') return '#06b6d4'; // cyan
    return '#f43f5e'; // rose/red
  };

  return (
    <div className="glass-panel p-6 flex flex-col items-center justify-center min-h-[220px]">
      <p className="text-xs font-bold text-gray-500 tracking-wider uppercase mb-2">Confidence Calibration</p>
      
      <div className="h-28 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="90%"
              startAngle={180}
              endAngle={0}
              innerRadius={55}
              outerRadius={70}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={getColor()} />
              <Cell fill="rgba(255, 255, 255, 0.05)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        
        {/* Centered label */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <span className="text-2xl font-extrabold text-white leading-none font-heading">{percentage}%</span>
          <span className="text-[10px] text-gray-400 mt-1 uppercase font-semibold tracking-wider">{band}</span>
        </div>
      </div>
    </div>
  );
};
