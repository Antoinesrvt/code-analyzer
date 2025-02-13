import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, Activity, Clock, AlertTriangle } from 'lucide-react';
import { PerformanceMetrics } from '../types/performance';

interface PerformanceReportProps {
  metrics: PerformanceMetrics;
}

export function PerformanceReport({ metrics }: PerformanceReportProps) {
  const formatDuration = (ms: number): string => {
    return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`;
  };

  const getStatusColor = (duration: number): string => {
    if (duration > 5000) return 'text-red-500';
    if (duration > 2000) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2 flex items-center">
          <Activity className="w-6 h-6 mr-2 text-blue-600" />
          Performance Analysis Report
        </h2>
        <p className="text-gray-600">
          Total Analysis Time: {formatDuration(metrics.totalDuration)}
        </p>
      </div>

      {/* Stage Performance */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-blue-600" />
          Stage Performance
        </h3>
        <div className="space-y-4">
          {metrics.stages.map((stage, index) => (
            <motion.div
              key={stage.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-gray-50 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{stage.name}</span>
                <span className={`font-medium ${getStatusColor(stage.duration)}`}>
                  {formatDuration(stage.duration)}
                </span>
              </div>
              <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className={`absolute left-0 top-0 h-full ${
                    stage.status === 'success' ? 'bg-blue-600' : 'bg-red-500'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Resource Usage */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <BarChart className="w-5 h-5 mr-2 text-blue-600" />
          Resource Utilization
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(metrics.averages).map(([resource, value], index) => (
            <motion.div
              key={resource}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-gray-50 rounded-lg p-4"
            >
              <h4 className="text-sm font-medium text-gray-600 mb-2 capitalize">
                {resource}
              </h4>
              <p className="text-2xl font-semibold text-gray-900">
                {value.toFixed(1)}%
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottlenecks */}
      {metrics.bottlenecks.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-yellow-500" />
            Identified Bottlenecks
          </h3>
          <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4">
            <ul className="space-y-2">
              {metrics.bottlenecks.map((bottleneck, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="text-yellow-700 flex items-center"
                >
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2" />
                  {bottleneck}
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Network Calls */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">API Performance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Endpoint
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metrics.networkCalls.map((call, index) => (
                <motion.tr
                  key={index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {call.endpoint}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDuration(call.duration)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        call.status < 400
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {call.status}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}