import React from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { WorkflowNode, WorkflowEdge } from '@/types';

interface WorkflowGraphProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  analysisInProgress?: boolean;
}

export function WorkflowGraph({ nodes, edges, analysisInProgress }: WorkflowGraphProps) {
  const [flowNodes, setNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState([]);

  React.useEffect(() => {
    const mappedNodes = nodes.map((node) => ({
      id: node.id,
      type: 'default',
      data: { label: node.label },
      position: { x: 0, y: 0 }, // Position will be calculated by layout
    }));

    const mappedEdges = edges.map((edge) => ({
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
    }));

    setNodes(mappedNodes);
    setEdges(mappedEdges);
  }, [nodes, edges, setNodes, setEdges]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
} 