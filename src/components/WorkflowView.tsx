import React from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore } from '../store/useStore';

export function WorkflowView() {
  const store = useStore();
  const { workflow } = store();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  React.useEffect(() => {
    const flowNodes = workflow.nodes.map((node) => ({
      id: node.id,
      type: 'default',
      data: { label: node.label },
      position: { x: 0, y: 0 }, // Position will be calculated by layout
    }));

    const flowEdges = workflow.edges.map((edge) => ({
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [workflow, setNodes, setEdges]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
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