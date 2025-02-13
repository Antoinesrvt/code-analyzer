import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { GitBranch, Code2, Network, Workflow, Zap } from 'lucide-react';
import { RepositoryInput } from './RepositoryInput';

const features = [
  {
    icon: Code2,
    title: 'Multi-Language Support',
    description: 'Analyze repositories across different programming languages and frameworks.',
  },
  {
    icon: Network,
    title: 'Module Visualization',
    description: 'Understand code structure through interactive module relationships.',
  },
  {
    icon: Workflow,
    title: 'Workflow Analysis',
    description: 'Map user flows and system processes with detailed insights.',
  },
  {
    icon: Zap,
    title: 'Real-time Updates',
    description: 'Stay synchronized with your repository changes automatically.',
  },
];

export function LandingHero() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <div className="flex flex-col items-center space-y-12 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-6 max-w-3xl"
      >
        <div className="flex justify-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="p-3 bg-blue-100 rounded-full"
          >
            <GitBranch className="w-8 h-8 text-blue-600" />
          </motion.div>
        </div>
        
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">
          Visualize Your Code Like Never Before
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Transform your GitHub repository into interactive visualizations. Understand dependencies,
          analyze workflows, and gain insights into your codebase structure.
        </p>
        
        <div className="w-full max-w-xl mx-auto">
          <RepositoryInput />
        </div>
      </motion.div>

      <motion.div
        ref={ref}
        className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl mx-auto"
      >
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="flex items-start space-x-4 p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              <div className="flex-shrink-0">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}