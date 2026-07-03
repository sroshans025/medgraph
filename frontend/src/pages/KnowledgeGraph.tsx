import React, { useMemo } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap
} from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { DiagnosticResult } from '../services/api';

interface KnowledgeGraphProps {
  activeCase: DiagnosticResult;
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ activeCase }) => {
  const kg = activeCase.knowledge_graph;

  // Programmatically calculate node layout positions in hierarchical columns (layers)
  const formattedNodes = useMemo(() => {
    // Group nodes by category to align them in vertical columns
    const columns: Record<string, string[]> = {
      Finding: [],
      Disease: [],
      Severity: [],
      Recommendation: []
    };

    kg.nodes.forEach(node => {
      const type = node.type;
      if (columns[type]) {
        columns[type].push(node.id);
      } else {
        // Fallback for custom or unknown node types
        columns['Recommendation'].push(node.id);
      }
    });

    return kg.nodes.map((node) => {
      const type = node.type;
      
      // Determine X coordinate based on column hierarchy
      let x = 50;
      if (type === 'Disease') x = 260;
      else if (type === 'Severity') x = 480;
      else if (type === 'Recommendation') x = 480;

      // Determine Y coordinate based on index in column lists
      const list = columns[type] || columns['Recommendation'];
      const index = list.indexOf(node.id);
      let y = 100 + index * 130;
      
      // Offset y slightly for recommendations to align below severity nodes
      if (type === 'Recommendation') {
        const severityCount = columns['Severity']?.length || 0;
        y = 100 + (severityCount + index) * 110;
      }

      // Styled color cards based on clinical node types
      let nodeStyle = {};
      if (type === 'Finding') {
        nodeStyle = {
          border: '1.5px solid #06b6d4',
          background: 'rgba(6, 182, 212, 0.08)',
          color: '#22d3ee',
          padding: '12px 16px',
        };
      } else if (type === 'Disease') {
        nodeStyle = {
          border: '1.5px solid #a855f7',
          background: 'rgba(168, 85, 247, 0.08)',
          color: '#e9d5ff',
          padding: '12px 16px',
          fontWeight: 'bold',
        };
      } else if (type === 'Severity') {
        nodeStyle = {
          border: '1.5px solid #eab308',
          background: 'rgba(234, 179, 8, 0.05)',
          color: '#fef08a',
          padding: '10px 14px',
        };
      } else {
        nodeStyle = {
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(17, 25, 40, 0.85)',
          color: '#d1d5db',
          padding: '10px 14px',
        };
      }

      return {
        id: node.id,
        position: { x, y },
        data: { label: node.label },
        style: {
          ...nodeStyle,
          borderRadius: '8px',
          fontSize: '11px',
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
          minWidth: '150px',
        }
      } as Node;
    });
  }, [kg]);

  // Format NetworkX edges into React Flow edge models with animations
  const formattedEdges = useMemo(() => {
    return kg.edges.map((edge, idx) => {
      // Determine colors matching source types
      const isFinding = edge.source.startsWith('finding');
      const strokeColor = isFinding ? '#06b6d4' : '#a855f7';

      return {
        id: `e-${edge.source}-${edge.target}-${idx}`,
        source: edge.source,
        target: edge.target,
        label: edge.relation,
        animated: true, // Renders glowing flow dash animations
        style: { stroke: strokeColor, strokeWidth: 1.5 },
        labelStyle: { fill: '#9ca3af', fontSize: '8px', fontWeight: 'bold' },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
        labelBgStyle: { fill: '#060913', fillOpacity: 0.8 },
      } as Edge;
    });
  }, [kg]);

  return (
    <div className="space-y-6 animate-fade-in py-4 h-full flex flex-col">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Clinical Reasoning Graph</h2>
        <p className="text-gray-400 text-sm mt-1">
          Interactive knowledge graph tracing model observations to pathophysiologies and guidelines.
        </p>
      </div>

      <div className="flex-1 min-h-[500px] rounded-xl border border-white/5 bg-[#060913] relative overflow-hidden shadow-2xl">
        <ReactFlow
          nodes={formattedNodes}
          edges={formattedEdges}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background color="#1e293b" gap={20} size={1} />
          <Controls />
          <MiniMap 
            style={{ background: '#090e1a', border: '1px solid rgba(255, 255, 255, 0.08)' }} 
            nodeColor={(n) => {
              if (n.id.startsWith('finding')) return 'rgba(6, 182, 212, 0.3)';
              if (n.id.startsWith('disease')) return 'rgba(168, 85, 247, 0.3)';
              return 'rgba(255, 255, 255, 0.1)';
            }}
            maskColor="rgba(0, 0, 0, 0.5)"
          />
        </ReactFlow>
      </div>
    </div>
  );
};
