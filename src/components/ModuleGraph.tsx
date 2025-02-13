import React from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { motion } from 'framer-motion';

interface ModuleGraphProps {
  modules: any[];
  files: any[];
  onNodeClick: (node: any) => void;
  analysisInProgress?: boolean;
}

export function ModuleGraph({ modules, files, onNodeClick, analysisInProgress }: ModuleGraphProps) {
  const graphData = React.useMemo(() => {
    const nodes = [
      ...modules.map((m) => ({
        id: m.id,
        label: m.name,
        type: 'module',
        status: m.analysisStatus,
      })),
      ...files.map((f) => ({
        id: f.id,
        label: f.path,
        type: 'file',
        status: f.analysisStatus,
      })),
    ];

    const links = files.flatMap((file) =>
      file.modules.map((moduleId: string) => ({
        source: file.id,
        target: moduleId,
        status: file.analysisStatus,
      }))
    );

    return { nodes, links };
  }, [modules, files]);

  const getNodeColor = (node: any) => {
    if (node.status === 'pending') return '#e2e8f0';
    if (node.status === 'in-progress') return '#93c5fd';
    if (node.type === 'module') return '#ff6b6b';
    return '#4dabf7';
  };

  const getLinkColor = (link: any) => {
    if (link.status === 'pending') return '#e2e8f0';
    if (link.status === 'in-progress') return '#93c5fd';
    return '#cbd5e0';
  };

  return (
    <motion.div
      className="w-full h-full relative"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {analysisInProgress && (
        <div className="absolute top-4 left-4 z-10 bg-yellow-50 border border-yellow-100 
                     rounded-lg p-3 text-sm text-yellow-800 shadow-sm">
          Analysis in progress - Graph will update automatically
        </div>
      )}
      
      <ForceGraph2D
        graphData={graphData}
        nodeLabel="label"
        nodeColor={getNodeColor}
        onNodeClick={onNodeClick}
        linkColor={getLinkColor}
        nodeRelSize={6}
        linkWidth={1.5}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const label = node.label;
          const fontSize = 12/globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2) as [number, number];

          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.fillRect(
            node.x - bckgDimensions[0] / 2,
            node.y - bckgDimensions[1] / 2,
            bckgDimensions[0],
            bckgDimensions[1]
          );

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = node.type === 'module' ? '#ff6b6b' : '#4dabf7';
          ctx.fillText(label, node.x, node.y);

          if (node.status === 'in-progress') {
            ctx.beginPath();
            ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI);
            ctx.strokeStyle = '#93c5fd';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }}
      />
    </motion.div>
  );
}